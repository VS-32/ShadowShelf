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
  { label: 'Pomodoro',    ms: 25 * 60_000, desc: '25 min focus block' },
  { label: 'Short Focus', ms: 45 * 60_000, desc: '45 min session' },
  { label: 'Deep Work',   ms: 90 * 60_000, desc: '90 min deep focus' },
  { label: 'Power Hour',  ms: 60 * 60_000, desc: '60 min power session' },
]

const QUICK = [5, 10, 15, 20, 25, 30, 45, 60, 90]

function fmt(ms: number, long = false) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  if (long) {
    if (m >= 60) return `${Math.floor(m/60)}h ${m%60}m`
    return `${m}m ${s}s`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function BigRing({ pct, done, ms }: { pct: number; done: boolean; ms: number }) {
  const size = 240, r = 102, stroke = 12
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.max(0, Math.min(1, pct)))
  const color  = done ? '#10b981' : '#06b6d4'
  const color2 = done ? '#34d399' : '#0ea5e9'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id="big-ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
        <filter id="big-glow">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Track */}
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
      {/* Progress */}
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={pct > 0 ? 'url(#big-ring)' : 'rgba(255,255,255,0.05)'}
        strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        filter={pct > 0 ? 'url(#big-glow)' : undefined}
        style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)' }}
      />
      {/* Time text */}
      <text x={size/2} y={size/2 - 10} textAnchor="middle"
        fill={done ? '#10b981' : '#f1f5f9'} fontSize="42" fontWeight="800"
        fontFamily="Inter,monospace" letterSpacing="-2">
        {done ? '✓' : fmt(ms)}
      </text>
      <text x={size/2} y={size/2 + 18} textAnchor="middle" fill="#475569" fontSize="13" fontWeight="500" fontFamily="Inter,sans-serif">
        {done ? 'Session complete!' : ms === 0 ? 'Ready' : pct > 0 ? 'remaining' : 'set duration'}
      </text>
    </svg>
  )
}

export default function TimerTab() {
  const [data, setData] = useState<TimerData | null>(null)
  const [localMs, setLocalMs] = useState(25 * 60_000)
  const [customMin, setCustomMin] = useState('')
  const [sessionsToday, setSessionsToday] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sync = async () => {
    const res: TimerData = await chrome.runtime.sendMessage({ type: 'GET_TIMER' })
    setData(res)
    setLocalMs(res.computedRemainingMs)
    return res
  }

  useEffect(() => {
    sync()
    chrome.storage.local.get('timerSessions', r => {
      const today = new Date().toISOString().slice(0, 10)
      setSessionsToday((r.timerSessions ?? {})[today] ?? 0)
    })
  }, [])

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    if (data?.running) {
      const base = { ms: data.computedRemainingMs, at: Date.now() }
      tickRef.current = setInterval(() => {
        const elapsed = Date.now() - base.at
        const remaining = Math.max(0, base.ms - elapsed)
        setLocalMs(remaining)
        if (remaining === 0) { clearInterval(tickRef.current!); sync() }
      }, 250)
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [data?.running, data?.startedAt])

  const total   = data?.totalMs ?? 25 * 60_000
  const pct     = total > 0 ? Math.max(0, 1 - localMs / total) : 0
  const done    = localMs === 0 && total > 0 && !data?.running
  const running = data?.running ?? false

  const start = async (ms?: number, label?: string) => {
    await chrome.runtime.sendMessage({ type: 'START_TIMER', totalMs: ms, label })
    await sync()
  }
  const pause  = async () => { await chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' }); await sync() }
  const reset  = async () => { await chrome.runtime.sendMessage({ type: 'RESET_TIMER' }); await sync() }
  const setDur = async (ms: number, label: string) => {
    await chrome.runtime.sendMessage({ type: 'SET_TIMER_DURATION', totalMs: ms, label })
    await sync()
  }

  const handleCustom = () => {
    const min = parseInt(customMin)
    if (!min || min < 1 || min > 480) return
    setDur(min * 60_000, `${min}m Session`)
    setCustomMin('')
  }

  const elapsedPct = Math.round(pct * 100)
  const elapsedMs  = total - localMs

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Focus Timer</h1>
        <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0' }}>Track focused work sessions and protect your time</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 24, alignItems: 'start' }}>

        {/* LEFT — big ring + controls */}
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: 32, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 24 }}>

          {/* Active label */}
          {(running || done) && (
            <div style={{
              padding: '5px 14px', borderRadius: 99, fontSize: 11, fontWeight: 700,
              background: done ? 'rgba(16,185,129,0.15)' : 'rgba(6,182,212,0.15)',
              color: done ? '#10b981' : '#67e8f9',
              border: `1px solid ${done ? 'rgba(16,185,129,0.3)' : 'rgba(6,182,212,0.3)'}`,
            }}>
              {done ? '🎉 Session Complete' : `⏱ ${data?.label ?? 'Focus'} · In Progress`}
            </div>
          )}

          {/* Ring */}
          <BigRing pct={pct} done={done} ms={localMs} />

          {/* Elapsed info */}
          {pct > 0 && !done && (
            <div style={{ display: 'flex', gap: 24, textAlign: 'center' as const }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#334155' }}>Elapsed</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#94a3b8', letterSpacing: '-0.02em', marginTop: 2 }}>{fmt(elapsedMs, true)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#334155' }}>Progress</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#38bdf8', letterSpacing: '-0.02em', marginTop: 2 }}>{elapsedPct}%</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#334155' }}>Total</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#64748b', letterSpacing: '-0.02em', marginTop: 2 }}>{fmt(total, true)}</div>
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99, width: `${elapsedPct}%`,
              background: done ? 'linear-gradient(90deg,#10b981,#34d399)' : 'linear-gradient(90deg,#06b6d4,#0ea5e9)',
              transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button
              onClick={() => running ? pause() : (done ? reset() : start())}
              style={{
                flex: 1, padding: '13px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                fontFamily: 'Inter,sans-serif', fontSize: 14, fontWeight: 800,
                background: running
                  ? 'rgba(249,115,22,0.15)'
                  : done
                    ? 'linear-gradient(135deg,#10b981,#34d399)'
                    : 'linear-gradient(135deg,#06b6d4,#0ea5e9)',
                color: running ? '#fb923c' : '#fff',
                boxShadow: running ? 'none' : done ? '0 4px 16px rgba(16,185,129,0.3)' : '0 4px 16px rgba(6,182,212,0.35)',
                transition: 'all 0.2s',
                letterSpacing: '-0.01em',
              }}
            >
              {running ? '⏸  Pause' : done ? '↺  Start Again' : '▶  Start Timer'}
            </button>
            <button onClick={reset} style={{
              padding: '13px 18px', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
              color: '#64748b', fontSize: 16, cursor: 'pointer', fontFamily: 'Inter,sans-serif',
              transition: 'all 0.15s',
            }}>↺</button>
          </div>

          {/* Sessions today */}
          <div style={{ fontSize: 12, color: '#334155', textAlign: 'center' as const }}>
            {sessionsToday > 0
              ? `🔥 ${sessionsToday} session${sessionsToday > 1 ? 's' : ''} completed today`
              : 'No sessions yet today — start your first!'}
          </div>
        </div>

        {/* RIGHT — presets + quick + custom */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>

          {/* Named presets */}
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#475569', marginBottom: 14 }}>Session Presets</div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {PRESETS.map(p => {
                const active = data?.totalMs === p.ms
                return (
                  <button key={p.label} onClick={() => setDur(p.ms, p.label)}
                    disabled={running}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderRadius: 12, border: 'none', cursor: running ? 'default' : 'pointer',
                      fontFamily: 'Inter,sans-serif', textAlign: 'left' as const,
                      background: active ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.04)',
                      boxShadow: active ? 'inset 0 0 0 1px rgba(6,182,212,0.4)' : 'inset 0 0 0 1px rgba(255,255,255,0.06)',
                      transition: 'all 0.15s', opacity: running ? 0.5 : 1,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#67e8f9' : '#e2e8f0' }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{p.desc}</div>
                    </div>
                    <div style={{
                      fontSize: 13, fontWeight: 800, color: active ? '#38bdf8' : '#334155',
                      letterSpacing: '-0.02em',
                    }}>{p.ms / 60_000}m</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Quick minutes */}
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#475569', marginBottom: 14 }}>Quick Select</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
              {QUICK.map(min => {
                const active = data?.totalMs === min * 60_000
                return (
                  <button key={min} onClick={() => setDur(min * 60_000, `${min}m Session`)}
                    disabled={running}
                    style={{
                      padding: '7px 14px', borderRadius: 99, border: 'none', cursor: running ? 'default' : 'pointer',
                      fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 700,
                      background: active ? 'linear-gradient(135deg,#06b6d4,#0ea5e9)' : 'rgba(255,255,255,0.05)',
                      color: active ? '#fff' : '#64748b',
                      boxShadow: active ? '0 2px 8px rgba(6,182,212,0.3)' : 'none',
                      opacity: running ? 0.5 : 1, transition: 'all 0.15s',
                    }}
                  >{min}m</button>
                )
              })}
            </div>
          </div>

          {/* Custom */}
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#475569', marginBottom: 14 }}>Custom Duration</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number" min="1" max="480"
                value={customMin}
                onChange={e => setCustomMin(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCustom()}
                disabled={running}
                placeholder="Minutes…"
                style={{
                  flex: 1, padding: '10px 14px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, color: '#f1f5f9', fontSize: 13,
                  outline: 'none', fontFamily: 'Inter,sans-serif',
                  opacity: running ? 0.5 : 1,
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(6,182,212,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
              <button onClick={handleCustom} disabled={!customMin || running} style={{
                padding: '10px 16px', borderRadius: 10, border: 'none', cursor: customMin && !running ? 'pointer' : 'default',
                background: customMin && !running ? 'linear-gradient(135deg,#06b6d4,#0ea5e9)' : 'rgba(255,255,255,0.06)',
                color: customMin && !running ? '#fff' : '#334155',
                fontSize: 13, fontWeight: 700, fontFamily: 'Inter,sans-serif',
                transition: 'all 0.2s',
              }}>Set</button>
            </div>
          </div>

          {/* Tips */}
          <div style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.14)', borderRadius: 18, padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#0891b2', marginBottom: 12 }}>💡 Timer Tips</div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {[
                '25 min sessions with 5 min breaks (Pomodoro) maximize retention',
                '90 min matches your brain\'s natural ultradian rhythm',
                'Close distracting tabs before starting your session',
                'Use the Break Reminder in Settings as a safety net',
              ].map((tip, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: '#0891b2', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                  <span style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
