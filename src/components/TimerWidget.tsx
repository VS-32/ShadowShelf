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

async function playChime() {
  try {
    const ctx = new AudioContext()
    await ctx.resume()
    if (ctx.state !== 'running') return
    const notes = [
      { hz: 392.0, t: 0.00, dur: 0.55 },
      { hz: 493.9, t: 0.18, dur: 0.55 },
      { hz: 587.3, t: 0.36, dur: 0.55 },
      { hz: 784.0, t: 0.54, dur: 1.00 },
    ]
    const master = ctx.createGain()
    master.gain.value = 0.55
    master.connect(ctx.destination)
    for (const { hz, t, dur } of notes) {
      const osc = ctx.createOscillator()
      const env = ctx.createGain()
      osc.type = 'sine'; osc.frequency.value = hz
      osc.connect(env); env.connect(master)
      const osc2 = ctx.createOscillator()
      const env2 = ctx.createGain()
      osc2.type = 'sine'; osc2.frequency.value = hz * 2
      osc2.connect(env2); env2.connect(master)
      const at = ctx.currentTime + t
      env.gain.setValueAtTime(0, at)
      env.gain.linearRampToValueAtTime(0.45, at + 0.012)
      env.gain.exponentialRampToValueAtTime(0.001, at + dur)
      env2.gain.setValueAtTime(0, at)
      env2.gain.linearRampToValueAtTime(0.10, at + 0.012)
      env2.gain.exponentialRampToValueAtTime(0.001, at + dur * 0.4)
      osc.start(at);  osc.stop(at + dur + 0.05)
      osc2.start(at); osc2.stop(at + dur * 0.4 + 0.05)
    }
  } catch { /* audio unavailable */ }
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
  const chimeFiredRef = useRef(false)

  const sync = async () => {
    const res: TimerData = await chrome.runtime.sendMessage({ type: 'GET_TIMER' })
    setData(res)
    setLocalMs(res.computedRemainingMs)
    return res
  }

  useEffect(() => {
    sync()

    const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local') return
      if (changes.timerCompleted) {
        // Alarm fired — play sound immediately, then sync to update visual
        if (!chimeFiredRef.current) {
          chimeFiredRef.current = true
          playChime()
          setTimeout(() => { chimeFiredRef.current = false }, 3000)
        }
        sync()
      }
    }
    chrome.storage.onChanged.addListener(handler)
    return () => chrome.storage.onChanged.removeListener(handler)
  }, [])

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

  const total   = data?.totalMs ?? 25 * 60_000
  const pct     = total > 0 ? Math.max(0, 1 - localMs / total) : 0
  // done: timer reached 0 AND is not running (alarm has fired)
  const done    = localMs === 0 && total > 0 && !data?.running
  const running = data?.running ?? false

  // When done and it's a fresh detection (popup opened to already-completed state), play chime
  const prevDoneRef = useRef(false)
  useEffect(() => {
    if (done && !prevDoneRef.current && !chimeFiredRef.current) {
      chimeFiredRef.current = true
      playChime()
      setTimeout(() => { chimeFiredRef.current = false }, 3000)
    }
    prevDoneRef.current = done
  }, [done])

  // Always pass totalMs when restarting so SW doesn't use stale remainingMs=0
  const start = async (ms?: number, label?: string) => {
    const totalMs = ms ?? data?.totalMs ?? 25 * 60_000
    const lbl = label ?? data?.label ?? 'Focus'
    await chrome.runtime.sendMessage({ type: 'START_TIMER', totalMs, label: lbl })
    await sync()
  }
  const pause = async () => { await chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' }); await sync() }
  const reset = async () => { await chrome.runtime.sendMessage({ type: 'RESET_TIMER' }); await sync() }
  const setPreset = async (ms: number, label: string) => {
    await chrome.runtime.sendMessage({ type: 'SET_TIMER_DURATION', totalMs: ms, label })
    await sync()
  }

  if (!data) return null

  return (
    <div style={{
      background: 'rgba(6,182,212,0.07)',
      border: '1px solid rgba(6,182,212,0.18)',
      borderRadius: 14, padding: '12px 14px', marginBottom: 14,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#0891b2', marginBottom: 10 }}>
        ⏱ {done ? '✅ Complete!' : running ? `${data.label} Timer` : 'Focus Timer'}
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
          {/* Preset pills — show when not running and not done */}
          {!running && !done && (
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
                background: done
                  ? 'linear-gradient(135deg,#10b981,#34d399)'
                  : running
                    ? 'rgba(249,115,22,0.2)'
                    : 'linear-gradient(135deg,#06b6d4,#0ea5e9)',
                color: running ? '#fb923c' : '#fff',
                boxShadow: done ? '0 2px 8px rgba(16,185,129,0.3)' : running ? 'none' : '0 2px 8px rgba(6,182,212,0.3)',
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
