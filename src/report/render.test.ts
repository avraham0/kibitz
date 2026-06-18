import { describe, it, expect } from 'vitest'
import { renderMarkdown, renderTerminal, analysisLink } from './render.js'
import type { Stats } from './aggregate.js'
import type { Suggestion } from './coach.js'

const stats: Stats = {
  gamesAnalyzed: 5, record: { wins: 2, losses: 3, draws: 0 }, mistakeCount: 4,
  byPhase: { opening: 0, middlegame: 1, endgame: 3 },
  byType: {
    hung_piece: { count: 3, avgCpLoss: 300 }, missed_tactic: { count: 1, avgCpLoss: 200 },
    bad_trade: { count: 0, avgCpLoss: 0 }, king_safety: { count: 0, avgCpLoss: 0 },
    positional: { count: 0, avgCpLoss: 0 },
  },
  openings: [{ eco: 'B20', name: 'Sicilian', games: 3, wins: 1, winPct: 33, avgMistakes: 1.3 }],
  topBlunders: [{ url: 'https://chess.com/game/1', ply: 20, san: 'Qd5', bestSan: 'Nf3', fenBefore: '8/8/8 w - - 0 1', cpLoss: 400, type: 'hung_piece' }],
  lostPositionMoves: 7,
}
const sugg: Suggestion[] = [{ title: 'Hung pieces', why: 'w', drill: 'd', impact: 900, examples: [] }]

describe('render', () => {
  it('markdown contains all sections and a usable analysis link', () => {
    const md = renderMarkdown(stats, sugg, { user: 'bob', since: '2025-06', depth: 15 })
    expect(md).toContain('# chess-coach report for bob')
    expect(md).toContain('Top blunders')
    expect(md).toContain('Mistake types')
    expect(md).toContain('Openings')
    expect(md).toContain('Coaching')
    expect(md).toContain('Hung pieces')
    expect(md).toContain('chess.com/analysis?fen=')
  })

  it('terminal summary is plain text with the record and top suggestion', () => {
    const txt = renderTerminal(stats, sugg, { user: 'bob', since: '2025-06', depth: 15 })
    expect(txt).toContain('bob')
    expect(txt).toContain('2W-3L-0D')
    expect(txt).toContain('Hung pieces')
  })

  it('analysisLink encodes the FEN', () => {
    expect(analysisLink('x', 'r n/8 w - - 0 1')).toContain('fen=r%20n')
  })

  it('markdown shows lost position transparency line', () => {
    const md = renderMarkdown(stats, sugg, { user: 'bob', since: '2025-06', depth: 15 })
    expect(md).toContain('Moves in already-lost positions (excluded): 7')
  })

  it('terminal summary shows lost position transparency line', () => {
    const txt = renderTerminal(stats, sugg, { user: 'bob', since: '2025-06', depth: 15 })
    expect(txt).toContain('Moves in already-lost positions (excluded): 7')
  })

  it('escapes pipe characters in opening names to avoid breaking markdown tables', () => {
    const pipeStats: Stats = {
      ...stats,
      openings: [{ eco: 'B90', name: 'Sicilian | Najdorf', games: 2, wins: 1, winPct: 50, avgMistakes: 1.0 }],
    }
    const md = renderMarkdown(pipeStats, [], { user: 'bob', since: '2025-06', depth: 15 })
    expect(md).toContain('Sicilian \\| Najdorf')
  })
})
