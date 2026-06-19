import { describe, it, expect } from 'vitest'
import { topLeaks } from './topLeaks.js'
import type { Stats } from './api-types.js'

function stats(over: Partial<Stats>): Stats {
  const zeroType = { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 }
  return {
    gamesAnalyzed: 5, record: { wins: 2, losses: 2, draws: 1 }, mistakeCount: 0,
    byPhase: { opening: 0, middlegame: 0, endgame: 0 },
    byType: {
      hung_piece: zeroType, missed_tactic: zeroType, bad_trade: zeroType, king_safety: zeroType,
      positional: zeroType, fork: zeroType, pin: zeroType, skewer: zeroType,
      discovered_attack: zeroType, trapped_piece: zeroType, back_rank: zeroType,
    },
    openings: [], topBlunders: [], lostPositionMoves: 0,
    byTimeBucket: {
      '<10s': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 },
      '10-30s': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 },
      '30-60s': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 },
      '60s+': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 },
    },
    gamesWithClock: 0, accuracy: 100, accuracyStrict: 100, accuracyByPhase: { opening: 100, middlegame: 100, endgame: 100 },
    conversion: { winningGames: 0, converted: 0 },
    byColor: { white: { games: 0, wins: 0, winPct: 0, accuracy: 100, mistakes: 0 }, black: { games: 0, wins: 0, winPct: 0, accuracy: 100, mistakes: 0 } },
    ...over,
  }
}

describe('topLeaks', () => {
  it('ranks the costliest mistake type first', () => {
    const s = stats({
      mistakeCount: 10,
      byType: { ...stats({}).byType, hung_piece: { count: 6, avgCpLoss: 350, missed: 1, allowed: 5 } },
      byPhase: { opening: 0, middlegame: 6, endgame: 0 },
      accuracyByPhase: { opening: 100, middlegame: 70, endgame: 100 },
    })
    const leaks = topLeaks(s)
    expect(leaks[0].title).toMatch(/Hanging pieces/)
    expect(leaks.some((l) => /Weakest phase: middlegame/.test(l.title))).toBe(true)
  })

  it('flags time pressure when sub-10s blunder rate is high', () => {
    const s = stats({
      gamesWithClock: 4,
      byTimeBucket: {
        '<10s': { moves: 10, mistakes: 4, blunders: 4, avgCpLoss: 300 },
        '10-30s': { moves: 10, mistakes: 1, blunders: 1, avgCpLoss: 200 },
        '30-60s': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 },
        '60s+': { moves: 20, mistakes: 0, blunders: 0, avgCpLoss: 0 },
      },
    })
    expect(topLeaks(s).some((l) => /Time pressure/.test(l.title))).toBe(true)
  })

  it('reports a clean sheet when there are no mistakes', () => {
    expect(topLeaks(stats({ mistakeCount: 0 }))[0].title).toMatch(/No recurring leaks/)
  })
})
