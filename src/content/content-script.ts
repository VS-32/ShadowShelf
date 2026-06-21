import { categorize, extractDomain } from '../utils/categorize'

// ── Feature flags (sync storage) ──────────────────────────────────────────────

let highlightEnabled  = true
let clipboardEnabled  = true
let focusBlockEnabled = false
let blockedDomains: string[] = []
let timerRunning = false
let overrideUntil = 0  // epoch ms when "access anyway" override expires

let initReady = 0
function onInitReady() {
  initReady++
  if (initReady >= 2) checkAndBlock()
}

chrome.storage.local.get(['timerRunning'], r => {
  timerRunning = r.timerRunning ?? false
  onInitReady()
})

chrome.storage.sync.get(['highlightEnabled', 'clipboardEnabled', 'focusBlockEnabled', 'blockedDomains'], r => {
  highlightEnabled  = r.highlightEnabled  ?? true
  clipboardEnabled  = r.clipboardEnabled  ?? true
  focusBlockEnabled = r.focusBlockEnabled ?? false
  blockedDomains    = r.blockedDomains    ?? []
  onInitReady()
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    if ('highlightEnabled'  in changes) highlightEnabled  = changes.highlightEnabled.newValue
    if ('clipboardEnabled'  in changes) clipboardEnabled  = changes.clipboardEnabled.newValue
    if ('focusBlockEnabled' in changes) focusBlockEnabled = changes.focusBlockEnabled.newValue ?? false
    if ('blockedDomains'    in changes) blockedDomains    = changes.blockedDomains.newValue ?? []
  }
  if (area === 'local' && 'timerRunning' in changes) {
    timerRunning = changes.timerRunning.newValue ?? false
    if (!timerRunning) removeBlockOverlay()
    else checkAndBlock()
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function localDate(ms: number) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Focus Blocker ─────────────────────────────────────────────────────────────

function removeBlockOverlay() {
  document.getElementById('__shadowshelf_blocker__')?.remove()
}

async function checkAndBlock() {
  if (!focusBlockEnabled || !timerRunning) return
  if (Date.now() < overrideUntil) return
  if (document.getElementById('__shadowshelf_blocker__')) return

  const domain = location.hostname.replace(/^www\./, '')
  const isBlocked = blockedDomains.some(d => {
    const bd = d.trim().toLowerCase().replace(/^www\./, '')
    return bd && (domain === bd || domain.endsWith('.' + bd))
  })
  if (!isBlocked) return

  const timerRes = await chrome.runtime.sendMessage({ type: 'GET_TIMER' }).catch(() => null)
  showBlockOverlay(domain, timerRes?.computedRemainingMs ?? 0)
}

function showBlockOverlay(domain: string, remainingMs: number) {
  removeBlockOverlay()

  const el = document.createElement('div')
  el.id = '__shadowshelf_blocker__'
  el.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'background:#0d1117', 'display:flex', 'align-items:center',
    'justify-content:center',
    "font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif",
  ].join(';')

  el.innerHTML = `
<div style="text-align:center;max-width:440px;padding:40px 28px;">
  <div style="font-size:60px;line-height:1;margin-bottom:20px">🔒</div>
  <h1 style="font-size:28px;font-weight:800;color:#f1f5f9;margin:0 0 10px;letter-spacing:-0.03em">
    Focus Mode Active
  </h1>
  <p style="font-size:15px;color:#475569;margin:0 0 6px">
    <span style="color:#94a3b8;font-weight:600">${domain}</span> is blocked during your session.
  </p>
  <p style="font-size:13px;color:#334155;margin:0 0 32px">
    Session ends in <span id="__ss_cd__" style="color:#06b6d4;font-weight:700;font-variant-numeric:tabular-nums">--:--</span>
  </p>
  <div style="display:flex;flex-direction:column;gap:10px">
    <button id="__ss_back__" style="padding:13px;border-radius:12px;border:none;cursor:pointer;background:linear-gradient(135deg,#06b6d4,#0ea5e9);color:#fff;font-size:14px;font-weight:700;font-family:inherit;letter-spacing:-0.01em">
      ← Go Back
    </button>
    <button id="__ss_override__" style="padding:10px 20px;border-radius:10px;cursor:pointer;background:rgba(255,255,255,0.04);color:#475569;border:1px solid rgba(255,255,255,0.08);font-size:12px;font-weight:600;font-family:inherit">
      Access Anyway (5 min)
    </button>
  </div>
  <div style="margin-top:28px;font-size:11px;color:#1e293b">Powered by ShadowShelf</div>
</div>`

  document.documentElement.appendChild(el)

  el.querySelector('#__ss_back__')?.addEventListener('click', () => {
    if (history.length > 1) history.back(); else window.close()
  })
  el.querySelector('#__ss_override__')?.addEventListener('click', () => {
    overrideUntil = Date.now() + 5 * 60_000
    removeBlockOverlay()
  })

  let ms = remainingMs
  const cd = el.querySelector('#__ss_cd__') as HTMLElement
  const tick = setInterval(() => {
    ms = Math.max(0, ms - 1000)
    const m = Math.floor(ms / 60_000)
    const s = Math.floor((ms % 60_000) / 1000)
    if (cd) cd.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    if (ms <= 0) { clearInterval(tick); removeBlockOverlay() }
  }, 1000)
}

// ── Highlight Memory ──────────────────────────────────────────────────────────

let highlightTooltip: HTMLElement | null = null

function removeTooltip() {
  highlightTooltip?.remove()
  highlightTooltip = null
}

document.addEventListener('mouseup', () => {
  if (!highlightEnabled) { removeTooltip(); return }

  const selection = window.getSelection()
  const text = selection?.toString().trim()
  if (!text || text.length < 10) { removeTooltip(); return }

  removeTooltip()

  const range = selection!.getRangeAt(0)
  const rect = range.getBoundingClientRect()

  const tooltip = document.createElement('div')
  tooltip.id = '__shadowshelf_tooltip__'
  tooltip.style.cssText = `
    position: fixed;
    top: ${rect.top + window.scrollY - 42}px;
    left: ${rect.left + rect.width / 2}px;
    transform: translateX(-50%);
    background: #06b6d4;
    color: #fff;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    cursor: pointer;
    z-index: 2147483647;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    white-space: nowrap;
    user-select: none;
  `
  tooltip.textContent = '📌 Save Highlight'
  tooltip.addEventListener('click', async (e) => {
    e.stopPropagation()
    const domain = extractDomain(location.href)
    const category = categorize(location.href, document.title)
    const now = Date.now()
    await chrome.runtime.sendMessage({
      type: 'SAVE_HIGHLIGHT',
      payload: { text, url: location.href, title: document.title, domain, category, timestamp: now, date: localDate(now) },
    })
    tooltip.textContent = '✓ Saved!'
    tooltip.style.background = '#16a34a'
    setTimeout(removeTooltip, 1200)
  })

  document.body.appendChild(tooltip)
  highlightTooltip = tooltip
})

document.addEventListener('mousedown', (e) => {
  if ((e.target as HTMLElement).id !== '__shadowshelf_tooltip__') removeTooltip()
})

// ── Clipboard Detection ───────────────────────────────────────────────────────

const SENSITIVE_PATTERN = /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$|^\d{6}$|password|otp/i
const URL_PATTERN = /^https?:\/\//i
const PHONE_PATTERN = /^[+]?[\d\s\-()]{7,15}$/

document.addEventListener('copy', async () => {
  if (!clipboardEnabled) return
  try {
    await new Promise(r => setTimeout(r, 50))
    const text = await navigator.clipboard.readText()
    if (!text?.trim() || SENSITIVE_PATTERN.test(text)) return

    let type: 'text' | 'url' | 'phone' = 'text'
    if (URL_PATTERN.test(text)) type = 'url'
    else if (PHONE_PATTERN.test(text.trim())) type = 'phone'

    const now = Date.now()
    chrome.runtime.sendMessage({
      type: 'SAVE_CLIPBOARD',
      payload: { content: text.trim(), type, timestamp: now, date: localDate(now) },
    })
  } catch {
    // clipboard access may be denied
  }
})
