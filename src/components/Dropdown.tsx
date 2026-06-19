import React, { useState, useRef, useEffect } from 'react'

interface Option { value: number | string; label: string }

interface Props {
  value: number | string
  onChange: (v: string) => void
  options: Option[]
}

export default function Dropdown({ value, onChange, options }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => String(o.value) === String(value))

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0, minWidth: 180 }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '9px 14px',
          background: 'rgba(255,255,255,0.06)',
          border: open ? '1px solid rgba(6,182,212,0.6)' : '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10, color: '#f1f5f9', fontSize: 13,
          fontFamily: 'Inter,sans-serif', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          transition: 'border-color 0.2s',
          boxShadow: open ? '0 0 0 3px rgba(6,182,212,0.15)' : 'none',
        }}
      >
        <span>{selected?.label ?? '—'}</span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
        >
          <path d="M2 4l4 4 4-4" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Menu */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50,
          background: '#0d1117',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12,
          boxShadow: '0 16px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
          overflow: 'hidden',
          animation: 'dropIn 0.15s ease-out',
        }}>
          {options.map(opt => {
            const active = String(opt.value) === String(value)
            return (
              <button
                key={String(opt.value)}
                onClick={() => { onChange(String(opt.value)); setOpen(false) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 14px', border: 'none', cursor: 'pointer',
                  fontFamily: 'Inter,sans-serif', fontSize: 13,
                  background: active ? 'rgba(6,182,212,0.2)' : 'transparent',
                  color: active ? '#67e8f9' : '#94a3b8',
                  fontWeight: active ? 700 : 400,
                  transition: 'background 0.12s, color 0.12s',
                  borderLeft: active ? '2px solid #06b6d4' : '2px solid transparent',
                }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = '#f1f5f9' } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8' } }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}

      <style>{`@keyframes dropIn { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  )
}
