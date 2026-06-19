import { useRef, useState, useCallback } from 'react'
import type { AnalyzeResult } from './api-types.js'

type Status = 'idle' | 'running' | 'done' | 'error'
type StartParams = { user: string; last?: string; depth?: string; since?: string; variations?: boolean; timeControl?: string }

// Persist the last result so a browser refresh doesn't lose the analysis.
const STORAGE_KEY = 'chess-coach:lastResult'
function loadStored(): AnalyzeResult | null {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    return s ? (JSON.parse(s) as AnalyzeResult) : null
  } catch {
    return null
  }
}

export function useAnalyzeStream() {
  const stored = loadStored()
  const [status, setStatus] = useState<Status>(stored ? 'done' : 'idle')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<AnalyzeResult | null>(stored)
  const [error, setError] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)

  const start = useCallback((params: StartParams) => {
    esRef.current?.close()
    // Keep any previous result on screen while re-running (don't blank the dashboard).
    setStatus('running'); setProgress(null); setError(null)
    const q = new URLSearchParams({ user: params.user })
    if (params.last) q.set('last', params.last)
    if (params.depth) q.set('depth', params.depth)
    if (params.since) q.set('since', params.since)
    if (params.variations) q.set('variations', '1')
    if (params.timeControl) q.set('timeControl', params.timeControl)
    const es = new EventSource(`/api/analyze?${q.toString()}`)
    esRef.current = es
    es.addEventListener('progress', (e: MessageEvent) => setProgress(JSON.parse(e.data)))
    es.addEventListener('result', (e: MessageEvent) => {
      setResult(JSON.parse(e.data))
      setStatus('done')
      es.close()
      try { localStorage.setItem(STORAGE_KEY, e.data) } catch { /* quota / unavailable — skip */ }
    })
    es.addEventListener('error', (e: MessageEvent) => {
      // SSE 'error' with data = our app error; without data = transport error
      const msg = (e as MessageEvent).data ? JSON.parse((e as MessageEvent).data).message : 'Connection failed'
      setError(msg); setStatus('error'); es.close()
    })
  }, [])

  const cancel = useCallback(() => {
    esRef.current?.close() // closing the stream makes the server abort the run
    esRef.current = null
    setStatus(result ? 'done' : 'idle')
    setProgress(null)
  }, [result])

  return { status, progress, result, error, start, cancel }
}
