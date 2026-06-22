import { chromium } from 'playwright'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT   = path.resolve(__dirname, '..')
const DIST   = path.resolve(ROOT, 'dist')
const OUT    = path.resolve(ROOT, 'store-assets', 'screenshots')
const EXT_ID = 'elibhaehdejfmglknoocfaceoledclcb'
const TODAY  = new Date().toISOString().slice(0, 10)

const MOCK_VISITS = [
  { url: 'https://github.com/features', title: 'GitHub', domain: 'github.com', category: 'Work', startTime: Date.now() - 9000000, endTime: Date.now() - 5400000, duration: 3600, date: TODAY },
  { url: 'https://stackoverflow.com/questions', title: 'Stack Overflow', domain: 'stackoverflow.com', category: 'Work', startTime: Date.now() - 5400000, endTime: Date.now() - 3000000, duration: 2400, date: TODAY },
  { url: 'https://docs.google.com', title: 'Google Docs', domain: 'docs.google.com', category: 'Work', startTime: Date.now() - 3000000, endTime: Date.now() - 1200000, duration: 1800, date: TODAY },
  { url: 'https://figma.com/file/abc', title: 'Figma', domain: 'figma.com', category: 'Work', startTime: Date.now() - 1200000, endTime: Date.now() - 600000, duration: 600, date: TODAY },
  { url: 'https://news.ycombinator.com', title: 'Hacker News', domain: 'news.ycombinator.com', category: 'Learning', startTime: Date.now() - 600000, endTime: Date.now() - 180000, duration: 1200, date: TODAY },
  { url: 'https://youtube.com/watch?v=abc', title: 'YouTube', domain: 'youtube.com', category: 'Entertainment', startTime: Date.now() - 180000, endTime: Date.now() - 60000, duration: 900, date: TODAY },
  { url: 'https://twitter.com/home', title: 'Twitter', domain: 'twitter.com', category: 'Social Media', startTime: Date.now() - 60000, endTime: Date.now(), duration: 600, date: TODAY },
]

const context = await chromium.launchPersistentContext('', {
  headless: false,
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--no-sandbox'],
  viewport: { width: 1280, height: 800 },
})
await new Promise(r => setTimeout(r, 2000))

// Inject data first
const dataPage = await context.newPage()
await dataPage.goto(`chrome-extension://${EXT_ID}/dashboard/index.html`)
await dataPage.waitForLoadState('networkidle')
await dataPage.waitForTimeout(1500)
await dataPage.evaluate(async ({ visits, today }) => {
  await new Promise(r => chrome.storage.local.set({
    focusStreak: { current: 7, longest: 14, lastDate: today },
    allTimeRecords: { longestStreak: 14, highestFocusScore: 88, mostProductiveSec: 19800, mostProductiveDay: '2026-06-15' },
  }, r))
  await new Promise(r => chrome.storage.sync.set({
    userName: 'Vijay', dailyFocusGoal: 70, retentionDays: 30, breakIntervalMin: 45,
    weeklyRecapEnabled: true, dailyRecapEnabled: true,
    blockedDomains: ['youtube.com', 'reddit.com', 'twitter.com'],
  }, r))
  await new Promise((resolve, reject) => {
    const req = indexedDB.open('ShadowShelfDB')
    req.onsuccess = e => {
      const db = e.target.result
      const tx = db.transaction(['visits'], 'readwrite')
      const store = tx.objectStore('visits')
      for (const v of visits) store.add(v)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    }
    req.onerror = () => reject(req.error)
  })
}, { visits: MOCK_VISITS, today: TODAY })
await dataPage.close()
await new Promise(r => setTimeout(r, 500))

// Dashboard Home — scroll to all-time records section
const page1 = await context.newPage()
await page1.setViewportSize({ width: 1280, height: 800 })
await page1.goto(`chrome-extension://${EXT_ID}/dashboard/index.html`)
await page1.waitForLoadState('networkidle')
await page1.waitForTimeout(3000)
await page1.evaluate(() => window.scrollTo(0, 700))
await page1.waitForTimeout(500)
await page1.screenshot({ path: path.join(OUT, '3-dashboard-home.png'), clip: { x: 0, y: 0, width: 1280, height: 800 } })
console.log('✓ 3-dashboard-home.png')
await page1.close()

// Settings — scroll to privacy banner
const page2 = await context.newPage()
await page2.setViewportSize({ width: 1280, height: 800 })
await page2.goto(`chrome-extension://${EXT_ID}/dashboard/index.html`)
await page2.waitForLoadState('networkidle')
await page2.waitForTimeout(2000)
await page2.getByText('Settings', { exact: true }).click()
await page2.waitForTimeout(1500)
await page2.evaluate(() => window.scrollTo(0, 1600))
await page2.waitForTimeout(500)
await page2.screenshot({ path: path.join(OUT, '5-settings.png'), clip: { x: 0, y: 0, width: 1280, height: 800 } })
console.log('✓ 5-settings.png')
await page2.close()

await context.close()
console.log('Done.')
