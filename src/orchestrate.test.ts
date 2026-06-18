import { describe, it, expect } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSince, run, analyze } from './orchestrate.js'

describe('defaultSince', () => {
  it('returns 12 months before now as YYYY-MM', () => {
    expect(defaultSince('2026-06-18T00:00:00Z')).toBe('2025-06')
  })
})

describe('analyze', () => {
  it('returns structured stats/suggestions/meta and reports progress per game', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cc-an-'))
    const pgn = `[White "bob"]\n[Black "alice"]\n[Result "1-0"]\n[ECO "C50"]\n[Opening "Italian"]\n\n1. e4 e5 2. Nf3 Nc6 1-0`
    const fetchFn = async (url: string) => {
      if (url.endsWith('/archives')) return new Response(JSON.stringify({ archives: [] }), { status: 200 })
      return new Response(JSON.stringify({ games: [{ url: 'https://chess.com/game/1', end_time: 1_750_000_000, white: { username: 'bob' }, black: { username: 'alice' }, pgn }] }), { status: 200 })
    }
    const evaluate = async (fen: string) => ({ eval: { cp: fen.includes(' w ') ? 20 : -20, mate: null }, bestUci: 'e2e4', pv: [] })
    const seen: Array<[number, number]> = []
    const res = await analyze(
      { user: 'bob', since: '2026-06', depth: 8, root, nowISO: '2026-06-18T00:00:00Z', evaluate: evaluate as any, fetchFn: fetchFn as any },
      (done, total) => seen.push([done, total]),
    )
    expect(res.meta).toEqual({ user: 'bob', since: '2026-06', depth: 8 })
    expect(res.stats.gamesAnalyzed).toBe(1)
    expect(Array.isArray(res.suggestions)).toBe(true)
    expect(seen).toEqual([[1, 1]]) // one game → one progress callback at done=1,total=1
  })

  it('filters games by time control when timeControl is set', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cc-tc-'))
    const pgn = `[White "bob"]\n[Black "x"]\n[Result "1-0"]\n[ECO "C50"]\n[Opening "Italian"]\n\n1. e4 e5 1-0`
    const games = [
      { url: 'g-blitz', end_time: 1, white: { username: 'bob' }, black: { username: 'x' }, pgn, time_class: 'blitz' },
      { url: 'g-rapid', end_time: 2, white: { username: 'bob' }, black: { username: 'x' }, pgn, time_class: 'rapid' },
    ]
    const fetchFn = async (url: string) => {
      if (url.endsWith('/archives')) return new Response(JSON.stringify({ archives: [] }), { status: 200 })
      return new Response(JSON.stringify({ games }), { status: 200 })
    }
    const evaluate = async (fen: string) => ({ eval: { cp: fen.includes(' w ') ? 20 : -20, mate: null }, bestUci: 'e2e4', pv: [] })
    const res = await analyze({ user: 'bob', since: '2026-06', depth: 8, root, nowISO: '2026-06-18T00:00:00Z', evaluate: evaluate as any, fetchFn: fetchFn as any, timeControl: 'blitz' })
    expect(res.stats.gamesAnalyzed).toBe(1) // only the blitz game
  })

  it('spreads games across a pool of evaluators (parallel) and analyzes them all', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cc-pool-'))
    const mkPgn = (w: string) => `[White "${w}"]\n[Black "x"]\n[Result "1-0"]\n[ECO "C50"]\n[Opening "Italian"]\n\n1. e4 e5 2. Nf3 Nc6 1-0`
    const games = Array.from({ length: 4 }, (_, i) => ({
      url: `https://chess.com/game/${i}`, end_time: 1_750_000_000 + i,
      white: { username: 'bob' }, black: { username: 'x' }, pgn: mkPgn('bob'),
    }))
    const fetchFn = async (url: string) => {
      if (url.endsWith('/archives')) return new Response(JSON.stringify({ archives: [] }), { status: 200 })
      return new Response(JSON.stringify({ games }), { status: 200 })
    }
    // Two distinct evaluators; record which ones get used to prove work was spread.
    const used = new Set<number>()
    const makeEval = (id: number) => async (fen: string) => {
      used.add(id)
      return { eval: { cp: fen.includes(' w ') ? 20 : -20, mate: null }, bestUci: 'e2e4', pv: [] }
    }
    const evaluators = [makeEval(0), makeEval(1)]
    const seen: Array<[number, number]> = []
    const res = await analyze(
      { user: 'bob', since: '2026-06', depth: 8, root, nowISO: '2026-06-18T00:00:00Z', evaluate: evaluators[0] as any, evaluators: evaluators as any, fetchFn: fetchFn as any },
      (done, total) => seen.push([done, total]),
    )
    expect(res.stats.gamesAnalyzed).toBe(4)        // all 4 games analyzed
    expect(used.size).toBe(2)                       // both evaluators were used → work spread across the pool
    expect(seen.length).toBe(4)                     // progress fired once per game
    expect(seen[seen.length - 1]).toEqual([4, 4])   // final progress reaches total
  })
})

describe('run', () => {
  it('produces a report end-to-end with injected fetch and evaluator', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cc-run-'))
    const pgn = `[White "bob"]\n[Black "alice"]\n[Result "1-0"]\n[ECO "C50"]\n[Opening "Italian"]\n\n1. e4 e5 2. Nf3 Nc6 1-0`
    const fetchFn = async (url: string) => {
      if (url.endsWith('/archives')) {
        return new Response(JSON.stringify({ archives: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({
        games: [{ url: 'https://chess.com/game/1', end_time: 1_750_000_000,
          white: { username: 'bob' }, black: { username: 'alice' }, pgn }],
      }), { status: 200 })
    }
    const evaluate = async (fen: string) =>
      ({ eval: { cp: fen.includes(' w ') ? 20 : -20, mate: null }, bestUci: 'e2e4' })

    const out = await run({
      user: 'bob', since: '2026-06', depth: 8, root,
      nowISO: '2026-06-18T00:00:00Z', evaluate: evaluate as any, fetchFn: fetchFn as any,
    })
    expect(out.markdown).toContain('# chess-coach report for bob')
    expect(out.terminal).toContain('bob')
    expect(out.terminal).toContain('Games: 1')
  })
})
