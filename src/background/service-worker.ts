import { db, pruneOldData } from '../db/db'
import { categorize, extractDomain, computeFocusScore } from '../utils/categorize'
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

function localDateStr(ms?: number) {
  const d = ms !== undefined ? new Date(ms) : new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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
      // Only restore if a concurrent event handler hasn't already started a fresh session
      if (!activeSession) {
        activeSession = { ...prev, startTime: now }
      }
    }
  } catch { /* chrome.storage.session not available (Chrome < 102) */ }
}

// ── Visit persistence ─────────────────────────────────────────────────────────

async function commitVisit(session: Session, endTime: number) {
  const duration = Math.round((endTime - session.startTime) / 1000)
  if (duration < 3) return
  const domain   = extractDomain(session.url)
  const category = categorize(session.url, session.title)
  const date     = localDateStr(session.startTime)
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
  const res = await chrome.storage.sync.get('breakIntervalMin')
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
  if (id === 'daily-recap' || id === 'weekly-recap') {
    if (btn === 0) chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/index.html') })
  }
  if (id === 'timer-done') {
    if (btn === 0) {
      // 5-min break
      timer = { running: true, startedAt: Date.now(), remainingMs: 5 * 60_000, totalMs: 5 * 60_000, label: 'Break' }
      scheduleTimerAlarm(5 * 60_000)
      updateTimerBadge()
    } else {
      // Go again — restart same duration
      timer = { running: true, startedAt: Date.now(), remainingMs: timer.totalMs, totalMs: timer.totalMs, label: timer.label }
      scheduleTimerAlarm(timer.totalMs)
      updateTimerBadge()
    }
    chrome.storage.local.set({ timerRunning: true })
  }
  await persistState()
})

// ── Streak tracking ───────────────────────────────────────────────────────────

async function updateStreak() {
  const today = localDateStr()
  const res = await chrome.storage.local.get('focusStreak')
  const s = res.focusStreak ?? { current: 0, longest: 0, lastDate: '' }
  if (s.lastDate === today) return
  const yesterday = localDateStr(Date.now() - 86400_000)
  s.current = s.lastDate === yesterday ? s.current + 1 : 1
  s.lastDate = today
  s.longest = Math.max(s.longest, s.current)
  await chrome.storage.local.set({ focusStreak: s })
  if ([3, 7, 14, 30, 60, 100].includes(s.current)) {
    chrome.notifications.create('streak-milestone', {
      type: 'basic', iconUrl: 'icons/icon48.png',
      title: `🔥 ${s.current}-Day Streak!`,
      message: `Amazing! You've had focus sessions ${s.current} days in a row. Keep it up!`,
      priority: 1,
    })
  }
}

// ── Category time limits ──────────────────────────────────────────────────────

async function checkTimeLimits() {
  const today = localDateStr()
  const [syncRes, localRes] = await Promise.all([
    chrome.storage.sync.get('categoryLimits'),
    chrome.storage.local.get('timeLimitState'),
  ])
  const limits: Record<string, number> = syncRes.categoryLimits ?? {}
  if (!Object.keys(limits).length) return

  let state = localRes.timeLimitState ?? {}
  if (state.date !== today) state = { date: today, notified: {} }

  const visits = await db.visits.where('date').equals(today).toArray()
  const usage: Record<string, number> = {}
  for (const v of visits) usage[v.category] = (usage[v.category] ?? 0) + v.duration

  let changed = false
  for (const [cat, limitMin] of Object.entries(limits) as [string, number][]) {
    if (!limitMin) continue
    const usedSec = usage[cat] ?? 0
    const limitSec = limitMin * 60
    const pct = usedSec / limitSec
    if (pct >= 1 && !state.notified?.[cat + '100']) {
      state.notified = { ...state.notified, [cat + '100']: true }; changed = true
      chrome.notifications.create(`limit-${cat}`, {
        type: 'basic', iconUrl: 'icons/icon48.png',
        title: `⏰ Daily Limit Reached`,
        message: `You've used all ${limitMin} minutes of your daily ${cat} limit.`,
        priority: 2,
      })
    } else if (pct >= 0.8 && !state.notified?.[cat + '80']) {
      state.notified = { ...state.notified, [cat + '80']: true }; changed = true
      chrome.notifications.create(`limit-warn-${cat}`, {
        type: 'basic', iconUrl: 'icons/icon48.png',
        title: `⚠️ Nearing ${cat} Limit`,
        message: `You've used ${Math.round(usedSec / 60)} of ${limitMin} min today in ${cat}.`,
        priority: 1,
      })
    }
  }
  if (changed) await chrome.storage.local.set({ timeLimitState: state })
}

// ── All-time records ──────────────────────────────────────────────────────────

async function updateAllTimeRecords(focusScore: number, totalSec: number) {
  const today = localDateStr()
  const res = await chrome.storage.local.get(['allTimeRecords', 'focusStreak'])
  const streak = res.focusStreak?.current ?? 0
  const r = res.allTimeRecords ?? { longestStreak: 0, highestFocusScore: 0, mostProductiveSec: 0, mostProductiveDay: '' }
  let changed = false
  if (streak > r.longestStreak)             { r.longestStreak = streak;       changed = true }
  if (focusScore > r.highestFocusScore)     { r.highestFocusScore = focusScore; changed = true }
  if (totalSec  > r.mostProductiveSec)      { r.mostProductiveSec = totalSec; r.mostProductiveDay = today; changed = true }
  if (changed) await chrome.storage.local.set({ allTimeRecords: r })
}

// ── Daily focus goal ──────────────────────────────────────────────────────────

async function checkDailyGoal() {
  const [syncRes, localRes] = await Promise.all([
    chrome.storage.sync.get('dailyFocusGoal'),
    chrome.storage.local.get('dailyGoalState'),
  ])
  const goal = syncRes.dailyFocusGoal ?? 0
  if (!goal) return

  const todayStr = localDateStr()
  const state = localRes.dailyGoalState ?? {}
  if (state.date === todayStr && state.notified) return

  const visits = await db.visits.where('date').equals(todayStr).toArray()
  const breakdown: Record<string, number> = {}
  for (const v of visits) breakdown[v.category] = (breakdown[v.category] ?? 0) + v.duration
  const score = computeFocusScore(breakdown)

  if (score >= goal) {
    await chrome.storage.local.set({ dailyGoalState: { date: todayStr, notified: true } })
    chrome.notifications.create('daily-goal', {
      type: 'basic', iconUrl: 'icons/icon48.png',
      title: '🎯 Daily Goal Achieved!',
      message: `Focus score ${score} — you hit your daily target of ${goal}! Outstanding.`,
      priority: 2,
    })
  }
}

// ── Daily recap ───────────────────────────────────────────────────────────────

async function sendDailyRecap() {
  const hour = new Date().getHours()
  if (hour < 20 || hour > 22) return  // 8–10 pm window

  const [localRes, syncRes] = await Promise.all([
    chrome.storage.local.get('lastDailyRecap'),
    chrome.storage.sync.get('dailyRecapEnabled'),
  ])
  if (syncRes.dailyRecapEnabled === false) return
  const todayStr = localDateStr()
  if (localRes.lastDailyRecap === todayStr) return

  const visits = await db.visits.where('date').equals(todayStr).toArray()
  if (!visits.length) return

  const totalSec = visits.reduce((s, v) => s + v.duration, 0)
  const breakdown: Record<string, number> = {}
  for (const v of visits) breakdown[v.category] = (breakdown[v.category] ?? 0) + v.duration
  const score = computeFocusScore(breakdown)

  await updateAllTimeRecords(score, totalSec)
  await chrome.storage.local.set({ lastDailyRecap: todayStr })

  const hrs = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
  const mood = score >= 70 ? '🎯 Excellent focus today!'
    : score >= 40 ? '💪 Solid effort!'
    : '🌱 Tomorrow is a fresh start!'
  chrome.notifications.create('daily-recap', {
    type: 'basic', iconUrl: 'icons/icon48.png',
    title: `🌙 Today: ${timeStr} online · Score ${score}`,
    message: mood,
    priority: 1,
    buttons: [{ title: 'Open Dashboard' }],
  })
}

// ── Weekly recap ──────────────────────────────────────────────────────────────

async function sendWeeklyRecap() {
  if (new Date().getDay() !== 0) return  // Sundays only

  const [localRes, syncRes] = await Promise.all([
    chrome.storage.local.get(['lastWeeklyRecap', 'focusStreak']),
    chrome.storage.sync.get('weeklyRecapEnabled'),
  ])
  if (syncRes.weeklyRecapEnabled === false) return
  if (localRes.lastWeeklyRecap === localDateStr()) return

  const days: string[] = []
  for (let i = 6; i >= 0; i--) days.push(localDateStr(Date.now() - i * 86400_000))
  const visits = await db.visits.where('date').anyOf(days).toArray()
  if (!visits.length) return

  const totalSec = visits.reduce((s, v) => s + v.duration, 0)
  const breakdown: Record<string, number> = {}
  for (const v of visits) breakdown[v.category] = (breakdown[v.category] ?? 0) + v.duration
  const score = computeFocusScore(breakdown)
  const streak = localRes.focusStreak?.current ?? 0
  const hrs = Math.round(totalSec / 3600)

  await chrome.storage.local.set({ lastWeeklyRecap: localDateStr() })
  chrome.notifications.create('weekly-recap', {
    type: 'basic', iconUrl: 'icons/icon48.png',
    title: '📊 Your Week in Review',
    message: `${hrs}h online · Focus Score ${score}${streak > 0 ? ` · 🔥 ${streak}-day streak` : ' · Start a streak this week!'}`,
    priority: 1,
    buttons: [{ title: 'Open Dashboard' }],
  })
}

// ── Timer helpers ─────────────────────────────────────────────────────────────

function scheduleTimerAlarm(ms: number) {
  chrome.alarms.clear('timer-complete')
  if (ms > 0) chrome.alarms.create('timer-complete', { delayInMinutes: ms / 60_000 })
}

function updateTimerBadge() {
  if (!timer.running) return
  const remaining = timerRemainingMs()
  const min = Math.ceil(remaining / 60_000)
  chrome.action.setBadgeText({ text: min > 0 ? `${min}m` : '' })
  chrome.action.setBadgeBackgroundColor({ color: '#06b6d4' })
}

async function incrementSessionCount() {
  const today = localDateStr()
  const res = await chrome.storage.local.get('timerSessions')
  const sessions: Record<string, number> = res.timerSessions ?? {}
  sessions[today] = (sessions[today] ?? 0) + 1
  await chrome.storage.local.set({ timerSessions: sessions })
}

async function playTimerSound() {
  const offscreen = (chrome as unknown as Record<string, any>).offscreen
  if (!offscreen) return
  try {
    await offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Focus session completion chime',
    })
  } catch { /* already open */ }
  chrome.runtime.sendMessage({ type: 'PLAY_TIMER_SOUND' }).catch(() => {})
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

// Alarms persist across service worker restarts — only create them once.
// Recreating them on every SW wake-up resets their timers (breaking the heartbeat).
async function ensureAlarms() {
  const existing = await chrome.alarms.getAll()
  const names = new Set(existing.map(a => a.name))
  if (!names.has('heartbeat'))   chrome.alarms.create('heartbeat',   { periodInMinutes: 0.5  })
  if (!names.has('break-check')) chrome.alarms.create('break-check', { periodInMinutes: 1    })
  if (!names.has('daily-prune')) chrome.alarms.create('daily-prune', { periodInMinutes: 1440 })
}

chrome.runtime.onInstalled.addListener(ensureAlarms)
chrome.runtime.onStartup.addListener(ensureAlarms)

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'heartbeat') {
    if (activeSession) {
      const now = Date.now()
      await commitVisit(activeSession, now)
      activeSession = { ...activeSession, startTime: now }
      await persistState()
    }
    updateTimerBadge()
  }

  if (alarm.name === 'break-check') {
    await checkBreak()
    try { await checkTimeLimits() }  catch { /* non-critical */ }
    try { await checkDailyGoal() }   catch { /* non-critical */ }
    try { await sendDailyRecap() }   catch { /* non-critical */ }
  }

  if (alarm.name === 'daily-prune') {
    const today = new Date().toISOString().slice(0, 10)
    if (lastPruneDate === today) return
    const res = await chrome.storage.sync.get('retentionDays')
    await pruneOldData(res.retentionDays ?? 30)
    lastPruneDate = today
    await persistState()
    try { await sendWeeklyRecap() } catch { /* non-critical */ }
  }

  if (alarm.name === 'timer-complete') {
    const completedLabel = timer.label
    const completedMin   = Math.round(timer.totalMs / 60_000)
    timer = { ...timer, running: false, startedAt: null, remainingMs: 0 }
    await persistState()
    await incrementSessionCount()
    try { if (timer.totalMs >= 10 * 60_000) await updateStreak() } catch { /* non-critical */ }
    await chrome.storage.local.set({ timerCompleted: Date.now(), timerRunning: false })
    await playTimerSound()
    chrome.notifications.create('timer-done', {
      type: 'basic', iconUrl: 'icons/icon48.png',
      title: `✅ ${completedLabel} Complete!`,
      message: `Excellent! You stayed focused for ${completedMin} minute${completedMin !== 1 ? 's' : ''}. Time for a well-earned break.`,
      priority: 2,
      buttons: [{ title: '☕ 5-min break' }, { title: '🔁 Go again' }],
    })
    chrome.action.setBadgeText({ text: '✓' })
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' })
  }
})

// ── Messages ──────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'OFFSCREEN_DONE') {
    const offscreen = (chrome as unknown as Record<string, any>).offscreen
    offscreen?.closeDocument().catch(() => {})
    return
  }
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
    if (msg.totalMs) {
      timer.totalMs     = msg.totalMs
      timer.remainingMs = msg.totalMs
    } else if (timer.remainingMs === 0) {
      // Called with no args after completion — restart from full duration
      timer.remainingMs = timer.totalMs
    }
    if (msg.label) timer.label = msg.label
    timer.running   = true
    timer.startedAt = Date.now()
    scheduleTimerAlarm(timerRemainingMs())
    updateTimerBadge()
    chrome.storage.local.set({ timerRunning: true })
    persistState(); sendResponse({ ok: true })
    return true
  }
  if (msg.type === 'PAUSE_TIMER') {
    timer.remainingMs = timerRemainingMs()
    timer.running   = false
    timer.startedAt = null
    chrome.alarms.clear('timer-complete')
    chrome.action.setBadgeText({ text: '' })
    chrome.storage.local.set({ timerRunning: false })
    persistState(); sendResponse({ ok: true })
    return true
  }
  if (msg.type === 'RESET_TIMER') {
    timer.remainingMs = timer.totalMs
    timer.running   = false
    timer.startedAt = null
    chrome.alarms.clear('timer-complete')
    chrome.action.setBadgeText({ text: '' })
    chrome.storage.local.set({ timerRunning: false })
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
