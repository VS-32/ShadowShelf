import React, { useState, useCallback } from 'react'
import { db } from '../../db/db'
import { formatDuration } from '../../utils/categorize'
import { IconSearch, IconBookmark, IconClipboard, IconGlobe } from '../../components/Icons'
import type { PageVisit, Highlight, ClipboardEntry } from '../../types'

type ResultItem =
  | { kind: 'visit';     data: PageVisit }
  | { kind: 'highlight'; data: Highlight }
  | { kind: 'clipboard'; data: ClipboardEntry }

const KIND_META = {
  visit:     { label: 'Visit',     color: '#6366f1', Icon: IconGlobe },
  highlight: { label: 'Highlight', color: '#8b5cf6', Icon: IconBookmark },
  clipboard: { label: 'Clipboard', color: '#22d3ee', Icon: IconClipboard },
}

export default function SearchTab() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResultItem[]>([])
  const [searching, setSearching] = useState(false)

  const search = useCallback(async (q: string) => {
    const term = q.toLowerCase().trim()
    if (!term) { setResults([]); return }
    setSearching(true)
    const [visits, highlights, clips] = await Promise.all([
      db.visits.filter(v => v.title.toLowerCase().includes(term) || v.url.toLowerCase().includes(term) || v.domain.toLowerCase().includes(term)).limit(30).toArray(),
      db.highlights.filter(h => h.text.toLowerCase().includes(term) || h.url.toLowerCase().includes(term)).limit(20).toArray(),
      db.clipboard.filter(c => c.content.toLowerCase().includes(term)).limit(20).toArray(),
    ])
    setResults([
      ...highlights.map(d => ({ kind: 'highlight' as const, data: d })),
      ...visits.map(d => ({ kind: 'visit' as const, data: d })),
      ...clips.map(d => ({ kind: 'clipboard' as const, data: d })),
    ])
    setSearching(false)
  }, [])

  const highlight = (text: string) => {
    if (!query) return text
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: 'rgba(99,102,241,0.3)', color: '#a5b4fc', borderRadius: 3, padding: '0 2px' }}>
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    )
  }

  return (
    <div style={{ maxWidth: 780 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Search</h1>
        <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0' }}>Search across all your visits, highlights and clipboard</p>
      </div>

      {/* Search input */}
      <div style={{ position: 'relative', marginBottom: 28 }}>
        <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none', display: 'flex' }}>
          <IconSearch size={17} />
        </div>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); search(e.target.value) }}
          placeholder="Search headphones, Python, home loan…"
          autoFocus
          style={{
            width: '100%', padding: '14px 16px 14px 46px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 14, color: '#f1f5f9', fontSize: 14,
            outline: 'none', fontFamily: 'Inter,sans-serif',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            boxSizing: 'border-box',
          }}
          onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)' }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.09)'; e.target.style.boxShadow = 'none' }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]) }} style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 99,
            color: '#64748b', width: 22, height: 22, cursor: 'pointer',
            fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        )}
      </div>

      {/* Empty state */}
      {!query && (
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <div style={{ color: '#334155', fontSize: 14, fontWeight: 500 }}>Start typing to search your digital memory</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {['python', 'youtube', 'headphones', 'github'].map(s => (
              <button key={s} onClick={() => { setQuery(s); search(s) }} style={{
                padding: '5px 12px', borderRadius: 99, border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)', color: '#64748b', fontSize: 12,
                cursor: 'pointer', fontFamily: 'Inter,sans-serif',
              }}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {searching && (
        <div style={{ color: '#475569', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #6366f1', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
          Searching…
        </div>
      )}

      {!searching && query && results.length === 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16, padding: '40px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🕵️</div>
          <p style={{ color: '#475569', fontSize: 14, margin: 0 }}>No results for "<strong style={{ color: '#94a3b8' }}>{query}</strong>"</p>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            {results.length} result{results.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map((r, i) => {
              const { label, color, Icon } = KIND_META[r.kind]
              if (r.kind === 'highlight') {
                return (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
                    borderLeft: `3px solid ${color}`, borderRadius: 12, padding: '14px 16px',
                    transition: 'background 0.15s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, background: `${color}20`, color, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        <Icon size={10} /> {label}
                      </span>
                      <span style={{ fontSize: 11, color: '#334155' }}>{r.data.domain}</span>
                    </div>
                    <p style={{ margin: '0 0 6px', fontSize: 13, color: '#94a3b8', fontStyle: 'italic', lineHeight: 1.6 }}>
                      "{highlight(r.data.text.slice(0, 200))}{r.data.text.length > 200 ? '…' : ''}"
                    </p>
                    <a href={r.data.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#334155', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.data.url}
                    </a>
                  </div>
                )
              }
              if (r.kind === 'visit') {
                return (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12, padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: `hsl(${(r.data.domain.charCodeAt(0) * 47) % 360}, 50%, 30%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: '#fff',
                    }}>{r.data.domain[0]?.toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {highlight(r.data.title || r.data.domain)}
                      </div>
                      <div style={{ fontSize: 11, color: '#334155', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.data.domain}</div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>{formatDuration(r.data.duration)}</div>
                      <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>{r.data.date}</div>
                    </div>
                  </div>
                )
              }
              return (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
                  borderLeft: `3px solid ${color}`, borderRadius: 12, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, background: `${color}20`, color, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                    <Icon size={10} /> {r.data.type}
                  </span>
                  <span style={{ fontSize: 12, color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {highlight(r.data.content.slice(0, 150))}
                  </span>
                  <span style={{ fontSize: 11, color: '#334155', flexShrink: 0 }}>{new Date(r.data.timestamp).toLocaleDateString()}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
