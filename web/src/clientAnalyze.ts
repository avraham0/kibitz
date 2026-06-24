// Client-side analysis pipeline — the browser equivalent of the server's analyze().
// Fetches games straight from chess.com / lichess (both send CORS *), parses and
// analyzes them with a WASM engine pool, then aggregates + coaches. No server needed.
import { monthsSince, fetchArchive } from '../../src/api/chesscom.js'
import { fetchLichessGames } from '../../src/api/lichess.js'
import { parseGame } from '../../src/pgn/parse.js'
import { analyzeGame } from '../../src/analyze/game.js'
import { aggregate, perGameSummaries } from '../../src/report/aggregate.js'
import { coach } from '../../src/report/coach.js'
import type { GameAnalysis, RawGame } from '../../src/types.js'
import type { Evaluator } from '../../src/analyze/game.js'
import type { AnalyzeResult } from './api-types.js'
import { createBrowserPool } from './browserPool.js'

export type Source = 'chesscom' | 'lichess'

// Default since-window: last 12 months (mirrors the server's defaultSince, kept local
// so we don't import orchestrate.ts, which pulls in node: modules).
export function defaultSince(nowISO: string): string {
  const d = new Date(nowISO)
  d.setUTCMonth(d.getUTCMonth() - 12)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export type ClientParams = {
  user: string
  source: Source
  since: string
  depth: number
  last?: number
  nowISO: string
  variations?: boolean
  timeControl?: string
  result?: 'all' | 'win' | 'loss' | 'draw'
  opening?: string
}

export type AnalyzeHandlers = {
  onProgress?: (done: number, total: number) => void
  // Called as games finish (throttled) with a result built from completed games so
  // far, so the dashboard can render early and refine live.
  onPartial?: (result: AnalyzeResult) => void
}

export async function clientAnalyze(
  params: ClientParams,
  handlers?: AnalyzeHandlers,
  signal?: AbortSignal,
): Promise<AnalyzeResult> {
  const { onProgress, onPartial } = handlers ?? {}
  const tc = params.timeControl?.toLowerCase()
  const wantResult = params.result && params.result !== 'all' ? params.result : null
  // result/opening can't be filtered at fetch time, so they could shrink the count
  // below `last` — when active we over-fetch and slice afterwards.
  const filtersActive = !!(wantResult || params.opening)

  let parsed: RawGame[]
  if (params.source === 'lichess') {
    // lichess returns ndjson newest-first and honors max + since, so one request gets
    // the recent games we want.
    const fetchMax = params.last && params.last > 0
      ? (filtersActive ? Math.max(params.last * 8, 500) : params.last)
      : (filtersActive ? 500 : 200)
    parsed = await fetchLichessGames(params.user, params.since, fetch, fetchMax)
  } else {
    // chess.com: fetch month archives newest-first, stopping early once we have enough.
    const months = monthsSince(params.since, params.nowISO) // oldest → newest
    const canEarlyStop = !!params.last && params.last > 0 && !filtersActive
    const base = 'https://api.chess.com/pub/player'
    const raw: unknown[] = []
    for (let mi = months.length - 1; mi >= 0; mi--) {
      if (signal?.aborted) throw new Error('analysis aborted')
      const games = await fetchArchive(`${base}/${encodeURIComponent(params.user)}/games/${months[mi]}`, fetch, params.user)
      raw.push(...games)
      if (canEarlyStop) {
        const have = tc ? raw.filter((r) => String((r as { time_class?: string }).time_class ?? '').toLowerCase() === tc).length : raw.length
        if (have >= params.last!) break
      }
    }
    parsed = raw.map((r) => parseGame(r, params.user)).filter((g): g is RawGame => g !== null)
  }
  if (signal?.aborted) throw new Error('analysis aborted')

  // Common filters (apply to both sources' parsed games).
  if (tc) parsed = parsed.filter((g) => (g.timeControl ?? '').toLowerCase() === tc)
  if (wantResult) parsed = parsed.filter((g) => g.result === wantResult)
  if (params.opening) {
    const q = params.opening.toLowerCase()
    parsed = parsed.filter((g) => g.openingName.toLowerCase().includes(q) || g.eco.toLowerCase().includes(q))
  }
  parsed.sort((a, b) => a.playedAt.localeCompare(b.playedAt))
  if (params.last && params.last > 0) parsed = parsed.slice(-params.last)
  // Analyze most-recent games first so early partial results are the relevant ones.
  parsed.reverse()

  const total = parsed.length
  const analyses: GameAnalysis[] = new Array(total)
  const meta = { user: params.user, since: params.since, depth: params.depth }
  const build = (): AnalyzeResult => {
    const completed = analyses.filter(Boolean)
    const stats = aggregate(completed, { variations: params.variations })
    return { stats, suggestions: coach(stats), meta, games: perGameSummaries(completed) } as unknown as AnalyzeResult
  }

  onProgress?.(0, total)
  if (total === 0) return build()

  // Throttle partial emits so re-rendering the dashboard doesn't thrash.
  let lastEmit = 0
  const emitPartial = (force: boolean) => {
    if (!onPartial) return
    const now = Date.now()
    if (!force && now - lastEmit < 500) return
    lastEmit = now
    if (analyses.some(Boolean)) onPartial(build())
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
        emitPartial(done === total)
      }
    }
    await Promise.all(pool.evaluators.slice(0, Math.max(1, total)).map((e) => worker(e)))
  } finally {
    pool.quit()
  }
  if (signal?.aborted) throw new Error('analysis aborted')

  return build()
}
