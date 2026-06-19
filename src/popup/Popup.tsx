import React, { useEffect, useState, useCallback } from 'react'
import { getTodayStats, db } from '../db/db'
import { formatDuration, computeFocusScore } from '../utils/categorize'
import { getDailyQuote } from '../utils/quotes'
import { computeProfile } from '../utils/characterProfile'
import { IconArrow, IconShield } from '../components/Icons'
import TimerWidget from '../components/TimerWidget'
import type { Category, PageVisit } from '../types'

const CAT_COLOR: Record<Category, string> = {
  Learning: '#06b6d4', Work: '#10b981', Entertainment: '#8b5cf6',
  'Social Media': '#ec4899', Shopping: '#f97316', Finance: '#eab308',
  News: '#3b82f6', Other: '#64748b',
}

// ── Onboarding screen ─────────────────────────────────────────────────────────
function Onboarding({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState('')

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    chrome.storage.local.set({ userName: trimmed }, () => onDone(trimmed))
  }

  return (
    <div style={{ width: 340, background: '#0d1117', fontFamily: 'Inter,sans-serif', padding: '32px 24px 28px' }}>
      <div style={{
        width: 52, height: 52, borderRadius: 16, margin: '0 auto 20px',
        background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, fontWeight: 800, color: '#fff',
        boxShadow: '0 8px 24px rgba(6,182,212,0.4)',
      }}>S</div>

      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', textAlign: 'center', margin: '0 0 6px', letterSpacing: '-0.03em' }}>
        Welcome to ShadowShelf
      </h2>
      <p style={{ fontSize: 13, color: '#475569', textAlign: 'center', margin: '0 0 28px', lineHeight: 1.6 }}>
        Your private digital mirror. What should we call you?
      </p>

      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="Enter your name…"
        style={{
          width: '100%', padding: '12px 14px', boxSizing: 'border-box' as const,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12, color: '#f1f5f9', fontSize: 14, fontFamily: 'Inter,sans-serif',
          outline: 'none', marginBottom: 12, transition: 'border-color 0.2s',
        }}
        onFocus={e => (e.target.style.borderColor = 'rgba(6,182,212,0.6)')}
        onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
      />

      <button onClick={submit} disabled={!name.trim()} style={{
        width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
        background: name.trim() ? 'linear-gradient(135deg, #06b6d4, #0ea5e9)' : 'rgba(255,255,255,0.06)',
        color: name.trim() ? '#fff' : '#334155', fontSize: 14, fontWeight: 700,
        cursor: name.trim() ? 'pointer' : 'default', fontFamily: 'Inter,sans-serif',
        boxShadow: name.trim() ? '0 4px 16px rgba(6,182,212,0.35)' : 'none',
        transition: 'all 0.2s',
      }}>
        Get Started →
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 16, color: '#1e293b', fontSize: 11 }}>
        <IconShield size={11} /> Everything stays private on your device
      </div>
    </div>
  )
}

// ── Circular focus ring ───────────────────────────────────────────────────────
function FocusRing({ score }: { score: number }) {
  const r = 30, circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#06b6d4' : '#f97316'
  const color2 = score >= 70 ? '#34d399' : score >= 40 ? '#38bdf8' : '#fb923c'
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="pr" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} /><stop offset="100%" stopColor={color2} />
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
      <circle cx="40" cy="40" r={r} fill="none" stroke="url(#pr)" strokeWidth="7"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 40 40)" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      <text x="40" y="45" textAnchor="middle" fill="#f1f5f9" fontSize="16" fontWeight="800" fontFamily="Inter,sans-serif">{score}</text>
    </svg>
  )
}

// ── Break banner ──────────────────────────────────────────────────────────────
function BreakBanner({ elapsed, onBreak }: { elapsed: number; onBreak: () => void }) {
  const min = Math.floor(elapsed / 60_000)
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(251,146,60,0.08))',
      border: '1px solid rgba(249,115,22,0.35)',
      borderRadius: 12, padding: '12px 14px', marginBottom: 14,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fb923c', marginBottom: 2 }}>🧘 Need a Break?</div>
        <div style={{ fontSize: 11, color: '#64748b' }}>You've been browsing for {min} min straight</div>
      </div>
      <button onClick={onBreak} style={{
        padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(249,115,22,0.4)',
        background: 'rgba(249,115,22,0.15)', color: '#fb923c',
        fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif',
        whiteSpace: 'nowrap' as const, flexShrink: 0,
      }}>Take Break</button>
    </div>
  )
}

// ── Main Popup ────────────────────────────────────────────────────────────────
export default function Popup() {
  const [userName, setUserName] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [stats, setStats] = useState<{
    totalTime: number; breakdown: Record<string, number>
    topDomains: { domain: string; duration: number }[]; focusScore: number
  } | null>(null)
  const [breakStatus, setBreakStatus] = useState<{ elapsed: number; needed: boolean }>({ elapsed: 0, needed: false })
  const [profile, setProfile] = useState<ReturnType<typeof computeProfile> | null>(null)
  const quote = getDailyQuote()

  const loadData = useCallback(async () => {
    const stored = await chrome.storage.local.get(['userName', 'breakIntervalMin'])
    setUserName(stored.userName ?? null)

    const { visits, totalTime, breakdown } = await getTodayStats()
    const dm: Record<string, number> = {}
    for (const v of visits) dm[v.domain] = (dm[v.domain] ?? 0) + v.duration
    const topDomains = Object.entries(dm).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([domain, duration]) => ({ domain, duration }))
    setStats({ totalTime, breakdown, topDomains, focusScore: computeFocusScore(breakdown) })

    const breakRes = await chrome.runtime.sendMessage({ type: 'GET_BREAK_STATUS' })
      .catch(() => ({ elapsed: 0, breakNotified: false }))
    const intervalMs = (stored.breakIntervalMin ?? 45) * 60_000
    const needed = stored.breakIntervalMin > 0 && breakRes.elapsed >= intervalMs
    setBreakStatus({ elapsed: breakRes.elapsed ?? 0, needed })

    const cutoff = Date.now() - 7 * 86400_000
    const weekVisits: PageVisit[] = await db.visits.where('startTime').above(cutoff).toArray()
    setProfile(computeProfile(weekVisits))

    setLoaded(true)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleBreak = () => {
    chrome.runtime.sendMessage({ type: 'TAKE_BREAK' })
    setBreakStatus({ elapsed: 0, needed: false })
  }

  const openDashboard = () => {
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' })
    window.close()
  }

  const handleOnboarded = (name: string) => {
    setUserName(name)
    loadData()
  }

  if (loaded && userName === null) return <Onboarding onDone={handleOnboarded} />
  if (!loaded) {
    return (
      <div style={{ width: 340, background: '#0d1117', padding: '40px 0', textAlign: 'center', color: '#334155', fontSize: 13, fontFamily: 'Inter,sans-serif' }}>
        Loading…
      </div>
    )
  }

  const sorted = stats ? Object.entries(stats.breakdown).sort((a, b) => b[1] - a[1]) : []
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div style={{ width: 340, background: '#0d1117', fontFamily: 'Inter,sans-serif' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(14,165,233,0.06) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 800, color: '#fff',
            boxShadow: '0 4px 12px rgba(6,182,212,0.4)',
          }}>S</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>{greeting}, {userName}!</div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>ShadowShelf</div>
          </div>
        </div>
        <button onClick={openDashboard} style={{
          background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)',
          color: '#38bdf8', borderRadius: 8, padding: '4px 10px',
          fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          fontFamily: 'Inter,sans-serif',
        }}>
          Dashboard <IconArrow size={10} />
        </button>
      </div>

      <div style={{ padding: '14px 16px' }}>

        {/* Daily Quote */}
        <div style={{
          background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.14)',
          borderRadius: 12, padding: '11px 14px', marginBottom: 14,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#0891b2', marginBottom: 5 }}>✨ Daily Quote</div>
          <p style={{ fontSize: 12, color: '#67e8f9', fontStyle: 'italic', margin: '0 0 4px', lineHeight: 1.5 }}>
            "{quote.text}"
          </p>
          <p style={{ fontSize: 10, color: '#0891b2', margin: 0, fontWeight: 600 }}>— {quote.author}</p>
        </div>

        {/* Focus Timer */}
        <TimerWidget />

        {/* Break banner */}
        {breakStatus.needed && (
          <BreakBanner elapsed={breakStatus.elapsed} onBreak={handleBreak} />
        )}

        {/* Character chip */}
        {profile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
            background: `${profile.color}12`, border: `1px solid ${profile.color}30`,
            borderRadius: 10, padding: '8px 12px',
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{profile.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: profile.color }}>{profile.archetype}</div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{profile.tagline}</div>
            </div>
            <button onClick={openDashboard} style={{
              fontSize: 9, color: '#475569', background: 'none', border: 'none',
              cursor: 'pointer', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap' as const,
            }}>See profile →</button>
          </div>
        )}

        {/* Stats */}
        {!stats || stats.totalTime === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#334155', fontSize: 13 }}>
            🌑 No activity yet today. Start browsing!
          </div>
        ) : (
          <>
            {/* Focus ring + total */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <FocusRing score={stats.focusScore} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#475569', marginBottom: 2 }}>Focus Score</div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
                  {stats.focusScore >= 70 ? '🟢 Excellent focus' : stats.focusScore >= 40 ? '🟡 Moderate focus' : '🔴 Low focus today'}
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#475569', marginBottom: 2 }}>Online Today</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {formatDuration(stats.totalTime)}
                </div>
              </div>
            </div>

            {/* Stacked bar */}
            <div style={{ display: 'flex', height: 4, borderRadius: 99, overflow: 'hidden', gap: 1, marginBottom: 10 }}>
              {sorted.map(([cat, dur]) => (
                <div key={cat} style={{ flex: dur / stats.totalTime, background: CAT_COLOR[cat as Category] ?? '#64748b', borderRadius: 99 }} />
              ))}
            </div>

            {/* Categories */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#475569', marginBottom: 7 }}>Categories</div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
                {sorted.slice(0, 5).map(([cat, dur]) => (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: CAT_COLOR[cat as Category] ?? '#64748b', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#94a3b8', flex: 1 }}>{cat}</span>
                    <span style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>{formatDuration(dur)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top sites */}
            {stats.topDomains.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#475569', marginBottom: 7 }}>Top Sites</div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
                  {stats.topDomains.map(({ domain, duration }) => (
                    <div key={domain} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                        background: `hsl(${(domain.charCodeAt(0) * 47) % 360},55%,35%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700, color: '#fff',
                      }}>{domain[0].toUpperCase()}</div>
                      <span style={{ fontSize: 11, color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{domain}</span>
                      <span style={{ fontSize: 10, color: '#475569' }}>{formatDuration(duration)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '0 16px 14px' }}>
        <button onClick={openDashboard} style={{
          width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
          background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)',
          color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(6,182,212,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          fontFamily: 'Inter,sans-serif',
        }}>
          Open Full Dashboard <IconArrow size={13} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 8, color: '#1e293b', fontSize: 10 }}>
          <IconShield size={10} /> All data stays on your device
        </div>
      </div>
    </div>
  )
}
