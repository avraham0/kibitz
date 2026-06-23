import { useRef, useState } from 'react'
import { useAnalyzeStream } from './useAnalyzeStream.js'
import { AnalyzeForm } from './AnalyzeForm.js'
import { ProgressBar } from './ProgressBar.js'
import { Dashboard } from './Dashboard.js'
import { KibitzLogo } from './Logo.js'
import { SettingsPanel } from './SettingsPanel.js'
import { SettingsContext, loadSettings, saveSettings, type Settings } from './settings.js'

export default function App() {
  const { status, progress, result, error, start, cancel } = useAnalyzeStream()

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

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 18px' }}>
          <KibitzLogo />
          <SettingsPanel />
        </header>
        <AnalyzeForm onSubmit={startAndSave} disabled={status === 'running'} />
        {status === 'running' && (
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
        {result && (
          <div className={status === 'running' ? 'loading-content' : undefined}>
            <Dashboard result={result} />
          </div>
        )}
        {status === 'running' && (
          <div className="loading-overlay">
            <div className="loading-spinner" />
            <span className="loading-label">
              {progress ? `Analyzing ${progress.done} / ${progress.total} games…` : 'Starting…'}
            </span>
          </div>
        )}
      </main>
    </SettingsContext.Provider>
  )
}
