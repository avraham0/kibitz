import { useState, useRef, useEffect } from 'react'
import { useSettings, BOARD_THEMES, type BoardTheme, type ColorTheme, type AnalyzeEngine } from './settings.js'

const COG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const MINI_BOARD = ['light', 'dark', 'light', 'dark',
                    'dark', 'light', 'dark', 'light',
                    'light', 'dark', 'light', 'dark',
                    'dark', 'light', 'dark', 'light']

function BoardSwatch({ theme, selected, onClick }: { theme: BoardTheme; selected: boolean; onClick: () => void }) {
  const colors = BOARD_THEMES[theme]
  return (
    <button
      type="button"
      onClick={onClick}
      title={BOARD_THEMES[theme].name}
      style={{
        padding: 0, border: selected ? '2px solid var(--accent)' : '2px solid var(--border)',
        borderRadius: 6, cursor: 'pointer', background: 'none',
        outline: selected ? '2px solid var(--accent)' : 'none', outlineOffset: 1,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 10px)', gridTemplateRows: 'repeat(4, 10px)', borderRadius: 4, overflow: 'hidden', lineHeight: 0 }}>
        {MINI_BOARD.map((sq, i) => (
          <div key={i} style={{ width: 10, height: 10, background: sq === 'light' ? (colors.light.background as string) : (colors.dark.background as string) }} />
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginTop: 2, fontWeight: 400, letterSpacing: 0 }}>
        {colors.name}
      </div>
    </button>
  )
}

export function SettingsPanel() {
  const { settings, setSettings } = useSettings()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function setColorTheme(colorTheme: ColorTheme) {
    const next = { ...settings, colorTheme }
    setSettings(next)
    document.documentElement.classList.toggle('light', colorTheme === 'light')
  }

  function setBoardTheme(boardTheme: BoardTheme) {
    setSettings({ ...settings, boardTheme })
  }

  function setAnalyzeEngine(analyzeEngine: AnalyzeEngine) {
    setSettings({ ...settings, analyzeEngine })
  }

  const ENGINES: { id: AnalyzeEngine; label: string }[] = [
    { id: 'browser', label: 'Browser' },
    { id: 'server', label: 'Server' },
  ]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'none', border: 'none', color: 'var(--muted)', padding: '4px 6px',
          borderRadius: 7, display: 'flex', alignItems: 'center',
        }}
        title="Settings"
      >
        {COG}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '110%', zIndex: 100,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '16px 18px', width: 260,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Theme
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {(['dark', 'light'] as ColorTheme[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setColorTheme(t)}
                style={{
                  flex: 1, padding: '6px 0', fontSize: 13, fontWeight: 600,
                  background: settings.colorTheme === t ? 'var(--accent)' : 'var(--surface-2)',
                  color: settings.colorTheme === t ? '#fff' : 'var(--text)',
                  border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer',
                }}
              >
                {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Board
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(Object.keys(BOARD_THEMES) as BoardTheme[]).map((t) => (
              <BoardSwatch key={t} theme={t} selected={settings.boardTheme === t} onClick={() => setBoardTheme(t)} />
            ))}
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '18px 0 10px' }}>
            Analysis engine
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {ENGINES.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setAnalyzeEngine(e.id)}
                style={{
                  flex: 1, padding: '6px 0', fontSize: 13, fontWeight: 600,
                  background: settings.analyzeEngine === e.id ? 'var(--accent)' : 'var(--surface-2)',
                  color: settings.analyzeEngine === e.id ? '#fff' : 'var(--text)',
                  border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer',
                }}
              >
                {e.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
            Browser runs Stockfish in your browser (no server needed). Server uses the
            local backend's native engine (faster, requires <code>npm run serve</code>).
          </div>
        </div>
      )}
    </div>
  )
}
