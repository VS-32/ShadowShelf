import React, { useEffect, useState } from 'react'
import { db } from '../../db/db'
import { formatDuration } from '../../utils/categorize'
import type { PageVisit } from '../../types'

const CAT_COLOR: Record<string, string> = {
  Learning: '#6366f1', Work: '#10b981', Entertainment: '#8b5cf6',
  'Social Media': '#ec4899', Shopping: '#f97316', Finance: '#eab308',
  News: '#22d3ee', Other: '#64748b',
}

function getDates(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.now() - i * 86400_000)
    return d.toISOString().slice(0, 10)
  })
}

export default function TimelineTab() {
  const [selected, setSelected] = useState(new Date().toISOString().slice(0, 10))
  const [visits, setVisits] = useState<PageVisit[]>([])
  const [loading, setLoading] = useState(true)
  const dates = getDates(14)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    setLoading(true)
    db.visits.where('date').equals(selected).sortBy('startTime')
      .then(v => { setVisits(v); setLoading(false) })
  }, [selected])

  // Group by hour
  const groups: { hour: number; label: string; items: PageVisit[] }[] = []
  for (const v of visits) {
    const h = new Date(v.startTime).getHours()
    const label = new Date(v.startTime).toLocaleTimeString('en-US', { hour: '2-digit', hour12: true })
    let g = groups.find(x => x.hour === h)
    if (!g) { g = { hour: h, label, items: [] }; groups.push(g) }
    g.items.push(v)
  }
  groups.sort((a, b) => b.hour - a.hour)

  const totalTime = visits.reduce((s, v) => s + v.duration, 0)

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Timeline</h1>
        <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0' }}>Your browsing history, day by day</p>
      </div>

      {/* Date strip */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 28 }}>
        {dates.map(d => {
          const isToday = d === today
          const active = d === selected
          const label = isToday ? 'Today' : new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          return (
            <button key={d} onClick={() => setSelected(d)} style={{
              padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: active ? 700 : 500,
              background: active
                ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                : 'rgba(255,255,255,0.04)',
              color: active ? '#fff' : '#64748b',
              boxShadow: active ? '0 4px 12px rgba(99,102,241,0.3)' : 'none',
              transition: 'all 0.15s',
            }}>
              {label}
            </button>
          )
        })}
      </div>

      {/* Summary bar */}
      {!loading && visits.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12, padding: '12px 18px',
          display: 'flex', gap: 28, marginBottom: 24,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>Total Time</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>{formatDuration(totalTime)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>Visits</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>{visits.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>Avg per Visit</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>{formatDuration(Math.round(totalTime / visits.length))}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#334155', fontSize: 13, paddingTop: 20 }}>Loading…</div>
      ) : visits.length === 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16, padding: '48px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          <p style={{ color: '#475569', fontSize: 14, margin: 0 }}>No activity on this day</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {groups.map(({ label, items }) => (
            <div key={label}>
              <div style={{
                fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: '#334155', marginBottom: 10,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                {label}
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map(v => (
                  <div key={v.id} style={{
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 12, padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: 14,
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.1)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)' }}
                  >
                    {/* Category dot */}
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: CAT_COLOR[v.category] ?? '#64748b',
                      boxShadow: `0 0 6px ${CAT_COLOR[v.category] ?? '#64748b'}80`,
                    }} />

                    {/* Domain avatar */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: `hsl(${(v.domain.charCodeAt(0) * 47) % 360}, 50%, 30%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: '#fff',
                    }}>{v.domain[0]?.toUpperCase()}</div>

                    {/* Title + URL */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, color: '#e2e8f0', fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{v.title || v.domain}</div>
                      <div style={{
                        fontSize: 11, color: '#334155', marginTop: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{v.domain}</div>
                    </div>

                    {/* Meta */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', letterSpacing: '-0.02em' }}>{formatDuration(v.duration)}</div>
                      <div style={{
                        marginTop: 3, display: 'inline-block', padding: '1px 7px',
                        borderRadius: 99, fontSize: 10, fontWeight: 600,
                        background: `${CAT_COLOR[v.category] ?? '#64748b'}18`,
                        color: CAT_COLOR[v.category] ?? '#64748b',
                      }}>{v.category}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
