import React, { useEffect, useRef, useState } from 'react'
import { getTodayStats } from '../db/db'
import { computeFocusScore, formatDuration } from '../utils/categorize'
import { getDailyQuote } from '../utils/quotes'

interface TimerData {
  running: boolean
  startedAt: number | null
  totalMs: number
  label: string
  computedRemainingMs: number
}

interface Streak { current: number; longest: number }

function fmtMs(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// ── Clock ─────────────────────────────────────────────────────────────────────

function LiveClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id) }, [])
  const time = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const date = t.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  return (
    <div style={{ marginBottom: 36, textAlign: 'center' }}>
      <div style={{ fontSize: 90, fontWeight: 900, letterSpacing: '-0.05em', color: '#f1f5f9', lineHeight: 1, marginBottom: 10, fontVariantNumeric: 'tabular-nums' }}>
        {time}
      </div>
      <div style={{ fontSize: 17, color: '#475569', fontWeight: 500 }}>{date}</div>
    </div>
  )
}

// ── Timer countdown card ──────────────────────────────────────────────────────

function TimerCard({ data, localMs }: { data: TimerData; localMs: number }) {
  const pct = data.totalMs > 0 ? 1 - localMs / data.totalMs : 0
  return (
    <div style={{
      background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.22)',
      borderRadius: 18, padding: '18px 24px', marginBottom: 28, width: '100%', maxWidth: 480,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0891b2' }}>
          ⏱ {data.label} · In Progress
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#67e8f9', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>
          {fmtMs(localMs)}
        </div>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99,
          background: 'linear-gradient(90deg, #06b6d4, #0ea5e9)',
          width: `${Math.min(100, pct * 100)}%`,
          transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '0 0 8px rgba(6,182,212,0.5)',
        }} />
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function NewTab() {
  const [userName,  setUserName]  = useState('')
  const [streak,    setStreak]    = useState<Streak | null>(null)
  const [timer,     setTimer]     = useState<TimerData | null>(null)
  const [localMs,   setLocalMs]   = useState(0)
  const [stats,     setStats]     = useState<{ totalTime: number; focusScore: number } | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const quote = getDailyQuote()

  useEffect(() => {
    chrome.storage.sync.get(['userName'], r => setUserName(r.userName ?? ''))
    chrome.storage.local.get(['focusStreak'], r => setStreak(r.focusStreak ?? null))

    getTodayStats().then(({ totalTime, breakdown }) =>
      setStats({ totalTime, focusScore: computeFocusScore(breakdown) })
    )

    chrome.runtime.sendMessage({ type: 'GET_TIMER' }).then((t: TimerData) => {
      setTimer(t); setLocalMs(t.computedRemainingMs)
    }).catch(() => {})
  }, [])

  // Tick
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    if (timer?.running) {
      const base = { ms: timer.computedRemainingMs, at: Date.now() }
      tickRef.current = setInterval(() => {
        const rem = Math.max(0, base.ms - (Date.now() - base.at))
        setLocalMs(rem)
        if (rem === 0) clearInterval(tickRef.current!)
      }, 500)
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [timer?.running, timer?.startedAt])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const openDashboard = () => chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' })

  const quickStart = async () => {
    await chrome.runtime.sendMessage({ type: 'START_TIMER', totalMs: 25 * 60_000, label: 'Pomodoro' })
    const t: TimerData = await chrome.runtime.sendMessage({ type: 'GET_TIMER' })
    setTimer(t); setLocalMs(t.computedRemainingMs)
  }

  const focusColor = stats
    ? (stats.focusScore >= 70 ? '#10b981' : stats.focusScore >= 40 ? '#06b6d4' : '#f97316')
    : '#06b6d4'

  return (
    <div style={{
      minHeight: '100vh', background: '#0d1117',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', fontFamily: 'Inter, -apple-system, sans-serif',
      padding: '40px 24px', userSelect: 'none',
    }}>

      <LiveClock />

      {/* Greeting + streak */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#94a3b8', marginBottom: 12 }}>
          {greeting}{userName ? `, ${userName}` : ''} 👋
        </div>
        {streak && streak.current > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '7px 18px', borderRadius: 99,
            background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)',
            color: '#fb923c', fontWeight: 700, fontSize: 14,
          }}>
            🔥 {streak.current}-day focus streak
            {streak.longest > streak.current && (
              <span style={{ fontSize: 11, color: '#78350f', fontWeight: 500 }}>
                · best: {streak.longest}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Timer card */}
      {timer?.running && (
        <TimerCard data={timer} localMs={localMs} />
      )}

      {/* Today's stats */}
      {stats && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
          {[
            { icon: '⚡', label: 'Focus Score', value: `${stats.focusScore}`, color: focusColor },
            { icon: '🕐', label: 'Online Today', value: formatDuration(stats.totalTime), color: '#94a3b8' },
          ].map(({ icon, label, value, color }) => (
            <div key={label} style={{
              padding: '14px 22px', borderRadius: 14, textAlign: 'center',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              minWidth: 120,
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Quick start / pause */}
      {!timer?.running ? (
        <button onClick={quickStart} style={{
          padding: '14px 36px', borderRadius: 14, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)', color: '#fff',
          fontSize: 15, fontWeight: 700, fontFamily: 'inherit', letterSpacing: '-0.01em',
          boxShadow: '0 4px 24px rgba(6,182,212,0.35)', marginBottom: 32,
          transition: 'transform 0.1s, box-shadow 0.1s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(6,182,212,0.45)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 24px rgba(6,182,212,0.35)' }}
        >
          ▶ Start 25-min Focus Session
        </button>
      ) : (
        <div style={{ marginBottom: 32, fontSize: 13, color: '#334155' }}>
          Focus session in progress — stay in the zone!
        </div>
      )}

      {/* Quote */}
      <div style={{ textAlign: 'center', maxWidth: 520, marginBottom: 28 }}>
        <p style={{ fontSize: 14, color: '#334155', fontStyle: 'italic', lineHeight: 1.7, margin: '0 0 6px' }}>
          "{quote.text}"
        </p>
        <p style={{ fontSize: 12, color: '#1e293b', fontWeight: 600 }}>— {quote.author}</p>
      </div>

      {/* Footer */}
      <button onClick={openDashboard} style={{
        background: 'none', border: 'none', cursor: 'pointer', color: '#1e293b',
        fontSize: 12, fontFamily: 'inherit', fontWeight: 500,
        transition: 'color 0.15s',
      }}
        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#475569'}
        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = '#1e293b'}
      >
        Open ShadowShelf Dashboard →
      </button>
    </div>
  )
}
