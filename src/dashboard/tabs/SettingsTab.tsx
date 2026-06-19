import React, { useEffect, useState } from 'react'
import { db, pruneOldData } from '../../db/db'
import { IconShield, IconDownload, IconTrash } from '../../components/Icons'
import Dropdown from '../../components/Dropdown'

interface Settings {
  retentionDays: number
  clipboardEnabled: boolean
  highlightEnabled: boolean
  breakIntervalMin: number
  userName: string
}

const DEFAULTS: Settings = {
  retentionDays: 30,
  clipboardEnabled: true,
  highlightEnabled: true,
  breakIntervalMin: 45,
  userName: '',
}

const BREAK_OPTIONS = [
  { value: 0,   label: 'Off' },
  { value: 20,  label: '20 minutes' },
  { value: 25,  label: '25 min (Pomodoro)' },
  { value: 45,  label: '45 minutes' },
  { value: 60,  label: '1 hour' },
  { value: 90,  label: '1.5 hours' },
  { value: 120, label: '2 hours' },
]

function Toggle({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#475569' }}>{description}</div>
      </div>
      <button onClick={() => onChange(!value)} style={{
        width: 44, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer',
        background: value ? 'linear-gradient(135deg, #06b6d4, #0ea5e9)' : 'rgba(255,255,255,0.08)',
        position: 'relative', flexShrink: 0, transition: 'background 0.2s',
        boxShadow: value ? '0 2px 8px rgba(6,182,212,0.4)' : 'none',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: value ? 22 : 2,
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          transition: 'left 0.2s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 18, padding: '20px 24px', marginBottom: 20,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#475569', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  )
}

function SelectField({ label, description, value, onChange, options }: {
  label: string; description: string; value: number | string
  onChange: (v: string) => void; options: { value: number | string; label: string }[]
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#475569' }}>{description}</div>
      </div>
      <Dropdown value={value} onChange={onChange} options={options} />
    </div>
  )
}

export default function SettingsTab() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [saved, setSaved] = useState(false)
  const [counts, setCounts] = useState({ visits: 0, highlights: 0, clipboard: 0 })

  useEffect(() => {
    chrome.storage.local.get(Object.keys(DEFAULTS), res => setSettings({ ...DEFAULTS, ...res } as Settings))
    refreshCounts()
  }, [])

  const refreshCounts = () =>
    Promise.all([db.visits.count(), db.highlights.count(), db.clipboard.count()])
      .then(([visits, highlights, clipboard]) => setCounts({ visits, highlights, clipboard }))

  const save = () => {
    chrome.storage.local.set(settings, () => {
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    })
  }

  const clearAll = async () => {
    if (!confirm('Delete ALL ShadowShelf data? This cannot be undone.')) return
    await Promise.all([db.visits.clear(), db.highlights.clear(), db.clipboard.clear()])
    refreshCounts()
  }

  const exportData = async () => {
    const [visits, highlights, clipboard] = await Promise.all([
      db.visits.toArray(), db.highlights.toArray(), db.clipboard.toArray(),
    ])
    const blob = new Blob([JSON.stringify({ visits, highlights, clipboard }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: `shadowshelf-${new Date().toISOString().slice(0, 10)}.json` })
    a.click(); URL.revokeObjectURL(url)
  }

  const total = counts.visits + counts.highlights + counts.clipboard

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Settings</h1>
        <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0' }}>Control what ShadowShelf tracks and stores</p>
      </div>

      {/* Profile */}
      <Section title="Your Profile">
        <div style={{ paddingBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>Your Name</div>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>Used for your personalized greeting and character profile</div>
          <input
            value={settings.userName}
            onChange={e => setSettings(s => ({ ...s, userName: e.target.value }))}
            placeholder="Enter your name…"
            style={{
              width: '100%', padding: '10px 14px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, color: '#f1f5f9', fontSize: 13,
              outline: 'none', fontFamily: 'Inter,sans-serif', boxSizing: 'border-box' as const,
              transition: 'border-color 0.2s',
            }}
            onFocus={e => (e.target.style.borderColor = 'rgba(6,182,212,0.5)')}
            onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
          />
        </div>
      </Section>

      {/* Break reminder */}
      <Section title="Break Reminder">
        <SelectField
          label="Remind me after"
          description="Show 'Need a Break?' when you've browsed continuously for this long"
          value={settings.breakIntervalMin}
          onChange={v => setSettings(s => ({ ...s, breakIntervalMin: Number(v) }))}
          options={BREAK_OPTIONS}
        />
        <div style={{ paddingTop: 12, fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
          💡 Research shows that a 5-minute break every 45–90 minutes significantly improves focus and retention.
          The Pomodoro Technique recommends 25-minute work sessions.
        </div>
      </Section>

      {/* Features */}
      <Section title="Features">
        <Toggle label="Clipboard History" description="Capture text, URLs, and phone numbers you copy" value={settings.clipboardEnabled} onChange={v => setSettings(s => ({ ...s, clipboardEnabled: v }))} />
        <Toggle label="Highlight Memory" description='Show "Save Highlight" tooltip when you select text' value={settings.highlightEnabled} onChange={v => setSettings(s => ({ ...s, highlightEnabled: v }))} />
        <div style={{ paddingTop: 4 }} />
      </Section>

      {/* Retention */}
      <Section title="Data Retention">
        <SelectField
          label="Keep data for"
          description="Older entries are automatically pruned"
          value={settings.retentionDays}
          onChange={v => setSettings(s => ({ ...s, retentionDays: Number(v) }))}
          options={[{ value: 7, label: '7 days' }, { value: 14, label: '14 days' }, { value: 30, label: '30 days' }, { value: 60, label: '60 days' }, { value: 90, label: '90 days' }]}
        />
        <div style={{ paddingTop: 4 }} />
      </Section>

      {/* Storage */}
      <Section title="Storage">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 14 }}>
          {[{ label: 'Page Visits', count: counts.visits, color: '#06b6d4' }, { label: 'Highlights', count: counts.highlights, color: '#8b5cf6' }, { label: 'Clipboard', count: counts.clipboard, color: '#22d3ee' }]
            .map(({ label, count, color }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: '-0.03em' }}>{count}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>{label}</div>
              </div>
            ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => pruneOldData(settings.retentionDays).then(refreshCounts)} style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
            Prune Old Entries
          </button>
          <button onClick={exportData} style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <IconDownload size={13} /> Export JSON
          </button>
        </div>
      </Section>

      {/* Danger zone */}
      <Section title="Danger Zone">
        <button onClick={clearAll} style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <IconTrash size={14} /> Clear All Data ({total} entries)
        </button>
      </Section>

      <button onClick={save} style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', background: saved ? 'linear-gradient(135deg, #10b981, #34d399)' : 'linear-gradient(135deg, #06b6d4, #0ea5e9)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', boxShadow: saved ? '0 4px 16px rgba(16,185,129,0.35)' : '0 4px 16px rgba(6,182,212,0.35)', transition: 'all 0.3s' }}>
        {saved ? '✓  Settings Saved' : 'Save Settings'}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, color: '#1e293b', fontSize: 11 }}>
        <IconShield size={12} /> ShadowShelf never sends data to any server. Everything is stored locally.
      </div>
    </div>
  )
}
