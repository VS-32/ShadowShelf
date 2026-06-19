import React, { useEffect, useRef, useState } from 'react'

interface TimerData {
  running: boolean
  startedAt: number | null
  remainingMs: number
  totalMs: number
  label: string
  computedRemainingMs: number
}

const PRESETS = [
  { label: 'Pomodoro', ms: 25 * 60_000 },
  { label: 'Focus',    ms: 45 * 60_000 },
  { label: 'Deep',     ms: 90 * 60_000 },
]

function fmt(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function Ring({ pct, done, size = 80 }: { pct: number; done: boolean; size?: number }) {
  const r = size / 2 - 6
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct)
  const color = done ? '#10b981' : '#06b6d4'
  const color2 = done ? '#34d399' : '#0ea5e9'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="tring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={pct > 0 ? 'url(#tring)' : 'rgba(255,255,255,0.05)'} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  )
}

export default function TimerWidget() {
  const [data, setData] = useState<TimerData | null>(null)
  const [localMs, setLocalMs] = useState<number>(25 * 60_000)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sync = async () => {
    const res: TimerData = await chrome.runtime.sendMessage({ type: 'GET_TIMER' })
    setData(res)
    setLocalMs(res.computedRemainingMs)
    return res
  }

  useEffect(() => { sync() }, [])

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    if (data?.running) {
      const base = { ms: data.computedRemainingMs, at: Date.now() }
      tickRef.current = setInterval(() => {
        const elapsed = Date.now() - base.at
        const remaining = Math.max(0, base.ms - elapsed)
        setLocalMs(remaining)
        if (remaining === 0) {
          clearInterval(tickRef.current!)
          sync()
        }
      }, 500)
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [data?.running, data?.startedAt])

  const total = data?.totalMs ?? 25 * 60_000
  const pct   = total > 0 ? Math.max(0, 1 - localMs / total) : 0
  const done  = localMs === 0 && total > 0

  const start = async (ms?: number, label?: string) => {
    await chrome.runtime.sendMessage({ type: 'START_TIMER', totalMs: ms, label })
    await sync()
  }
  const pause = async () => { await chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' }); await sync() }
  const reset = async () => { await chrome.runtime.sendMessage({ type: 'RESET_TIMER' }); await sync() }
  const setPreset = async (ms: number, label: string) => {
    await chrome.runtime.sendMessage({ type: 'SET_TIMER_DURATION', totalMs: ms, label })
    await sync()
  }

  if (!data) return null

  const running = data.running

  return (
    <div style={{
      background: 'rgba(6,182,212,0.07)',
      border: '1px solid rgba(6,182,212,0.18)',
      borderRadius: 14, padding: '12px 14px', marginBottom: 14,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#0891b2', marginBottom: 10 }}>
        ⏱ {done ? 'Complete!' : running ? `${data.label} Timer` : 'Focus Timer'}
      </div>

      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Ring pct={pct} done={done} size={72} />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontSize: 13, fontWeight: 800, color: done ? '#10b981' : '#f1f5f9',
              fontFamily: 'monospace', letterSpacing: '-0.5px',
            }}>{done ? '✓' : fmt(localMs)}</span>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {/* Preset pills — show when not running */}
          {!running && (
            <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' as const }}>
              {PRESETS.map(p => (
                <button key={p.label} onClick={() => setPreset(p.ms, p.label)} style={{
                  padding: '3px 9px', borderRadius: 99, border: 'none', cursor: 'pointer',
                  fontFamily: 'Inter,sans-serif', fontSize: 10, fontWeight: 700,
                  background: data.totalMs === p.ms ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.06)',
                  color: data.totalMs === p.ms ? '#67e8f9' : '#64748b',
                  transition: 'all 0.15s',
                }}>
                  {p.label} · {p.ms / 60_000}m
                </button>
              ))}
            </div>
          )}

          {/* Controls */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => running ? pause() : start()}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 700,
                background: running ? 'rgba(249,115,22,0.2)' : 'linear-gradient(135deg,#06b6d4,#0ea5e9)',
                color: running ? '#fb923c' : '#fff',
                boxShadow: running ? 'none' : '0 2px 8px rgba(6,182,212,0.3)',
                transition: 'all 0.15s',
              }}
            >
              {running ? '⏸ Pause' : done ? '↺ Again' : '▶ Start'}
            </button>
            <button onClick={reset} style={{
              padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)', color: '#475569',
              fontSize: 13, cursor: 'pointer', fontFamily: 'Inter,sans-serif',
              transition: 'all 0.15s',
            }}>↺</button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {(running || pct > 0) && (
        <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 99, marginTop: 10, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99,
            background: done ? 'linear-gradient(90deg,#10b981,#34d399)' : 'linear-gradient(90deg,#06b6d4,#0ea5e9)',
            width: `${pct * 100}%`,
            transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)',
          }} />
        </div>
      )}
    </div>
  )
}
