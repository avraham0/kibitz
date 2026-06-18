import { describe, it, expect } from 'vitest'
import { coach } from './coach.js'
import type { Stats } from './aggregate.js'

const base: Stats = {
  gamesAnalyzed: 10,
  record: { wins: 3, losses: 6, draws: 1 },
  mistakeCount: 10,
  byPhase: { opening: 1, middlegame: 3, endgame: 6 },
  byType: {
    hung_piece: { count: 6, avgCpLoss: 350 },
    missed_tactic: { count: 2, avgCpLoss: 200 },
    bad_trade: { count: 1, avgCpLoss: 150 },
    king_safety: { count: 1, avgCpLoss: 120 },
    positional: { count: 0, avgCpLoss: 0 },
  },
  openings: [
    { eco: 'B20', name: 'Sicilian', games: 4, wins: 1, winPct: 25, avgMistakes: 2.5 },
    { eco: 'C50', name: 'Italian', games: 6, wins: 2, winPct: 33, avgMistakes: 1.0 },
  ],
  topBlunders: [
    { url: 'u1', ply: 20, san: 'Qd5', bestSan: 'Nf3', fenBefore: 'f1', cpLoss: 500, type: 'hung_piece' },
  ],
}

describe('coach', () => {
  it('produces type, phase, and opening suggestions ranked by impact', () => {
    const s = coach(base)
    const titles = s.map((x) => x.title.toLowerCase()).join(' | ')
    expect(titles).toContain('hung') // 60% of mistakes
    expect(titles).toContain('endgame') // 60% of mistakes in endgame
    expect(titles).toMatch(/sicilian/) // losing opening with >=3 games
    // highest-impact suggestion first
    expect(s[0].impact).toBeGreaterThanOrEqual(s[s.length - 1].impact)
    expect(s.length).toBeLessThanOrEqual(5)
  })

  it('returns nothing actionable when there are no mistakes', () => {
    const empty: Stats = { ...base, mistakeCount: 0,
      byPhase: { opening: 0, middlegame: 0, endgame: 0 },
      byType: { hung_piece: { count: 0, avgCpLoss: 0 }, missed_tactic: { count: 0, avgCpLoss: 0 },
        bad_trade: { count: 0, avgCpLoss: 0 }, king_safety: { count: 0, avgCpLoss: 0 },
        positional: { count: 0, avgCpLoss: 0 } },
      openings: [] }
    expect(coach(empty)).toEqual([])
  })
})
