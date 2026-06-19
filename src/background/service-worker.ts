import { db, pruneOldData } from '../db/db'
import { categorize, extractDomain } from '../utils/categorize'
import type { PageVisit } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Session {
  tabId: number
  url: string
  title: string
  startTime: number
}

interface TimerState {
  running: boolean
  startedAt: number | null   // epoch ms when last resumed
  remainingMs: number        // ms left when paused/created
  totalMs: number            // original full duration
  label: string
}

// ── In-memory state (always persisted to chrome.storage.session) ──────────────

let activeSession: Session | null = null
let continuousStart: number | null = null
let lastActivity: number = Date.now()
let breakNotified = false
let lastPruneDate = ''

let timer: TimerState = {
  running: false,
  startedAt: null,
  remainingMs: 25 * 60_000,
  totalMs: 25 * 60_000,
  label: 'Focus',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timerRemainingMs(): number {
  if (!timer.running || timer.startedAt === null) return timer.remainingMs
  return Math.max(0, timer.remainingMs - (Date.now() - timer.startedAt))
}

function isTrackable(url: string) {
  return Boolean(url)
    && !url.startsWith('chrome://')
    && !url.startsWith('chrome-extension://')
    && !url.startsWith('about:')
    && !url.startsWith('edge://')
}

// ── State persistence ─────────────────────────────────────────────────────────

async function persistState() {
  await chrome.storage.session.set({
    activeSession,
    continuousStart,
    lastActivity,
    breakNotified,
    lastPruneDate,
    timer,
  })
}

async function recoverState() {
  try {
    const s = await chrome.storage.session.get([
      'activeSession', 'continuousStart', 'lastActivity',
      'breakNotified', 'lastPruneDate', 'timer',
    ])

    if (s.lastActivity)    lastActivity    = s.lastActivity
    if (s.breakNotified)   breakNotified   = s.breakNotified
    if (s.lastPruneDate)   lastPruneDate   = s.lastPruneDate
    if (s.continuousStart) continuousStart = s.continuousStart
    if (s.timer)           timer           = s.timer

    // Flush uncommitted session time
    if (s.activeSession) {
      const prev: Session = s.activeSession
      const now = Date.now()
      if (Math.round((now - prev.startTime) / 1000) >= 3) {
        await commitVisit(prev, now)
      }
      activeSession = { ...prev, startTime: now }
    }
  } catch { /* chrome.storage.session not available (Chrome < 102) */ }
}

// ── Visit persistence ─────────────────────────────────────────────────────────

async function commitVisit(session: Session, endTime: number) {
  const duration = Math.round((endTime - session.startTime) / 1000)
  if (duration < 3) return
  const domain   = extractDomain(session.url)
  const category = categorize(session.url, session.title)
  const date     = new Date(session.startTime).toISOString().slice(0, 10)
  const visit: PageVisit = { url: session.url, title: session.title, domain, category, startTime: session.startTime, endTime, duration, date }
  await db.visits.add(visit)
  markActivity()
}

async function endActiveSession() {
  if (!activeSession) return
  await commitVisit(activeSession, Date.now())
  activeSession = null
  await persistState()
}

function startSession(tabId: number, url: string, title: string) {
  activeSession = { tabId, url, title, startTime: Date.now() }
  persistState()
}

// ── Activity & break tracking ─────────────────────────────────────────────────

function markActivity() {
  const now = Date.now()
  if (continuousStart && now - lastActivity > 300_000) {
    continuousStart = null
    breakNotified   = false
    chrome.action.setBadgeText({ text: '' })
  }
  lastActivity = now
  if (!continuousStart) continuousStart = now
}

async function checkBreak() {
  if (!continuousStart) return
  const res = await chrome.storage.local.get('breakIntervalMin')
  const intervalMs = (res.breakIntervalMin ?? 0) * 60_000
  if (!intervalMs) return
  const elapsed = Date.now() - continuousStart
  if (elapsed >= intervalMs && !breakNotified) {
    breakNotified = true
    await persistState()
    const min = Math.round(elapsed / 60_000)
    chrome.notifications.create('break-reminder', {
      type: 'basic', iconUrl: 'icons/icon48.png',
      title: '🧘 Need a Break?',
      message: `You've been browsing for ${min} minutes. A 5-minute break will sharpen your focus.`,
      priority: 2,
      buttons: [{ title: "Take a break now" }, { title: "Snooze 15 min" }],
    })
    chrome.action.setBadgeText({ text: '!' })
    chrome.action.setBadgeBackgroundColor({ color: '#f97316' })
  }
}

chrome.notifications.onButtonClicked.addListener(async (id, btn) => {
  chrome.notifications.clear(id)
  chrome.action.setBadgeText({ text: '' })
  if (id === 'break-reminder') {
    if (btn === 0) { continuousStart = null; breakNotified = false; chrome.storage.local.set({ breakTakenAt: Date.now() }) }
    else { continuousStart = Date.now() - 15 * 60_000; breakNotified = false }
  }
  if (id === 'timer-done') {
    timer.remainingMs = timer.totalMs; timer.running = false; timer.startedAt = null
  }
  await persistState()
})

// ── Timer helpers ─────────────────────────────────────────────────────────────

function scheduleTimerAlarm(ms: number) {
  chrome.alarms.clear('timer-complete')
  if (ms > 0) chrome.alarms.create('timer-complete', { delayInMinutes: ms / 60_000 })
}

// ── Tab / window events ───────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await endActiveSession()
  const tab = await chrome.tabs.get(tabId).catch(() => null)
  if (tab?.url && isTrackable(tab.url)) startSession(tabId, tab.url, tab.title ?? '')
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (active?.id !== tabId) return
  await endActiveSession()
  if (tab.url && isTrackable(tab.url)) startSession(tabId, tab.url, tab.title ?? '')
})

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await endActiveSession()
  } else {
    const [tab] = await chrome.tabs.query({ active: true, windowId })
    if (tab?.url && isTrackable(tab.url)) startSession(tab.id!, tab.url, tab.title ?? '')
  }
})

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (activeSession?.tabId === tabId) await endActiveSession()
})

// ── Idle detection ────────────────────────────────────────────────────────────

chrome.idle.setDetectionInterval(300)
chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === 'idle' || state === 'locked') {
    await endActiveSession()
    continuousStart = null; breakNotified = false
    chrome.action.setBadgeText({ text: '' })
    await persistState()
  } else if (state === 'active') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.url && isTrackable(tab.url)) startSession(tab.id!, tab.url, tab.title ?? '')
    if (!continuousStart) { continuousStart = Date.now(); await persistState() }
  }
})

// ── Alarms ────────────────────────────────────────────────────────────────────

chrome.alarms.create('heartbeat',   { periodInMinutes: 0.5 })
chrome.alarms.create('break-check', { periodInMinutes: 1   })
chrome.alarms.create('daily-prune', { periodInMinutes: 1440 })

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'heartbeat' && activeSession) {
    const now = Date.now()
    await commitVisit(activeSession, now)
    activeSession = { ...activeSession, startTime: now }
    await persistState()
  }

  if (alarm.name === 'break-check') await checkBreak()

  if (alarm.name === 'daily-prune') {
    const today = new Date().toISOString().slice(0, 10)
    if (lastPruneDate === today) return
    const res = await chrome.storage.local.get('retentionDays')
    await pruneOldData(res.retentionDays ?? 30)
    lastPruneDate = today
    await persistState()
  }

  if (alarm.name === 'timer-complete') {
    timer = { ...timer, running: false, startedAt: null, remainingMs: 0 }
    await persistState()
    chrome.notifications.create('timer-done', {
      type: 'basic', iconUrl: 'icons/icon48.png',
      title: `⏱ ${timer.label} Complete!`,
      message: 'Great focus session! Time to take a short break.',
      priority: 2,
      buttons: [{ title: 'Start a break' }],
    })
    chrome.action.setBadgeText({ text: '✓' })
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' })
  }
})

// ── Messages ──────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SAVE_HIGHLIGHT') {
    db.highlights.add(msg.payload).then(() => sendResponse({ ok: true })); return true
  }
  if (msg.type === 'SAVE_CLIPBOARD') {
    db.clipboard.add(msg.payload).then(() => sendResponse({ ok: true })); return true
  }
  if (msg.type === 'OPEN_DASHBOARD') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/index.html') })
    sendResponse({ ok: true })
  }

  // ── Break ──
  if (msg.type === 'GET_BREAK_STATUS') {
    sendResponse({ elapsed: continuousStart ? Date.now() - continuousStart : 0, breakNotified })
    return true
  }
  if (msg.type === 'TAKE_BREAK') {
    continuousStart = null; breakNotified = false
    chrome.action.setBadgeText({ text: '' })
    chrome.notifications.clear('break-reminder')
    chrome.storage.local.set({ breakTakenAt: Date.now() })
    persistState(); sendResponse({ ok: true })
  }

  // ── Timer ──
  if (msg.type === 'GET_TIMER') {
    sendResponse({ ...timer, computedRemainingMs: timerRemainingMs() })
    return true
  }
  if (msg.type === 'START_TIMER') {
    if (msg.totalMs) { timer.totalMs = msg.totalMs; timer.remainingMs = msg.totalMs }
    if (msg.label)   timer.label = msg.label
    timer.running   = true
    timer.startedAt = Date.now()
    scheduleTimerAlarm(timerRemainingMs())
    persistState(); sendResponse({ ok: true })
    return true
  }
  if (msg.type === 'PAUSE_TIMER') {
    timer.remainingMs = timerRemainingMs()
    timer.running   = false
    timer.startedAt = null
    chrome.alarms.clear('timer-complete')
    persistState(); sendResponse({ ok: true })
    return true
  }
  if (msg.type === 'RESET_TIMER') {
    timer.remainingMs = timer.totalMs
    timer.running   = false
    timer.startedAt = null
    chrome.alarms.clear('timer-complete')
    chrome.action.setBadgeText({ text: '' })
    persistState(); sendResponse({ ok: true })
    return true
  }
  if (msg.type === 'SET_TIMER_DURATION') {
    timer.totalMs     = msg.totalMs
    timer.remainingMs = msg.totalMs
    timer.label       = msg.label ?? 'Focus'
    timer.running     = false
    timer.startedAt   = null
    chrome.alarms.clear('timer-complete')
    persistState(); sendResponse({ ok: true })
    return true
  }
})

// ── Startup recovery ──────────────────────────────────────────────────────────
recoverState()
