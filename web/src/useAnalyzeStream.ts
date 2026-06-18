import { useRef, useState, useCallback } from 'react'
import type { AnalyzeResult } from './api-types.js'

type Status = 'idle' | 'running' | 'done' | 'error'
type StartParams = { user: string; last?: string; depth?: string; since?: string }

export function useAnalyzeStream() {
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)

  const start = useCallback((params: StartParams) => {
    esRef.current?.close()
    setStatus('running'); setProgress(null); setResult(null); setError(null)
    const q = new URLSearchParams({ user: params.user })
    if (params.last) q.set('last', params.last)
    if (params.depth) q.set('depth', params.depth)
    if (params.since) q.set('since', params.since)
    const es = new EventSource(`/api/analyze?${q.toString()}`)
    esRef.current = es
    es.addEventListener('progress', (e: MessageEvent) => setProgress(JSON.parse(e.data)))
    es.addEventListener('result', (e: MessageEvent) => { setResult(JSON.parse(e.data)); setStatus('done'); es.close() })
    es.addEventListener('error', (e: MessageEvent) => {
      // SSE 'error' with data = our app error; without data = transport error
      const msg = (e as MessageEvent).data ? JSON.parse((e as MessageEvent).data).message : 'Connection failed'
      setError(msg); setStatus('error'); es.close()
    })
  }, [])

  return { status, progress, result, error, start }
}
