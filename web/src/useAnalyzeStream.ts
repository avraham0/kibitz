import { useRef, useState, useCallback } from 'react'
import type { AnalyzeResult } from './api-types.js'

type Status = 'idle' | 'running' | 'done' | 'error'
type StartParams = { user: string; last?: string; depth?: string; since?: string; variations?: boolean; timeControl?: string; result?: string }

// Persist the last result so a browser refresh doesn't lose the analysis.
// The payload is versioned so a result saved by an older build (different shape) is
// discarded instead of rendered with missing fields. Bump on AnalyzeResult changes.
const STORAGE_KEY = 'kibitz:lastResult'
const STORAGE_VERSION = 14
function loadStored(): AnalyzeResult | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { v?: number; result?: AnalyzeResult }
    if (parsed?.v !== STORAGE_VERSION || !parsed.result) return null
    return parsed.result
  } catch {
    return null
  }
}
function saveStored(result: AnalyzeResult): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: STORAGE_VERSION, result })) } catch { /* quota / unavailable */ }
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
    if (params.result) q.set('result', params.result)
    const es = new EventSource(`/api/analyze?${q.toString()}`)
    esRef.current = es
    es.addEventListener('progress', (e: MessageEvent) => setProgress(JSON.parse(e.data)))
    es.addEventListener('result', (e: MessageEvent) => {
      const r = JSON.parse(e.data) as AnalyzeResult
      setResult(r)
      setStatus('done')
      es.close()
      saveStored(r)
    })
    es.addEventListener('error', (e: MessageEvent) => {
      // SSE 'error' with data = our app error; without data = transport error
      const msg = (e as MessageEvent).data ? JSON.parse((e as MessageEvent).data).message : 'Could not reach the analysis server'
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
