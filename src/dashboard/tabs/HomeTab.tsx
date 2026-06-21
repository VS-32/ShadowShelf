import React, { useEffect, useState } from 'react'
import { getTodayStats, db } from '../../db/db'
import { formatDuration, computeFocusScore } from '../../utils/categorize'
import { getDailyQuote } from '../../utils/quotes'
import { computeProfile } from '../../utils/characterProfile'
import { IconBookmark, IconGlobe, IconTrendingUp } from '../../components/Icons'
import type { Category, Highlight, PageVisit } from '../../types'

const CAT_COLOR: Record<Category, string> = {
  Learning: '#06b6d4', Work: '#10b981', Entertainment: '#8b5cf6',
  'Social Media': '#ec4899', Shopping: '#f97316', Finance: '#eab308',
  News: '#3b82f6', Other: '#64748b',
}

function FocusRing({ score }: { score: number }) {
  const r = 52, stroke = 8, circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#06b6d4' : '#f97316'
  const color2 = score >= 70 ? '#34d399' : score >= 40 ? '#38bdf8' : '#fb923c'
  return (
    <svg width="136" height="136" viewBox="0 0 136 136">
      <defs>
        <linearGradient id="hr" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} /><stop offset="100%" stopColor={color2} />
        </linearGradient>
        <filter id="hglow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <circle cx="68" cy="68" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={stroke} />
      <circle cx="68" cy="68" r={r} fill="none" stroke="url(#hr)" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 68 68)" filter="url(#hglow)"
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
      <text x="68" y="62" textAnchor="middle" fill="#f1f5f9" fontSize="28" fontWeight="800" fontFamily="Inter,sans-serif" letterSpacing="-1">{score}</text>
      <text x="68" y="80" textAnchor="middle" fill="#475569" fontSize="11" fontWeight="600" fontFamily="Inter,sans-serif">FOCUS</text>
    </svg>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '20px 22px', flex: 1 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#475569', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: accent ?? '#f1f5f9', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

interface LimitWarning { category: string; used: number; limit: number; pct: number }
interface AllTimeRecords { longestStreak: number; highestFocusScore: number; mostProductiveSec: number; mostProductiveDay: string }

export default function HomeTab() {
  const [stats, setStats] = useState<{
    totalTime: number; breakdown: Record<string, number>
    topDomains: { domain: string; duration: number }[]; focusScore: number; visitCount: number
  } | null>(null)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [profile, setProfile] = useState<ReturnType<typeof computeProfile> | null>(null)
  const [userName, setUserName] = useState('')
  const [breakStatus, setBreakStatus] = useState<{ elapsed: number; needed: boolean }>({ elapsed: 0, needed: false })
  const [streak, setStreak] = useState<{ current: number; longest: number } | null>(null)
  const [limitWarnings, setLimitWarnings] = useState<LimitWarning[]>([])
  const [records, setRecords] = useState<AllTimeRecords | null>(null)
  const [dailyGoal, setDailyGoal] = useState(0)

  const quote = getDailyQuote()

  useEffect(() => {
    chrome.storage.local.get(['focusStreak', 'allTimeRecords'], r => {
      setStreak(r.focusStreak ?? null)
      setRecords(r.allTimeRecords ?? null)
    })

    chrome.storage.sync.get(['userName', 'breakIntervalMin', 'categoryLimits', 'dailyFocusGoal'], async (stored) => {
      setDailyGoal(stored.dailyFocusGoal ?? 0)
      setUserName(stored.userName ?? '')

      const { visits, totalTime, breakdown } = await getTodayStats()
      const dm: Record<string, number> = {}
      for (const v of visits) dm[v.domain] = (dm[v.domain] ?? 0) + v.duration
      const topDomains = Object.entries(dm).sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([domain, duration]) => ({ domain, duration }))
      setStats({ totalTime, breakdown, topDomains, focusScore: computeFocusScore(breakdown), visitCount: visits.length })

      const limits: Record<string, number> = stored.categoryLimits ?? {}
      const warnings: LimitWarning[] = Object.entries(limits)
        .filter(([, min]) => min > 0)
        .map(([cat, min]) => {
          const used = Math.round((breakdown[cat] ?? 0) / 60)
          const pct = min > 0 ? used / min : 0
          return { category: cat, used, limit: min, pct }
        })
        .filter(w => w.pct >= 0.8)
        .sort((a, b) => b.pct - a.pct)
      setLimitWarnings(warnings)

      const cutoff = Date.now() - 7 * 86400_000
      const weekVisits: PageVisit[] = await db.visits.where('startTime').above(cutoff).toArray()
      setProfile(computeProfile(weekVisits))

      const breakRes = await chrome.runtime.sendMessage({ type: 'GET_BREAK_STATUS' }).catch(() => ({ elapsed: 0 }))
      const intervalMs = (stored.breakIntervalMin ?? 45) * 60_000
      const needed = stored.breakIntervalMin > 0 && (breakRes.elapsed ?? 0) >= intervalMs
      setBreakStatus({ elapsed: breakRes.elapsed ?? 0, needed })
    })

    db.highlights.orderBy('timestamp').reverse().limit(4).toArray().then(setHighlights)
  }, [])

  const handleBreak = () => {
    chrome.runtime.sendMessage({ type: 'TAKE_BREAK' })
    setBreakStatus({ elapsed: 0, needed: false })
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
  const sorted = stats ? Object.entries(stats.breakdown).sort((a, b) => b[1] - a[1]) : []

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>
          {greeting}{userName ? `, ${userName}` : ''} 👋
        </h1>
        <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0', fontWeight: 500 }}>{today}</p>
      </div>

      {/* Streak badge */}
      {streak && streak.current > 0 && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 20,
          background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(251,146,60,0.06))',
          border: '1px solid rgba(249,115,22,0.25)', borderRadius: 14, padding: '12px 18px',
        }}>
          <span style={{ fontSize: 24 }}>🔥</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fb923c', letterSpacing: '-0.02em' }}>
              {streak.current}-Day Focus Streak
            </div>
            <div style={{ fontSize: 11, color: '#78350f', fontWeight: 500, marginTop: 1 }}>
              Personal best: {streak.longest} days · Complete a session each day to keep it going
            </div>
          </div>
        </div>
      )}

      {/* Time limit warnings */}
      {limitWarnings.length > 0 && (
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {limitWarnings.map(w => (
            <div key={w.category} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
              background: w.pct >= 1 ? 'rgba(239,68,68,0.08)' : 'rgba(234,179,8,0.08)',
              border: `1px solid ${w.pct >= 1 ? 'rgba(239,68,68,0.25)' : 'rgba(234,179,8,0.25)'}`,
              borderRadius: 12, padding: '10px 16px',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: w.pct >= 1 ? '#f87171' : '#facc15', marginBottom: 4 }}>
                  {w.pct >= 1 ? '⏰' : '⚠️'} {w.category} — {w.pct >= 1 ? 'Limit reached' : `${Math.round(w.pct * 100)}% of limit`}
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    background: w.pct >= 1 ? '#ef4444' : '#eab308',
                    width: `${Math.min(100, w.pct * 100)}%`,
                  }} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' as const }}>
                {w.used}m / {w.limit}m
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Daily quote */}
      <div style={{
        background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.14)',
        borderRadius: 14, padding: '16px 20px', marginBottom: 20,
        display: 'flex', alignItems: 'flex-start', gap: 14,
      }}>
        <div style={{ fontSize: 24, flexShrink: 0 }}>✨</div>
        <div>
          <p style={{ fontSize: 14, color: '#67e8f9', fontStyle: 'italic', margin: '0 0 6px', lineHeight: 1.6 }}>
            "{quote.text}"
          </p>
          <p style={{ fontSize: 12, color: '#0891b2', margin: 0, fontWeight: 700 }}>— {quote.author}</p>
        </div>
      </div>

      {/* Break banner */}
      {breakStatus.needed && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(251,146,60,0.06))',
          border: '1px solid rgba(249,115,22,0.3)', borderRadius: 14, padding: '16px 20px',
          marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fb923c', marginBottom: 4 }}>🧘 Need a Break?</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              You've been browsing for {Math.floor(breakStatus.elapsed / 60_000)} minutes continuously.
              A 5-minute break will refresh your focus.
            </div>
          </div>
          <button onClick={handleBreak} style={{
            padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(249,115,22,0.4)',
            background: 'rgba(249,115,22,0.15)', color: '#fb923c', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap' as const, flexShrink: 0, marginLeft: 16,
          }}>I'll Take a Break</button>
        </div>
      )}

      {/* Shadow Profile */}
      {profile && (
        <div style={{
          background: `linear-gradient(135deg, ${profile.color}14 0%, ${profile.color}06 100%)`,
          border: `1px solid ${profile.color}30`,
          borderRadius: 20, padding: 24, marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, flexShrink: 0,
              background: `${profile.color}20`, border: `1px solid ${profile.color}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
            }}>{profile.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: profile.color, marginBottom: 3 }}>Your Shadow Profile</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em', marginBottom: 4 }}>{profile.archetype}</div>
              <div style={{ fontSize: 12, color: profile.color, fontWeight: 600 }}>{profile.tagline}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' as const, maxWidth: 160, justifyContent: 'flex-end' }}>
              {profile.strengths.map(s => (
                <span key={s} style={{
                  padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 600,
                  background: `${profile.color}18`, color: profile.color,
                  border: `1px solid ${profile.color}25`,
                }}>{s}</span>
              ))}
            </div>
          </div>

          <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7, margin: '0 0 18px' }}>{profile.description}</p>

          <div style={{ display: 'flex', gap: 20, marginBottom: 18, flexWrap: 'wrap' as const }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#334155', marginBottom: 3 }}>Peak Hour</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8' }}>{profile.peakHour}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#334155', marginBottom: 3 }}>Top Category</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8' }}>{profile.dominantTrait}</div>
            </div>
          </div>

          {/* Productivity tips */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#334155', marginBottom: 10 }}>
              <IconTrendingUp size={12} /> Productivity Tips for {profile.archetype}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {profile.productivityTips.map((tip, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 99, background: `${profile.color}20`,
                    border: `1px solid ${profile.color}30`, color: profile.color,
                    fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0, marginTop: 1,
                  }}>{i + 1}</div>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.6 }}>{tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hero stats */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(6,182,212,0.09) 0%, rgba(14,165,233,0.04) 50%, transparent 100%)',
        border: '1px solid rgba(6,182,212,0.16)', borderRadius: 20, padding: 24, marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 24,
      }}>
        <FocusRing score={stats?.focusScore ?? 0} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#06b6d4', marginBottom: 4 }}>Today's Overview</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', marginBottom: 14, letterSpacing: '-0.02em' }}>
            {stats ? (stats.totalTime === 0 ? 'No activity yet — start browsing' : `${formatDuration(stats.totalTime)} online, ${stats.visitCount} visits`) : 'Loading…'}
          </div>
          {stats && stats.totalTime > 0 && (
            <>
              <div style={{ display: 'flex', height: 5, borderRadius: 99, overflow: 'hidden', gap: 1, marginBottom: 10 }}>
                {sorted.map(([cat, dur]) => (
                  <div key={cat} style={{ flex: dur / stats.totalTime, background: CAT_COLOR[cat as Category] ?? '#64748b', borderRadius: 99 }} />
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '5px 14px' }}>
                {sorted.map(([cat, dur]) => (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: CAT_COLOR[cat as Category] }} />
                    <span style={{ fontSize: 11, color: '#64748b' }}>{cat}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{formatDuration(dur)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <StatCard label="Time Online" value={stats ? formatDuration(stats.totalTime) : '—'} sub="Today" />
        <StatCard label="Focus Score" value={stats ? `${stats.focusScore}/100` : '—'} sub="Productive ratio" accent="#38bdf8" />
        <StatCard label="Unique Sites" value={stats ? `${stats.topDomains.length}` : '—'} sub="Domains today" />
        <StatCard label="Page Visits" value={stats ? `${stats.visitCount}` : '—'} sub="Tab loads today" />
      </div>

      {/* Daily goal progress */}
      {dailyGoal > 0 && stats && (
        <div style={{
          background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: '16px 20px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>
                🎯 Daily Focus Goal
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: stats.focusScore >= dailyGoal ? '#10b981' : '#94a3b8' }}>
                {stats.focusScore} / {dailyGoal}
              </span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                background: stats.focusScore >= dailyGoal
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : 'linear-gradient(90deg, #06b6d4, #0ea5e9)',
                width: `${Math.min(100, (stats.focusScore / dailyGoal) * 100)}%`,
                transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
              }} />
            </div>
          </div>
          {stats.focusScore >= dailyGoal && (
            <div style={{ fontSize: 22, flexShrink: 0 }}>✅</div>
          )}
        </div>
      )}

      {/* All-time records */}
      {records && (records.longestStreak > 0 || records.highestFocusScore > 0 || records.mostProductiveSec > 0) && (
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16, padding: '18px 20px', marginBottom: 24,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#334155', marginBottom: 14 }}>
            All-Time Personal Bests
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { icon: '🔥', label: 'Longest Streak', value: records.longestStreak > 0 ? `${records.longestStreak} days` : '—', color: '#fb923c' },
              { icon: '⚡', label: 'Best Focus Score', value: records.highestFocusScore > 0 ? `${records.highestFocusScore}` : '—', color: '#38bdf8' },
              { icon: '🏆', label: 'Most Productive', value: records.mostProductiveSec > 0 ? formatDuration(records.mostProductiveSec) : '—', color: '#a78bfa' },
            ].map(({ icon, label, value, color }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12, padding: '14px 16px', textAlign: 'center' as const,
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 5, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{label}</div>
              </div>
            ))}
          </div>
          {records.mostProductiveDay && (
            <div style={{ fontSize: 11, color: '#334155', marginTop: 10, textAlign: 'center' as const }}>
              Best day: {new Date(records.mostProductiveDay + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Top sites */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <IconGlobe size={14} />
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#475569' }}>Top Sites Today</span>
          </div>
          {!stats?.topDomains.length ? (
            <p style={{ color: '#334155', fontSize: 13 }}>No visits yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
              {stats.topDomains.map(({ domain, duration }, i) => (
                <div key={domain} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 11, color: '#334155', width: 16, textAlign: 'right' as const, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: `hsl(${(domain.charCodeAt(0) * 47) % 360},55%,35%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>{domain[0].toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontWeight: 500 }}>{domain}</div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99, marginTop: 4 }}>
                      <div style={{ height: '100%', background: 'linear-gradient(90deg, #06b6d4, #0ea5e9)', borderRadius: 99, width: `${(duration / stats.topDomains[0].duration) * 100}%` }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, flexShrink: 0 }}>{formatDuration(duration)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent highlights */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <IconBookmark size={14} />
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#475569' }}>Recent Highlights</span>
          </div>
          {highlights.length === 0 ? (
            <div>
              <p style={{ color: '#334155', fontSize: 13, margin: '0 0 6px' }}>No highlights saved yet.</p>
              <p style={{ color: '#1e293b', fontSize: 11, margin: 0 }}>Select text on any page and tap "Save Highlight"</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
              {highlights.map(h => (
                <div key={h.id} style={{ borderLeft: '2px solid rgba(6,182,212,0.4)', paddingLeft: 12 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 12, color: '#94a3b8', fontStyle: 'italic', lineHeight: 1.5 }}>
                    "{h.text.slice(0, 100)}{h.text.length > 100 ? '…' : ''}"
                  </p>
                  <p style={{ margin: 0, fontSize: 10, color: '#334155' }}>{h.domain} · {new Date(h.timestamp).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
