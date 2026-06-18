import { describe, it, expect } from 'vitest'
import { coach } from './coach.js'
import type { Stats } from './aggregate.js'

const base: Stats = {
  gamesAnalyzed: 10,
  record: { wins: 3, losses: 6, draws: 1 },
  mistakeCount: 10,
  byPhase: { opening: 1, middlegame: 3, endgame: 6 },
  byType: {
    hung_piece: { count: 6, avgCpLoss: 350, missed: 4, allowed: 2 },
    missed_tactic: { count: 2, avgCpLoss: 200, missed: 1, allowed: 1 },
    bad_trade: { count: 1, avgCpLoss: 150, missed: 0, allowed: 1 },
    king_safety: { count: 1, avgCpLoss: 120, missed: 1, allowed: 0 },
    positional: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
    fork: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
    pin: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
    skewer: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
    discovered_attack: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
    trapped_piece: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
    back_rank: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
  },
  openings: [
    { eco: 'B20', name: 'Sicilian', games: 4, wins: 1, winPct: 25, avgMistakes: 2.5 },
    { eco: 'C50', name: 'Italian', games: 6, wins: 2, winPct: 33, avgMistakes: 1.0 },
  ],
  topBlunders: [
    { url: 'u1', ply: 20, san: 'Qd5', bestSan: 'Nf3', fenBefore: 'f1', cpLoss: 500, type: 'hung_piece' },
  ],
  lostPositionMoves: 0,
  byTimeBucket: {
    '<10s': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 },
    '10-30s': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 },
    '30-60s': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 },
    '60s+': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 },
  },
  gamesWithClock: 0,
  accuracy: 90,
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

  it('does not suggest studying an opening named Unknown', () => {
    const withUnknown: Stats = {
      ...base,
      openings: [
        { eco: 'A00', name: 'Unknown', games: 5, wins: 1, winPct: 20, avgMistakes: 3.0 },
        { eco: 'C50', name: 'Italian', games: 4, wins: 1, winPct: 25, avgMistakes: 2.0 },
      ],
    }
    const s = coach(withUnknown)
    const titles = s.map((x) => x.title.toLowerCase()).join(' | ')
    expect(titles).not.toContain('unknown')
    expect(titles).toContain('italian') // named losing opening still fires
  })

  it('returns nothing actionable when there are no mistakes', () => {
    const empty: Stats = { ...base, mistakeCount: 0,
      byPhase: { opening: 0, middlegame: 0, endgame: 0 },
      byType: { hung_piece: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 }, missed_tactic: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
        bad_trade: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 }, king_safety: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
        positional: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
        fork: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
        pin: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
        skewer: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
        discovered_attack: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
        trapped_piece: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
        back_rank: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 } },
      openings: [] }
    expect(coach(empty)).toEqual([])
  })

  it('coaches on a dominant motif with the missed/allowed split', () => {
    const s: Stats = {
      ...base,
      mistakeCount: 10,
      byType: {
        ...base.byType,
        fork: { count: 6, avgCpLoss: 320, missed: 4, allowed: 2 },
      },
    }
    const out = coach(s)
    const fork = out.find((x) => x.title.toLowerCase().includes('fork'))
    expect(fork).toBeTruthy()
    expect(fork!.why).toMatch(/4 .*missed/i)
    expect(fork!.why).toMatch(/2 .*allowed/i)
  })

  it('coaches on time pressure when blunders cluster under 30s', () => {
    const s: Stats = {
      ...base,
      byTimeBucket: {
        '<10s': { moves: 10, mistakes: 4, blunders: 3, avgCpLoss: 400 },
        '10-30s': { moves: 10, mistakes: 2, blunders: 1, avgCpLoss: 200 },
        '30-60s': { moves: 10, mistakes: 1, blunders: 1, avgCpLoss: 150 },
        '60s+': { moves: 20, mistakes: 1, blunders: 0, avgCpLoss: 100 },
      },
    }
    // clockedBlunders = 5, lowClock = 4 → 80% ≥ 40%, ≥3 → fires
    const tp = coach(s).find((x) => x.title === 'Time pressure is costing you')
    expect(tp).toBeTruthy()
    expect(tp!.why).toMatch(/80%/)
    expect(tp!.why).toMatch(/4 of 5/)
  })

  it('does not coach time pressure below threshold', () => {
    const s: Stats = {
      ...base,
      byTimeBucket: {
        '<10s': { moves: 5, mistakes: 1, blunders: 1, avgCpLoss: 400 },
        '10-30s': { moves: 5, mistakes: 0, blunders: 0, avgCpLoss: 0 },
        '30-60s': { moves: 5, mistakes: 1, blunders: 1, avgCpLoss: 150 },
        '60s+': { moves: 5, mistakes: 1, blunders: 1, avgCpLoss: 100 },
      },
    }
    // clockedBlunders = 3, lowClock = 1 → 33% < 40% → no fire
    expect(coach(s).find((x) => x.title === 'Time pressure is costing you')).toBeFalsy()
  })
})
