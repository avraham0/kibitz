import { describe, it, expect } from 'vitest'
import { aggregate } from './aggregate.js'
import type { GameAnalysis, MoveAnalysis } from '../types.js'

function mv(p: Partial<MoveAnalysis>): MoveAnalysis {
  return {
    ply: 1, fenBefore: 'x', san: 'e4', bestSan: 'd4',
    evalBefore: { cp: 0, mate: null }, evalAfterPlayed: { cp: 0, mate: null },
    cpLoss: 0, severity: 'ok', type: 'positional', phase: 'middlegame',
    clockSeconds: null, isPlayerMove: true, missed: false, ...p,
  }
}

const game = (over: Partial<GameAnalysis>): GameAnalysis => ({
  gameId: 'g', url: 'u', playedAt: '2026-01-01T00:00:00.000Z',
  color: 'white', result: 'win', eco: 'C50', openingName: 'Italian',
  depth: 15, moves: [], ...over,
})

describe('aggregate', () => {
  it('counts only player mistakes and rolls up phase/type/openings/blunders', () => {
    const g = game({
      result: 'loss',
      moves: [
        mv({ severity: 'blunder', cpLoss: 400, type: 'hung_piece', phase: 'middlegame', isPlayerMove: true, san: 'Qd5', bestSan: 'Nf3' }),
        mv({ severity: 'mistake', cpLoss: 150, type: 'hung_piece', phase: 'endgame', isPlayerMove: true }),
        mv({ severity: 'blunder', cpLoss: 999, type: 'missed_tactic', phase: 'middlegame', isPlayerMove: false }), // opponent, ignored
      ],
    })
    const s = aggregate([g])
    expect(s.gamesAnalyzed).toBe(1)
    expect(s.record).toEqual({ wins: 0, losses: 1, draws: 0 })
    expect(s.mistakeCount).toBe(2)
    expect(s.byPhase.middlegame).toBe(1)
    expect(s.byPhase.endgame).toBe(1)
    expect(s.byType.hung_piece.count).toBe(2)
    expect(s.byType.hung_piece.avgCpLoss).toBe(275)
    expect(s.openings[0]).toMatchObject({ eco: 'C50', games: 1, wins: 0 })
    expect(s.topBlunders[0].cpLoss).toBe(400) // only player blunders
    expect(s.topBlunders.every((b) => b.cpLoss >= 300)).toBe(true)
  })

  it('excludes lost_position moves from mistakeCount/byType and counts them in lostPositionMoves', () => {
    const g = game({
      result: 'loss',
      moves: [
        mv({ severity: 'blunder', cpLoss: 400, type: 'hung_piece', phase: 'middlegame', isPlayerMove: true }),
        mv({ severity: 'blunder', cpLoss: 800, type: 'lost_position', phase: 'endgame', isPlayerMove: true }),
        mv({ severity: 'ok', cpLoss: 10, type: 'lost_position', phase: 'endgame', isPlayerMove: true }),
      ],
    })
    const s = aggregate([g])
    expect(s.mistakeCount).toBe(1) // only the hung_piece blunder
    expect(s.byPhase.middlegame).toBe(1)
    expect(s.byPhase.endgame).toBe(0) // lost_position not counted
    expect(s.byType.hung_piece.count).toBe(1)
    // byType should NOT have a lost_position key
    expect(Object.keys(s.byType)).not.toContain('lost_position')
    expect(s.lostPositionMoves).toBe(2) // both lost_position isPlayerMove moves
    expect(s.topBlunders.every((b) => b.type !== 'lost_position')).toBe(true)
  })

  it('splits motif mistakes into missed and allowed', () => {
    const g = game({
      result: 'loss',
      moves: [
        mv({ severity: 'blunder', cpLoss: 400, type: 'fork', missed: false, isPlayerMove: true }),
        mv({ severity: 'mistake', cpLoss: 150, type: 'fork', missed: true, isPlayerMove: true }),
        mv({ severity: 'blunder', cpLoss: 900, type: 'fork', missed: true, isPlayerMove: false }), // opponent, ignored
      ],
    })
    const s = aggregate([g])
    expect(s.byType.fork.count).toBe(2)
    expect(s.byType.fork.allowed).toBe(1)
    expect(s.byType.fork.missed).toBe(1)
    expect(s.byType.fork.avgCpLoss).toBe(275)
  })
})

describe('aggregate — time buckets', () => {
  it('buckets clocked player moves; excludes opponent and clockless moves', () => {
    const g = game({
      moves: [
        mv({ isPlayerMove: true, clockSeconds: 5, severity: 'blunder', cpLoss: 400, type: 'hung_piece' }),
        mv({ isPlayerMove: true, clockSeconds: 20, severity: 'mistake', cpLoss: 100, type: 'positional' }),
        mv({ isPlayerMove: true, clockSeconds: 120, severity: 'ok', cpLoss: 0, type: 'positional' }),
        mv({ isPlayerMove: true, clockSeconds: 8, severity: 'blunder', cpLoss: 600, type: 'lost_position' }),
        mv({ isPlayerMove: false, clockSeconds: 5, severity: 'blunder', cpLoss: 900, type: 'fork' }),
        mv({ isPlayerMove: true, clockSeconds: null, severity: 'blunder', cpLoss: 300, type: 'fork' }),
      ],
    })
    const s = aggregate([g])
    // <10s: clock 5 (mistake/blunder) + clock 8 (lost_position → denominator only)
    expect(s.byTimeBucket['<10s'].moves).toBe(2)
    expect(s.byTimeBucket['<10s'].mistakes).toBe(1)
    expect(s.byTimeBucket['<10s'].blunders).toBe(1)
    expect(s.byTimeBucket['<10s'].avgCpLoss).toBe(400)
    // 10-30s: the cp100 mistake
    expect(s.byTimeBucket['10-30s'].moves).toBe(1)
    expect(s.byTimeBucket['10-30s'].mistakes).toBe(1)
    // 60s+: the ok move is a decision but not a mistake
    expect(s.byTimeBucket['60s+'].moves).toBe(1)
    expect(s.byTimeBucket['60s+'].mistakes).toBe(0)
    expect(s.gamesWithClock).toBe(1)
  })

  it('does not count a game without any clock data', () => {
    const g = game({ moves: [mv({ isPlayerMove: true, clockSeconds: null, severity: 'blunder', cpLoss: 300, type: 'fork' })] })
    expect(aggregate([g]).gamesWithClock).toBe(0)
  })
})
