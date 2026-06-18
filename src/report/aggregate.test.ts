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
