/**
 * Screenshot automation for Chrome Web Store listing.
 * Run: node scripts/take-screenshots.mjs
 *
 * Requires: npx playwright install chromium
 */
import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.resolve(ROOT, 'dist')
const OUT  = path.resolve(ROOT, 'store-assets', 'screenshots')
const TODAY = new Date().toISOString().slice(0, 10)

const MOCK_VISITS = [
  { url: 'https://github.com/features', title: 'GitHub', domain: 'github.com', category: 'Work', startTime: Date.now() - 9000000, endTime: Date.now() - 5400000, duration: 3600, date: TODAY },
  { url: 'https://stackoverflow.com/questions', title: 'Stack Overflow', domain: 'stackoverflow.com', category: 'Work', startTime: Date.now() - 5400000, endTime: Date.now() - 3000000, duration: 2400, date: TODAY },
  { url: 'https://docs.google.com', title: 'Google Docs', domain: 'docs.google.com', category: 'Work', startTime: Date.now() - 3000000, endTime: Date.now() - 1200000, duration: 1800, date: TODAY },
  { url: 'https://figma.com/file/abc', title: 'Figma', domain: 'figma.com', category: 'Work', startTime: Date.now() - 1200000, endTime: Date.now() - 600000, duration: 600, date: TODAY },
  { url: 'https://news.ycombinator.com', title: 'Hacker News', domain: 'news.ycombinator.com', category: 'Learning', startTime: Date.now() - 600000, endTime: Date.now() - 180000, duration: 1200, date: TODAY },
  { url: 'https://youtube.com/watch?v=abc', title: 'YouTube', domain: 'youtube.com', category: 'Entertainment', startTime: Date.now() - 180000, endTime: Date.now() - 60000, duration: 900, date: TODAY },
  { url: 'https://twitter.com/home', title: 'Twitter / X', domain: 'twitter.com', category: 'Social Media', startTime: Date.now() - 60000, endTime: Date.now(), duration: 600, date: TODAY },
]

async function getExtensionId(context) {
  // Most reliable: grab it from the service worker URL
  await new Promise(r => setTimeout(r, 3000))
  const workers = context.serviceWorkers()
  for (const w of workers) {
    const m = w.url().match(/chrome-extension:\/\/([a-z]{32})\//)
    if (m) return m[1]
  }

  // Fallback: listen for the next service worker registration
  return new Promise(resolve => {
    context.once('serviceworker', w => {
      const m = w.url().match(/chrome-extension:\/\/([a-z]{32})\//)
      if (m) resolve(m[1])
    })
    setTimeout(() => resolve(null), 8000)
  })
}

async function injectMockData(context, extId) {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extId}/dashboard/index.html`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)

  await page.evaluate(async ({ visits, today }) => {
    await new Promise(r => chrome.storage.local.set({
      focusStreak: { current: 7, longest: 14, lastDate: today },
      allTimeRecords: {
        longestStreak: 14,
        highestFocusScore: 88,
        mostProductiveSec: 19800,
        mostProductiveDay: '2026-06-15',
      },
      dailyGoalState: { date: today, notified: false },
    }, r))

    await new Promise(r => chrome.storage.sync.set({
      userName: 'Vijay',
      dailyFocusGoal: 70,
      retentionDays: 30,
      breakIntervalMin: 45,
      weeklyRecapEnabled: true,
      dailyRecapEnabled: true,
    }, r))

    // Inject mock visits into IndexedDB directly
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('ShadowShelfDB')
      req.onsuccess = (e) => {
        const db = e.target.result
        const tx = db.transaction(['visits'], 'readwrite')
        const store = tx.objectStore('visits')
        for (const v of visits) store.add(v)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  }, { visits: MOCK_VISITS, today: TODAY })

  await page.close()
}

async function screenshotPage(context, url, outFile, opts = {}) {
  const { width = 1280, height = 800, clickText = null, waitMs = 2000, scrollY = 0 } = opts
  const page = await context.newPage()
  await page.setViewportSize({ width, height })
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(waitMs)
  if (clickText) {
    await page.getByText(clickText, { exact: true }).click()
    await page.waitForTimeout(1200)
  }
  if (scrollY > 0) {
    await page.evaluate(y => window.scrollTo(0, y), scrollY)
    await page.waitForTimeout(400)
  }
  await page.screenshot({ path: outFile, clip: { x: 0, y: 0, width, height } })
  await page.close()
  console.log(`  ✓ ${path.basename(outFile)}`)
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  console.log('🚀 Launching Chrome with ShadowShelf extension...\n')

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${DIST}`,
      `--load-extension=${DIST}`,
      '--window-size=1280,860',
      '--no-sandbox',
    ],
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  })

  await new Promise(r => setTimeout(r, 2000))

  console.log('🔍 Finding extension ID...')
  const extId = await getExtensionId(context)
  if (!extId) {
    console.error('❌ Could not find ShadowShelf extension ID.')
    console.error('   Make sure dist/ is built (npm run build) and Chrome loaded it.')
    await context.close()
    process.exit(1)
  }
  console.log(`   Extension ID: ${extId}\n`)

  console.log('💾 Injecting mock data...')
  await injectMockData(context, extId)
  console.log('   Done.\n')

  console.log('📸 Taking screenshots...')

  // 1 — New Tab
  await screenshotPage(
    context,
    `chrome-extension://${extId}/newtab/index.html`,
    path.join(OUT, '1-newtab.png'),
    { waitMs: 2500 }
  )

  // 2 — Popup (rendered full-page at popup width, padded)
  const popupPage = await context.newPage()
  await popupPage.setViewportSize({ width: 1280, height: 800 })
  await popupPage.setContent(`
    <!DOCTYPE html><html><head><style>
      body { margin:0; background:#0d1117; display:flex; align-items:center; justify-content:center; height:100vh; }
      iframe { width:390px; height:580px; border:none; border-radius:18px;
               box-shadow:0 32px 80px rgba(0,0,0,0.8); }
    </style></head><body>
    <iframe src="chrome-extension://${extId}/popup/index.html"></iframe>
    </body></html>
  `)
  await popupPage.waitForTimeout(3000)
  await popupPage.screenshot({ path: path.join(OUT, '2-popup.png') })
  await popupPage.close()
  console.log('  ✓ 2-popup.png')

  // 3 — Dashboard Home: scroll to show all-time records
  await screenshotPage(
    context,
    `chrome-extension://${extId}/dashboard/index.html`,
    path.join(OUT, '3-dashboard-home.png'),
    { waitMs: 3000, scrollY: 320 }
  )

  // 4 — Insights tab
  await screenshotPage(
    context,
    `chrome-extension://${extId}/dashboard/index.html`,
    path.join(OUT, '4-insights.png'),
    { clickText: 'Insights', waitMs: 2000 }
  )

  // 5 — Settings tab: scroll to privacy banner section
  await screenshotPage(
    context,
    `chrome-extension://${extId}/dashboard/index.html`,
    path.join(OUT, '5-settings.png'),
    { clickText: 'Settings', waitMs: 2000, scrollY: 800 }
  )

  // Promotional tile (440×280)
  await screenshotPage(
    context,
    `file:///${path.join(ROOT, 'store-assets', 'promotional-tile.html').replace(/\\/g, '/')}`,
    path.join(OUT, '0-promo-tile.png'),
    { width: 440, height: 280, waitMs: 2000 }
  )

  console.log('\n✅ All screenshots saved to store-assets/screenshots/')
  console.log(`   ${OUT}\n`)
  console.log('Files:')
  for (const f of fs.readdirSync(OUT).sort()) {
    const size = (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0)
    console.log(`   ${f}  (${size} KB)`)
  }

  await context.close()
}

main().catch(e => {
  console.error('\n❌ Error:', e.message)
  process.exit(1)
})
