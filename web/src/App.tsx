import { useRef, useState } from 'react'
import { useAnalyzeStream } from './useAnalyzeStream.js'
import { AnalyzeForm } from './AnalyzeForm.js'
import { ProgressBar } from './ProgressBar.js'
import { Dashboard } from './Dashboard.js'
import { KibitzLogo } from './Logo.js'
import { SettingsPanel } from './SettingsPanel.js'
import { SettingsContext, loadSettings, saveSettings, type Settings } from './settings.js'

export default function App() {
  const { status, progress, result, error, start, cancel, reset } = useAnalyzeStream()

  const [settings, setSettingsState] = useState(() => {
    const s = loadSettings()
    document.documentElement.classList.toggle('light', s.colorTheme === 'light')
    return s
  })
  function setSettings(s: Settings) {
    setSettingsState(s)
    saveSettings(s)
  }

  const lastOptsRef = useRef<Parameters<typeof start>[0] | null>(null)
  function startAndSave(opts: Parameters<typeof start>[0]) {
    const withEngine = { ...opts, engine: settings.analyzeEngine }
    lastOptsRef.current = withEngine
    start(withEngine)
  }

  const running = status === 'running'

  // Landing: before there's any result, show only the hero — brand, one-line value
  // prop, and the single action (username + Analyze). Nothing else.
  if (!result) {
    return (
      <SettingsContext.Provider value={{ settings, setSettings }}>
        <main style={{ maxWidth: 640, margin: '0 auto', padding: '72px 16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 18, textAlign: 'left' }}>
          <KibitzLogo />
          <p style={{ color: 'var(--muted)', fontSize: 15, margin: 0, maxWidth: 460 }}>
            Find your biggest mistakes and turn them into drills.
          </p>
          <AnalyzeForm hero onSubmit={startAndSave} disabled={running} />
          {running && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', width: 'min(520px, 100%)' }}>
              {progress ? <ProgressBar done={progress.done} total={progress.total} /> : <span>Starting analysis…</span>}
              <button type="button" onClick={cancel}>Cancel</button>
            </div>
          )}
          {status === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <p style={{ color: '#e0796b', margin: 0 }}>Error: {error}</p>
              {lastOptsRef.current && <button type="button" onClick={() => start(lastOptsRef.current!)}>Try again</button>}
            </div>
          )}
        </main>
      </SettingsContext.Provider>
    )
  }

  // Results view: compact header + form, then the dashboard.
  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 18px' }}>
          <KibitzLogo />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <SettingsPanel />
            <button
              type="button"
              onClick={reset}
              title="New analysis"
              style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '4px 6px', borderRadius: 7 }}
            >
              ×
            </button>
          </div>
        </header>
        <AnalyzeForm onSubmit={startAndSave} disabled={running} />
        {running && (
          <>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '12px 0' }}>
              <div style={{ flex: 1 }}>
                {progress ? <ProgressBar done={progress.done} total={progress.total} /> : <span>Starting analysis…</span>}
              </div>
              <button type="button" onClick={cancel}>Cancel</button>
            </div>
            {progress && progress.total > 100 && progress.done < progress.total && (
              <p style={{ color: '#e0b15a', fontSize: 13, marginTop: -4 }}>
                {progress.total} games in this range — this will take a while. Cancel and use <strong>Quick scan</strong>, or a smaller <em>last N</em>, for a faster pass. (Analyzed games are cached, so it's fast next time.)
              </p>
            )}
          </>
        )}
        {status === 'error' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0' }}>
            <p style={{ color: '#e0796b', margin: 0 }}>Error: {error}</p>
            {lastOptsRef.current && <button type="button" onClick={() => start(lastOptsRef.current!)}>Try again</button>}
          </div>
        )}
        {/* Dashboard renders live and refines as games finish (progressive analysis). */}
        <Dashboard result={result} />
      </main>
    </SettingsContext.Provider>
  )
}
