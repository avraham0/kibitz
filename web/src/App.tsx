import { useAnalyzeStream } from './useAnalyzeStream.js'
import { AnalyzeForm } from './AnalyzeForm.js'
import { ProgressBar } from './ProgressBar.js'
import { Dashboard } from './Dashboard.js'
import { KibitzLogo } from './Logo.js'

export default function App() {
  const { status, progress, result, error, start, cancel } = useAnalyzeStream()
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
      <header style={{ margin: '4px 0 18px' }}><KibitzLogo /></header>
      <AnalyzeForm onSubmit={start} disabled={status === 'running'} />
      {status === 'running' && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '12px 0' }}>
          <div style={{ flex: 1 }}>
            {progress ? <ProgressBar done={progress.done} total={progress.total} /> : <span>Starting analysis…</span>}
          </div>
          <button type="button" onClick={cancel}>Cancel</button>
        </div>
      )}
      {status === 'error' && <p style={{ color: '#e0796b' }}>Error: {error}</p>}
      {result && <Dashboard result={result} />}
    </main>
  )
}
