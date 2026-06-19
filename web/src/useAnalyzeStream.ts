import { useRef, useState, useCallback } from 'react'
import type { AnalyzeResult } from './api-types.js'
import { BrowserEngine } from './engine/browserEngine.js'
import { analyze, defaultSince } from './analyze/orchestrate.js'

type Status = 'idle' | 'running' | 'done' | 'error'
type StartParams = { user: string; last?: string; depth?: string; since?: string; variations?: boolean; timeControl?: string; result?: string }

const STORAGE_KEY = 'kibitz:lastResult'
const STORAGE_VERSION = 18
function loadStored(): AnalyzeResult | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { v?: number; result?: AnalyzeResult }
    if (parsed?.v !== STORAGE_VERSION || !parsed.result) return null
    return parsed.result
  } catch { return null }
}
function saveStored(result: AnalyzeResult): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: STORAGE_VERSION, result })) } catch { /* quota */ }
}

export function useAnalyzeStream() {
  const stored = loadStored()
  const [status, setStatus] = useState<Status>(stored ? 'done' : 'idle')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<AnalyzeResult | null>(stored)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const engineRef = useRef<BrowserEngine | null>(null)

  const start = useCallback((params: StartParams) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStatus('running'); setProgress(null); setError(null)

    const nowISO = new Date().toISOString()
    const since = params.since ?? defaultSince(nowISO)
    const depth = Number(params.depth ?? '18')

    ;(async () => {
      let engine: BrowserEngine | null = null
      try {
        engine = await BrowserEngine.create()
        engineRef.current = engine
        const r = await analyze(
          {
            user: params.user,
            since,
            depth,
            last: params.last ? Number(params.last) : undefined,
            nowISO,
            evaluate: engine.evaluator,
            variations: params.variations,
            timeControl: params.timeControl,
            result: (params.result ?? 'loss') as 'all' | 'win' | 'loss' | 'draw',
            signal: controller.signal,
          },
          (done, total) => setProgress({ done, total }),
        )
        setResult(r); setStatus('done'); saveStored(r)
      } catch (err) {
        if (controller.signal.aborted) return
        setError(String((err as Error)?.message ?? err)); setStatus('error')
      } finally {
        engine?.quit()
        engineRef.current = null
      }
    })()
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    engineRef.current?.quit()
    engineRef.current = null
    setStatus(result ? 'done' : 'idle'); setProgress(null)
  }, [result])

  return { status, progress, result, error, start, cancel }
}
