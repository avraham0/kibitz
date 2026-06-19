import { parseGame } from '../../../src/pgn/parse.js'
import { analyzeGame } from '../../../src/analyze/game.js'
import { aggregate, perGameSummaries } from '../../../src/report/aggregate.js'
import { coach } from '../../../src/report/coach.js'
import type { GameAnalysis } from '../../../src/types.js'
import type { AnalyzeResult } from '../api-types.js'
import type { Evaluator } from '../engine/browserEngine.js'
import { readCached, writeCached } from './cache.js'

export function defaultSince(nowISO: string): string {
  const d = new Date(nowISO)
  d.setUTCMonth(d.getUTCMonth() - 12)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export type AnalyzeOpts = {
  user: string
  since: string
  depth: number
  last?: number
  nowISO: string
  evaluate: Evaluator
  variations?: boolean
  timeControl?: string
  result?: 'all' | 'win' | 'loss' | 'draw'
  signal?: AbortSignal
}

export async function analyze(
  opts: AnalyzeOpts,
  onProgress?: (done: number, total: number) => void,
): Promise<AnalyzeResult> {
  const q = new URLSearchParams({ user: opts.user, since: opts.since, nowISO: opts.nowISO })
  const res = await fetch(`/api/games?${q}`)
  if (!res.ok) {
    const msg = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(msg)
  }
  const raw: any[] = await res.json()

  const tc = opts.timeControl?.toLowerCase()
  const rawFiltered = tc ? raw.filter((r) => String(r.time_class ?? '').toLowerCase() === tc) : raw
  let parsed = rawFiltered.map((r) => parseGame(r, opts.user)).filter((g): g is NonNullable<typeof g> => g !== null)

  const wantResult = opts.result && opts.result !== 'all' ? opts.result : null
  if (wantResult) parsed = parsed.filter((g) => g.result === wantResult)
  parsed.sort((a, b) => a.playedAt.localeCompare(b.playedAt))
  if (opts.last && opts.last > 0) parsed = parsed.slice(-opts.last)

  const total = parsed.length
  const analyses: GameAnalysis[] = []
  let done = 0

  for (const g of parsed) {
    if (opts.signal?.aborted) throw new Error('Cancelled')
    let analysis = readCached(opts.user, g.gameId, opts.depth)
    if (!analysis) {
      analysis = await analyzeGame(g, opts.depth, opts.evaluate)
      writeCached(analysis, opts.user)
    } else {
      analysis.playerRating = g.playerRating
      analysis.opponentRating = g.opponentRating
      analysis.chesscomAccuracy = g.chesscomAccuracy
    }
    analyses.push(analysis)
    done++
    onProgress?.(done, total)
  }

  const stats = aggregate(analyses, { variations: opts.variations })
  const games = perGameSummaries(analyses)
  const suggestions = coach(stats)
  return { stats, suggestions, meta: { user: opts.user, since: opts.since, depth: opts.depth }, games }
}
