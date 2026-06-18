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
  let parsed = raw.map((r) => parseGame(r, opts.user)).filter((g): g is NonNullable<typeof g> => g !== null)
  parsed.sort((a, b) => a.playedAt.localeCompare(b.playedAt))
  if (opts.last && opts.last > 0) parsed = parsed.slice(-opts.last)

  const analyses: GameAnalysis[] = []
  for (let i = 0; i < parsed.length; i++) {
    const g = parsed[i]
    let analysis = await readCached(opts.user, g.gameId, opts.depth, opts.root)
    if (!analysis) {
      analysis = await analyzeGame(g, opts.depth, opts.evaluate)
      await writeCached(analysis, opts.user, opts.root)
    }
    analyses.push(analysis)
    onProgress?.(i + 1, parsed.length)
  }

  const stats = aggregate(analyses)
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
