import { useAnalyzeStream } from './useAnalyzeStream.js'
import { AnalyzeForm } from './AnalyzeForm.js'
import { ProgressBar } from './ProgressBar.js'
import { Dashboard } from './Dashboard.js'

export default function App() {
  const { status, progress, result, error, start } = useAnalyzeStream()
  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: 16, fontFamily: 'system-ui' }}>
      <h1>chess-coach</h1>
      <AnalyzeForm onSubmit={start} disabled={status === 'running'} />
      {status === 'running' && progress && <ProgressBar done={progress.done} total={progress.total} />}
      {status === 'running' && !progress && <p>Starting analysis…</p>}
      {status === 'error' && <p style={{ color: '#c33' }}>Error: {error}</p>}
      {result && <Dashboard result={result} />}
    </main>
  )
}
