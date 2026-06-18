import { fetchGamesSince } from './api/chesscom.js'
import { parseGame } from './pgn/parse.js'
import { analyzeGame, type Evaluator } from './analyze/game.js'
import { readCached, writeCached } from './cache/store.js'
import { aggregate, type Stats } from './report/aggregate.js'
import { coach, type Suggestion } from './report/coach.js'
import { renderMarkdown, renderTerminal } from './report/render.js'
import type { GameAnalysis } from './types.js'

export function defaultSince(nowISO: string): string {
  const d = new Date(nowISO)
  d.setUTCMonth(d.getUTCMonth() - 12)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

type AnalyzeOpts = {
  user: string; since: string; depth: number; last?: number
  root?: string; nowISO: string; evaluate: Evaluator; fetchFn?: typeof fetch
  // Optional pool of evaluators (one per engine) for parallel game analysis.
  // Defaults to [evaluate] → concurrency 1, preserving single-engine behavior.
  evaluators?: Evaluator[]
  // Group openings by specific variation instead of by family (default: family).
  variations?: boolean
  // Only analyze games of this chess.com time class (bullet|blitz|rapid|daily).
  timeControl?: string
}

export type AnalyzeResult = {
  stats: Stats
  suggestions: Suggestion[]
  meta: { user: string; since: string; depth: number }
}

export async function analyze(
  opts: AnalyzeOpts,
  onProgress?: (done: number, total: number) => void,
): Promise<AnalyzeResult> {
  const raw = await fetchGamesSince(opts.user, opts.since, opts.nowISO, opts.fetchFn ?? fetch)
  // chess.com tags each game with a time_class (bullet/blitz/rapid/daily).
  const tc = opts.timeControl?.toLowerCase()
  const rawFiltered = tc ? raw.filter((r) => String((r as { time_class?: string }).time_class ?? '').toLowerCase() === tc) : raw
  let parsed = rawFiltered.map((r) => parseGame(r, opts.user)).filter((g): g is NonNullable<typeof g> => g !== null)
  parsed.sort((a, b) => a.playedAt.localeCompare(b.playedAt))
  if (opts.last && opts.last > 0) parsed = parsed.slice(-opts.last)

  const evaluators = opts.evaluators && opts.evaluators.length > 0 ? opts.evaluators : [opts.evaluate]
  const total = parsed.length
  const analyses: GameAnalysis[] = new Array(total)
  let cursor = 0
  let done = 0

  // One worker per evaluator (= per engine). Each worker pulls the next game
  // index and analyzes it on its own engine, so up to `evaluators.length` games
  // run concurrently. Results are stored by game index (order-stable).
  async function worker(evaluate: Evaluator): Promise<void> {
    while (true) {
      const i = cursor++
      if (i >= total) return
      const g = parsed[i]
      let analysis = await readCached(opts.user, g.gameId, opts.depth, opts.root)
      if (!analysis) {
        analysis = await analyzeGame(g, opts.depth, evaluate)
        await writeCached(analysis, opts.user, opts.root)
      }
      analyses[i] = analysis
      done++
      onProgress?.(done, total)
    }
  }

  await Promise.all(evaluators.slice(0, Math.max(1, total)).map((e) => worker(e)))

  const stats = aggregate(analyses, { variations: opts.variations })
  const suggestions = coach(stats)
  return { stats, suggestions, meta: { user: opts.user, since: opts.since, depth: opts.depth } }
}

export async function run(opts: AnalyzeOpts): Promise<{ markdown: string; terminal: string }> {
  const { stats, suggestions, meta } = await analyze(opts, (done, total) => {
    if (process.stderr.isTTY) process.stderr.write(`\ranalyzed ${done}/${total} games`)
  })
  if (process.stderr.isTTY) process.stderr.write('\n')
  return {
    markdown: renderMarkdown(stats, suggestions, meta),
    terminal: renderTerminal(stats, suggestions, meta),
  }
}
