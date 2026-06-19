import React, { useState } from 'react'
import HomeTab from './tabs/HomeTab'
import TimelineTab from './tabs/TimelineTab'
import SearchTab from './tabs/SearchTab'
import InsightsTab from './tabs/InsightsTab'
import TimerTab from './tabs/TimerTab'
import SettingsTab from './tabs/SettingsTab'
import {
  IconHome, IconClock, IconSearch, IconChart, IconSettings, IconShield, IconTimer,
} from '../components/Icons'

type Tab = 'home' | 'timeline' | 'search' | 'insights' | 'timer' | 'settings'

const TABS: { id: Tab; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'home',     label: 'Home',     Icon: IconHome },
  { id: 'timeline', label: 'Timeline', Icon: IconClock },
  { id: 'search',   label: 'Search',   Icon: IconSearch },
  { id: 'insights', label: 'Insights', Icon: IconChart },
  { id: 'timer',    label: 'Timer',    Icon: IconTimer },
  { id: 'settings', label: 'Settings', Icon: IconSettings },
]

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('home')

  return (
    <div style={{ minHeight: '100vh', background: '#070711', display: 'flex', fontFamily: 'Inter,sans-serif' }}>

      {/* Sidebar */}
      <aside style={{
        width: 220, background: '#0a0a17',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', height: '100%', zIndex: 10,
      }}>
        {/* Brand */}
        <div style={{ padding: '22px 18px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 800, color: '#fff',
              boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
              flexShrink: 0,
            }}>S</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9', letterSpacing: '-0.02em' }}>ShadowShelf</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>Your Digital Mirror</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 10, border: 'none',
                  background: active
                    ? 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.15))'
                    : 'transparent',
                  color: active ? '#a5b4fc' : '#64748b',
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  cursor: 'pointer', width: '100%', textAlign: 'left',
                  transition: 'all 0.15s',
                  position: 'relative',
                  boxShadow: active ? 'inset 0 0 0 1px rgba(99,102,241,0.3)' : 'none',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; if (!active) (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; if (!active) (e.currentTarget as HTMLButtonElement).style.color = '#64748b' }}
              >
                {active && (
                  <div style={{
                    position: 'absolute', left: 0, top: '20%', width: 3, height: '60%',
                    background: 'linear-gradient(180deg, #6366f1, #8b5cf6)',
                    borderRadius: '0 3px 3px 0',
                  }} />
                )}
                <Icon size={16} />
                {label}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{
          padding: '14px 16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 6,
          color: '#334155', fontSize: 11,
        }}>
          <IconShield size={13} />
          <span>100% private &amp; local</span>
        </div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 220, flex: 1, minHeight: '100vh', padding: '36px 40px', maxWidth: '100%' }}>
        <div className="animate-fade-in" key={activeTab}>
          {activeTab === 'home'     && <HomeTab />}
          {activeTab === 'timeline' && <TimelineTab />}
          {activeTab === 'search'   && <SearchTab />}
          {activeTab === 'insights' && <InsightsTab />}
          {activeTab === 'timer'    && <TimerTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      </main>
    </div>
  )
}
