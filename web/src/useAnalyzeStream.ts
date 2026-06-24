import { useRef, useState, useCallback } from 'react'
import type { AnalyzeResult } from './api-types.js'
import { clientAnalyze, defaultSince } from './clientAnalyze.js'
import type { AnalyzeEngine } from './settings.js'

type Status = 'idle' | 'running' | 'done' | 'error'
type StartParams = { user: string; last?: string; depth?: string; since?: string; variations?: boolean; timeControl?: string; result?: string; opening?: string; engine?: AnalyzeEngine }

// Default browser-engine depth — lower than the server's 18 for a fast in-browser pass
// while still deep enough to surface blunders. Quick scan overrides this to 8.
const BROWSER_DEPTH = 12

// Persist the last result so a browser refresh doesn't lose the analysis.
// The payload is versioned so a result saved by an older build (different shape) is
// discarded instead of rendered with missing fields. Bump on AnalyzeResult changes.
const STORAGE_KEY = 'kibitz:lastResult'
const STORAGE_VERSION = 18
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
  const abortRef = useRef<AbortController | null>(null)
  const resultRef = useRef<AnalyzeResult | null>(stored)
  resultRef.current = result

  const start = useCallback((params: StartParams) => {
    esRef.current?.close()
    abortRef.current?.abort()
    // Clear the previous result so stale data isn't shown while the new run loads
    // (progressive partials repopulate it within a second or two).
    setStatus('running'); setProgress(null); setError(null); setResult(null)

    // In-browser engine: run the whole pipeline client-side (no server).
    if (params.engine === 'browser') {
      const ac = new AbortController()
      abortRef.current = ac
      const nowISO = new Date().toISOString()
      clientAnalyze(
        {
          user: params.user,
          since: params.since || defaultSince(nowISO),
          depth: params.depth ? Number(params.depth) : BROWSER_DEPTH,
          last: params.last ? Number(params.last) : undefined,
          nowISO,
          variations: params.variations,
          timeControl: params.timeControl,
          result: (params.result as 'all' | 'win' | 'loss' | 'draw') || 'all',
          opening: params.opening,
        },
        {
          onProgress: (done, total) => setProgress({ done, total }),
          // Stream partial results so the dashboard renders early and refines live.
          onPartial: (r) => { if (!ac.signal.aborted) setResult(r) },
        },
        ac.signal,
      )
        .then((r) => {
          if (ac.signal.aborted) return
          setResult(r); setStatus('done'); saveStored(r)
        })
        .catch((err) => {
          if (ac.signal.aborted) return // cancel() already settled the status
          setError(String((err as Error)?.message ?? err)); setStatus('error')
        })
      return
    }

    // Server engine: stream from the backend over SSE.
    const q = new URLSearchParams({ user: params.user })
    if (params.last) q.set('last', params.last)
    if (params.depth) q.set('depth', params.depth)
    if (params.since) q.set('since', params.since)
    if (params.variations) q.set('variations', '1')
    if (params.timeControl) q.set('timeControl', params.timeControl)
    if (params.result) q.set('result', params.result)
    if (params.opening) q.set('opening', params.opening)
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
    abortRef.current?.abort() // stops the in-browser pipeline
    abortRef.current = null
    setStatus(resultRef.current ? 'done' : 'idle')
    setProgress(null)
  }, [])

  // Clear the result (and its cached copy) and return to the landing/hero state.
  const reset = useCallback(() => {
    esRef.current?.close(); esRef.current = null
    abortRef.current?.abort(); abortRef.current = null
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    setResult(null); setStatus('idle'); setProgress(null); setError(null)
  }, [])

  return { status, progress, result, error, start, cancel, reset }
}
