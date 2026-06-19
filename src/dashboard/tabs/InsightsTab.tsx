import React, { useEffect, useState } from 'react'
import {
  Chart as ChartJS, ArcElement, CategoryScale, LinearScale,
  BarElement, Tooltip, Legend, type TooltipItem,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import { getWeekStats, getTodayStats } from '../../db/db'
import { formatDuration, computeFocusScore } from '../../utils/categorize'
import type { Category } from '../../types'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const CAT_COLOR: Record<Category, string> = {
  Learning: '#06b6d4', Work: '#10b981', Entertainment: '#8b5cf6',
  'Social Media': '#ec4899', Shopping: '#f97316', Finance: '#eab308',
  News: '#3b82f6', Other: '#64748b',
}

function KpiCard({ label, value, sub, glow }: { label: string; value: string; sub: string; glow?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 16, padding: '22px 24px', flex: 1,
      boxShadow: glow ? `0 0 30px ${glow}15` : 'none',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.04em', color: glow ?? '#f1f5f9', lineHeight: 1, fontFamily: 'Inter,sans-serif' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>{sub}</div>
    </div>
  )
}

const DARK_TOOLTIP = {
  backgroundColor: '#0d1117',
  borderColor: 'rgba(255,255,255,0.1)',
  borderWidth: 1,
  titleColor: '#94a3b8',
  bodyColor: '#f1f5f9',
  padding: 10,
  cornerRadius: 10,
}

export default function InsightsTab() {
  const [todayData, setTodayData] = useState<{ breakdown: Record<string, number>; totalTime: number } | null>(null)
  const [weekData, setWeekData] = useState<{ days: string[]; totals: number[]; focusScores: number[] } | null>(null)

  useEffect(() => {
    getTodayStats().then(({ breakdown, totalTime }) => setTodayData({ breakdown, totalTime }))
    getWeekStats().then(({ byDay, days }) => {
      const totals = days.map(d => byDay[d].reduce((s, v) => s + v.duration, 0))
      const focusScores = days.map(d => {
        const br: Record<string, number> = {}
        for (const v of byDay[d]) br[v.category] = (br[v.category] ?? 0) + v.duration
        return computeFocusScore(br)
      })
      setWeekData({ days, totals, focusScores })
    })
  }, [])

  const pieData = todayData && Object.keys(todayData.breakdown).length > 0 ? {
    labels: Object.keys(todayData.breakdown),
    datasets: [{
      data: Object.values(todayData.breakdown),
      backgroundColor: Object.keys(todayData.breakdown).map(k => `${CAT_COLOR[k as Category] ?? '#64748b'}cc`),
      borderColor: Object.keys(todayData.breakdown).map(k => CAT_COLOR[k as Category] ?? '#64748b'),
      borderWidth: 2,
      hoverOffset: 6,
    }]
  } : null

  const barData = weekData ? {
    labels: weekData.days.map(d =>
      new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    ),
    datasets: [{
      label: 'Minutes Online',
      data: weekData.totals.map(s => Math.round(s / 60)),
      backgroundColor: weekData.days.map((_, i) =>
        i === 0 ? '#06b6d4' : 'rgba(6,182,212,0.3)'
      ),
      borderRadius: 8,
      borderSkipped: false,
    }]
  } : null

  const avgFocus = weekData ? Math.round(weekData.focusScores.reduce((s, v) => s + v, 0) / 7) : 0
  const totalWeek = weekData ? weekData.totals.reduce((s, v) => s + v, 0) : 0
  const bestDay = weekData ? weekData.days[weekData.totals.indexOf(Math.max(...weekData.totals))] : null

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Insights</h1>
        <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0' }}>Understand your digital habits at a glance</p>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <KpiCard label="Weekly Focus Score" value={`${avgFocus}`} sub="Average across 7 days" glow="#06b6d4" />
        <KpiCard label="This Week Total" value={formatDuration(totalWeek)} sub="All browsing time" />
        <KpiCard label="Daily Average" value={formatDuration(Math.round(totalWeek / 7))} sub="Per day this week" />
        {bestDay && (
          <KpiCard
            label="Best Day"
            value={new Date(bestDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
            sub={formatDuration(weekData?.totals[weekData.days.indexOf(bestDay)] ?? 0)}
          />
        )}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 20, marginBottom: 20 }}>
        {/* Doughnut */}
        <div style={{
          background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 18, padding: 24,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', marginBottom: 16 }}>Today's Breakdown</div>
          {!pieData ? (
            <div style={{ color: '#334155', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>No activity today yet</div>
          ) : (
            <>
              <Doughnut data={pieData} options={{
                cutout: '68%',
                plugins: {
                  legend: { position: 'bottom', labels: { color: '#64748b', font: { size: 11, family: 'Inter' }, padding: 12, boxWidth: 10, borderRadius: 3 } },
                  tooltip: { ...DARK_TOOLTIP, callbacks: { label: (i: TooltipItem<'doughnut'>) => ` ${i.label}: ${formatDuration(Number(i.raw))}` } },
                },
              }} />
            </>
          )}
        </div>

        {/* Bar chart */}
        <div style={{
          background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 18, padding: 24,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', marginBottom: 16 }}>Last 7 Days</div>
          {!barData ? (
            <div style={{ color: '#334155', fontSize: 13 }}>Loading…</div>
          ) : (
            <Bar data={barData} options={{
              responsive: true,
              plugins: {
                legend: { display: false },
                tooltip: { ...DARK_TOOLTIP, callbacks: { label: (i: TooltipItem<'bar'>) => ` ${i.raw} min` } },
              },
              scales: {
                x: { ticks: { color: '#475569', font: { size: 10, family: 'Inter' } }, grid: { display: false }, border: { display: false } },
                y: { ticks: { color: '#475569', font: { size: 10, family: 'Inter' } }, grid: { color: 'rgba(255,255,255,0.04)' }, border: { display: false } },
              },
            }} />
          )}
        </div>
      </div>

      {/* Focus score heatmap */}
      {weekData && (
        <div style={{
          background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 18, padding: 24,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', marginBottom: 20 }}>Daily Focus Score Trend</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 100 }}>
            {weekData.days.map((d, i) => {
              const score = weekData.focusScores[i]
              const color = score >= 70 ? '#10b981' : score >= 40 ? '#06b6d4' : '#f97316'
              const isToday = i === 0
              return (
                <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: color }}>{score}</div>
                  <div style={{
                    width: '100%', borderRadius: '6px 6px 0 0',
                    height: `${Math.max(6, (score / 100) * 72)}px`,
                    background: isToday
                      ? `linear-gradient(180deg, ${color}, ${color}88)`
                      : `${color}44`,
                    boxShadow: isToday ? `0 -4px 16px ${color}40` : 'none',
                    transition: 'height 0.6s ease',
                  }} />
                  <div style={{
                    fontSize: 10, fontWeight: isToday ? 700 : 400,
                    color: isToday ? '#94a3b8' : '#334155',
                  }}>
                    {new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {[{ label: 'High Focus (70+)', color: '#10b981' }, { label: 'Moderate (40–70)', color: '#06b6d4' }, { label: 'Low Focus (<40)', color: '#f97316' }].map(({ label, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 11, color: '#475569' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
