import { describe, it, expect } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSince, run } from './orchestrate.js'

describe('defaultSince', () => {
  it('returns 12 months before now as YYYY-MM', () => {
    expect(defaultSince('2026-06-18T00:00:00Z')).toBe('2025-06')
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
