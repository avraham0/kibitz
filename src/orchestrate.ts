import { fetchGamesSince } from './api/chesscom.js'
import { parseGame } from './pgn/parse.js'
import { analyzeGame, type Evaluator } from './analyze/game.js'
import { readCached, writeCached } from './cache/store.js'
import { aggregate } from './report/aggregate.js'
import { coach } from './report/coach.js'
import { renderMarkdown, renderTerminal } from './report/render.js'
import type { GameAnalysis } from './types.js'

// Capture the global fetch reference at module load time, before any WASM
// modules (e.g. Stockfish) can overwrite globalThis.fetch with a non-function.
const _fetch: typeof fetch = globalThis.fetch.bind(globalThis)

export function defaultSince(nowISO: string): string {
  const d = new Date(nowISO)
  d.setUTCMonth(d.getUTCMonth() - 12)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function run(opts: {
  user: string
  since: string
  depth: number
  last?: number
  root?: string
  nowISO: string
  evaluate: Evaluator
  fetchFn?: typeof fetch
}): Promise<{ markdown: string; terminal: string }> {
  const raw = await fetchGamesSince(opts.user, opts.since, opts.nowISO, opts.fetchFn ?? _fetch)
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
    if (process.stderr.isTTY) {
      process.stderr.write(`\ranalyzed ${i + 1}/${parsed.length} games`)
    }
  }
  if (process.stderr.isTTY) process.stderr.write('\n')

  const stats = aggregate(analyses)
  const suggestions = coach(stats)
  const meta = { user: opts.user, since: opts.since, depth: opts.depth }
  return {
    markdown: renderMarkdown(stats, suggestions, meta),
    terminal: renderTerminal(stats, suggestions, meta),
  }
}
