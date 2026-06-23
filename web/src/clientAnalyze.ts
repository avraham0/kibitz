// Client-side analysis pipeline — the browser equivalent of the server's analyze().
// Fetches games straight from chess.com (their pub API sends CORS *), parses and
// analyzes them with a WASM engine pool, then aggregates + coaches. No server needed.
import { fetchGamesSince } from '../../src/api/chesscom.js'
import { parseGame } from '../../src/pgn/parse.js'
import { analyzeGame } from '../../src/analyze/game.js'
import { aggregate, perGameSummaries } from '../../src/report/aggregate.js'
import { coach } from '../../src/report/coach.js'
import type { GameAnalysis } from '../../src/types.js'
import type { Evaluator } from '../../src/analyze/game.js'
import type { AnalyzeResult } from './api-types.js'
import { createBrowserPool } from './browserPool.js'

// Default since-window: last 12 months (mirrors the server's defaultSince, kept local
// so we don't import orchestrate.ts, which pulls in node: modules).
export function defaultSince(nowISO: string): string {
  const d = new Date(nowISO)
  d.setUTCMonth(d.getUTCMonth() - 12)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export type ClientParams = {
  user: string
  since: string
  depth: number
  last?: number
  nowISO: string
  variations?: boolean
  timeControl?: string
  result?: 'all' | 'win' | 'loss' | 'draw'
  opening?: string
}

export async function clientAnalyze(
  params: ClientParams,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<AnalyzeResult> {
  const raw = await fetchGamesSince(params.user, params.since, params.nowISO, fetch)
  if (signal?.aborted) throw new Error('analysis aborted')

  const tc = params.timeControl?.toLowerCase()
  const rawFiltered = tc
    ? raw.filter((r) => String((r as { time_class?: string }).time_class ?? '').toLowerCase() === tc)
    : raw
  let parsed = rawFiltered.map((r) => parseGame(r, params.user)).filter((g): g is NonNullable<typeof g> => g !== null)

  const wantResult = params.result && params.result !== 'all' ? params.result : null
  if (wantResult) parsed = parsed.filter((g) => g.result === wantResult)
  if (params.opening) {
    const q = params.opening.toLowerCase()
    parsed = parsed.filter((g) => g.openingName.toLowerCase().includes(q) || g.eco.toLowerCase().includes(q))
  }
  parsed.sort((a, b) => a.playedAt.localeCompare(b.playedAt))
  if (params.last && params.last > 0) parsed = parsed.slice(-params.last)

  const total = parsed.length
  const analyses: GameAnalysis[] = new Array(total)
  onProgress?.(0, total)
  if (total === 0) {
    const stats = aggregate(analyses, { variations: params.variations })
    return { stats, suggestions: coach(stats), meta: { user: params.user, since: params.since, depth: params.depth }, games: perGameSummaries(analyses) } as unknown as AnalyzeResult
  }

  const pool = createBrowserPool()
  let cursor = 0
  let done = 0
  try {
    async function worker(evaluate: Evaluator): Promise<void> {
      while (true) {
        if (signal?.aborted) return
        const i = cursor++
        if (i >= total) return
        analyses[i] = await analyzeGame(parsed[i], params.depth, evaluate)
        done++
        onProgress?.(done, total)
      }
    }
    await Promise.all(pool.evaluators.slice(0, Math.max(1, total)).map((e) => worker(e)))
  } finally {
    pool.quit()
  }
  if (signal?.aborted) throw new Error('analysis aborted')

  const stats = aggregate(analyses, { variations: params.variations })
  return {
    stats,
    suggestions: coach(stats),
    meta: { user: params.user, since: params.since, depth: params.depth },
    games: perGameSummaries(analyses),
  } as unknown as AnalyzeResult
}
