import { describe, it, expect } from 'vitest'
import { aggregate, perGameSummaries } from './aggregate.js'
import type { GameAnalysis, MoveAnalysis } from '../types.js'

describe('aggregate — already-losing exclusion (by eval, report-time)', () => {
  it('excludes real mistakes made in already-losing positions and counts them separately', () => {
    const g = game({
      moves: [
        // already losing (best eval -400 ≤ -200) → excluded even though typed a real mistake
        mv({ severity: 'blunder', cpLoss: 500, type: 'hung_piece', isPlayerMove: true, evalBefore: { cp: -400, mate: null } }),
        // competitive position → counted
        mv({ severity: 'blunder', cpLoss: 300, type: 'fork', isPlayerMove: true, evalBefore: { cp: 50, mate: null } }),
      ],
    })
    const s = aggregate([g])
    expect(s.mistakeCount).toBe(1)
    expect(s.byType.fork.count).toBe(1)
    expect(s.byType.hung_piece.count).toBe(0)
    expect(s.lostPositionMoves).toBe(1)
    expect(s.topBlunders).toHaveLength(1) // the already-losing blunder is not shown
    expect(s.topBlunders[0].type).toBe('fork')
  })

  it('excludes a move made when already ~2 pawns down (−270cp)', () => {
    const g = game({
      moves: [
        mv({ severity: 'blunder', cpLoss: 400, type: 'hung_piece', isPlayerMove: true, evalBefore: { cp: -270, mate: null } }),
      ],
    })
    const s = aggregate([g])
    expect(s.mistakeCount).toBe(0)
    expect(s.lostPositionMoves).toBe(1)
    expect(s.topBlunders).toHaveLength(0)
  })
})

describe('aggregate — accuracy', () => {
  it('is 100 when moves match the eval (no win% drop)', () => {
    const g = game({ moves: [mv({}), mv({})] })
    expect(aggregate([g]).accuracy).toBe(100)
  })
  it('drops sharply on a move that loses a lot of win%', () => {
    const g = game({
      moves: [mv({ severity: 'blunder', cpLoss: 800, evalBefore: { cp: 200, mate: null }, evalAfterPlayed: { cp: 600, mate: null } })],
    })
    expect(aggregate([g]).accuracy).toBeLessThan(80)
  })
  it('scores a best move ~100% even in a non-equal position (no after-search)', () => {
    // Best-move plies store evalAfterPlayed === evalBefore; this must read as no
    // win% drop, not a collapse. A +250 position with a best move ⇒ ~100% accuracy.
    const winning = { cp: 250, mate: null }
    const g = game({ moves: [mv({ isPlayerMove: true, evalBefore: winning, evalAfterPlayed: winning, cpLoss: 0, severity: 'ok' })] })
    expect(aggregate([g]).accuracy).toBeGreaterThanOrEqual(99)
  })

  it('handles the corrected (negated) evalAfterPlayed form too', () => {
    const g = game({ moves: [mv({ isPlayerMove: true, evalBefore: { cp: 250, mate: null }, evalAfterPlayed: { cp: -250, mate: null }, cpLoss: 0, severity: 'ok' })] })
    expect(aggregate([g]).accuracy).toBeGreaterThanOrEqual(99)
  })

  it('reports accuracyStrict (arithmetic mean) >= accuracy (harmonic mean) when blunders present', () => {
    const g = game({
      moves: [
        mv({ isPlayerMove: true }), // clean
        mv({ isPlayerMove: true, severity: 'blunder', cpLoss: 600, evalBefore: { cp: 100, mate: null }, evalAfterPlayed: { cp: 500, mate: null } }),
        mv({ isPlayerMove: true, severity: 'mistake', cpLoss: 150, evalBefore: { cp: 0, mate: null }, evalAfterPlayed: { cp: 200, mate: null } }),
      ],
    })
    const s = aggregate([g])
    expect(s.accuracyStrict).toBeLessThanOrEqual(s.accuracy)
    expect(s.accuracyStrict).toBeLessThan(s.accuracy) // blunders present ⇒ harmonic < arithmetic
  })

  it('reports accuracy per phase, defaulting to 100 for phases with no decisions', () => {
    const g = game({
      moves: [
        mv({ phase: 'opening' }), // clean → 100
        mv({ phase: 'endgame', severity: 'blunder', cpLoss: 800, evalBefore: { cp: 200, mate: null }, evalAfterPlayed: { cp: 600, mate: null } }),
      ],
    })
    const s = aggregate([g])
    expect(s.accuracyByPhase.opening).toBe(100)
    expect(s.accuracyByPhase.endgame).toBeLessThan(80)
    expect(s.accuracyByPhase.middlegame).toBe(100) // no decisions → default
  })
})

describe('aggregate — winning-position conversion', () => {
  it('counts games that reached a winning peak and how many were won', () => {
    const won = game({ result: 'win', moves: [mv({ isPlayerMove: true, evalBefore: { cp: 450, mate: null } })] })
    const blown = game({ result: 'loss', moves: [mv({ isPlayerMove: true, evalBefore: { cp: 450, mate: null } })] })
    const never = game({ result: 'loss', moves: [mv({ isPlayerMove: true, evalBefore: { cp: 50, mate: null } })] })
    const s = aggregate([won, blown, never])
    expect(s.conversion).toEqual({ winningGames: 2, converted: 1 })
  })
})

describe('aggregate — opponent strength split', () => {
  it('bands games by opponent rating relative to the player', () => {
    const strong = game({ playerRating: 1500, opponentRating: 1700, result: 'loss', moves: [mv({ isPlayerMove: true })] })
    const weak = game({ playerRating: 1500, opponentRating: 1300, result: 'win', moves: [mv({ isPlayerMove: true })] })
    const even = game({ playerRating: 1500, opponentRating: 1510, result: 'draw', moves: [mv({ isPlayerMove: true })] })
    const s = aggregate([strong, weak, even])
    expect(s.byOpponent.stronger.games).toBe(1)
    expect(s.byOpponent.weaker.games).toBe(1)
    expect(s.byOpponent.similar.games).toBe(1)
    expect(s.byOpponent.weaker.wins).toBe(1)
  })
})

describe('perGameSummaries — turning point & winning peak', () => {
  it('flags the move that surrendered an equal position and whether the game was winning', () => {
    const g = game({
      result: 'loss',
      moves: [
        mv({ isPlayerMove: true, evalBefore: { cp: 600, mate: null } }), // peak winning
        mv({ isPlayerMove: false, evalBefore: { cp: -550, mate: null } }),
        // player move from ~equal that collapses the position
        mv({ isPlayerMove: true, severity: 'blunder', cpLoss: 800, evalBefore: { cp: 20, mate: null }, evalAfterPlayed: { cp: 700, mate: null } }),
      ],
    })
    const [sum] = perGameSummaries([g])
    expect(sum.wasWinning).toBe(true)
    expect(sum.turningPointIdx).toBe(2)
  })
})

describe('aggregate — color split', () => {
  it('splits games, wins, and mistakes by color', () => {
    const w = game({ color: 'white', result: 'win', moves: [mv({ isPlayerMove: true, severity: 'blunder', cpLoss: 400, type: 'fork' })] })
    const b = game({ color: 'black', result: 'loss', moves: [mv({ isPlayerMove: true })] })
    const s = aggregate([w, b])
    expect(s.byColor.white).toMatchObject({ games: 1, wins: 1, winPct: 100, mistakes: 1 })
    expect(s.byColor.black).toMatchObject({ games: 1, wins: 0, winPct: 0, mistakes: 0 })
  })
})

describe('aggregate — opening grouping (by ECO)', () => {
  const og = (name: string, eco: string): GameAnalysis => ({
    gameId: name, url: name, playedAt: '2026-01-01T00:00:00.000Z',
    color: 'white', result: 'loss', eco, openingName: name, depth: 15, moves: [],
  })
  const games = [
    og('Italian Game', 'C50'),
    og('Giuoco Piano Game Giuoco Pianissimo Variation', 'C50'),
    og('Caro Kann Defense Exchange Variation', 'B13'),
  ]
  it('merges all lines sharing an ECO code into one row, labelled by the shortest name', () => {
    const s = aggregate(games)
    expect(s.openings).toHaveLength(2) // C50 (2 games) + B13 (1)
    const c50 = s.openings.find((o) => o.eco === 'C50')!
    expect(c50.games).toBe(2)
    expect(c50.name).toBe('Italian Game') // shortest name in the C50 group
  })
  it('keeps every line separate with { variations: true }', () => {
    const s = aggregate(games, { variations: true })
    expect(s.openings).toHaveLength(3)
  })
})

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
  playerRating: null, opponentRating: null,
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
    expect(s.openings[0]).toMatchObject({ name: 'Italian', games: 1, wins: 0 })
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
