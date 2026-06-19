import { categorize, extractDomain } from '../utils/categorize'

// ── Highlight Memory ──────────────────────────────────────────────────────────

let highlightTooltip: HTMLElement | null = null

function removeTooltip() {
  highlightTooltip?.remove()
  highlightTooltip = null
}

document.addEventListener('mouseup', () => {
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
      payload: {
        text,
        url: location.href,
        title: document.title,
        domain,
        category,
        timestamp: now,
        date: new Date(now).toISOString().slice(0, 10),
      }
    })
    tooltip.textContent = '✓ Saved!'
    tooltip.style.background = '#16a34a'
    setTimeout(removeTooltip, 1200)
  })

  document.body.appendChild(tooltip)
  highlightTooltip = tooltip
})

document.addEventListener('mousedown', (e) => {
  if ((e.target as HTMLElement).id !== '__shadowshelf_tooltip__') {
    removeTooltip()
  }
})

// ── Clipboard Detection ───────────────────────────────────────────────────────

const SENSITIVE_PATTERN = /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$|^\d{6}$|password|otp/i
const URL_PATTERN = /^https?:\/\//i
const PHONE_PATTERN = /^[+]?[\d\s\-()]{7,15}$/

document.addEventListener('copy', async () => {
  try {
    // Small delay so clipboard is populated
    await new Promise(r => setTimeout(r, 50))
    const text = await navigator.clipboard.readText()
    if (!text?.trim() || SENSITIVE_PATTERN.test(text)) return

    let type: 'text' | 'url' | 'phone' = 'text'
    if (URL_PATTERN.test(text)) type = 'url'
    else if (PHONE_PATTERN.test(text.trim())) type = 'phone'

    const now = Date.now()
    chrome.runtime.sendMessage({
      type: 'SAVE_CLIPBOARD',
      payload: {
        content: text.trim(),
        type,
        timestamp: now,
        date: new Date(now).toISOString().slice(0, 10),
      }
    })
  } catch {
    // clipboard access may be denied — silent fail
  }
})
