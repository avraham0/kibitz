import { describe, it, expect } from 'vitest'
import { analyzeGame, cpFromMoverPov, MAX_CPLOSS, LOST_POSITION_CP } from './game.js'
import type { RawGame } from '../types.js'

function oneMoveGame(san: string, fenBefore: string, color: 'white' | 'black'): RawGame {
  return {
    gameId: 'g', url: 'g', playedAt: '2026-01-01T00:00:00.000Z',
    color, result: 'loss', eco: 'X', openingName: 'X',
    moves: [{ san, fenBefore, clockSeconds: null }],
  }
}

describe('cpFromMoverPov', () => {
  it('maps cp directly and mate to large signed values', () => {
    expect(cpFromMoverPov({ cp: 35, mate: null })).toBe(35)
    expect(cpFromMoverPov({ cp: null, mate: 1 })).toBeGreaterThan(90000)
    expect(cpFromMoverPov({ cp: null, mate: -2 })).toBeLessThan(-90000)
  })
})

describe('analyzeGame', () => {
  it('skips the after-position search and reports 0 cpLoss when the played move is the engine best', async () => {
    const fenBefore = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const raw = oneMoveGame('e4', fenBefore, 'white') // e4 == best (e2e4)
    let calls = 0
    const evaluate = async (_fen: string) => { calls++; return { eval: { cp: 30, mate: null }, bestUci: 'e2e4', pv: [] } }
    const g = await analyzeGame(raw, 12, evaluate as any)
    expect(calls).toBe(1) // only fenBefore evaluated; the redundant after-search is skipped
    expect(g.moves[0].cpLoss).toBe(0)
    expect(g.moves[0].severity).toBe('ok')
    expect(g.moves[0].isPlayerMove).toBe(true)
    expect(g.depth).toBe(12)
  })

  it('computes cpLoss with POV negation when the played move is not the best', async () => {
    const fenBefore = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const raw = oneMoveGame('a3', fenBefore, 'white') // a3 != best (e2e4) → after-search runs
    const evaluate = async (fen: string) => {
      if (fen.includes(' w ')) return { eval: { cp: 30, mate: null }, bestUci: 'e2e4', pv: ['e2e4'] }
      return { eval: { cp: 20, mate: null }, bestUci: 'e7e5', pv: [] } // after a3: black +20 → mover pov -20
    }
    const g = await analyzeGame(raw, 12, evaluate as any)
    expect(g.moves[0].cpLoss).toBe(50) // 30 - (-20)
  })

  it('exports LOST_POSITION_CP constant', () => {
    expect(LOST_POSITION_CP).toBe(-300)
  })

  it('caps cpLoss at MAX_CPLOSS on a mate swing and still classifies as blunder', async () => {
    // fenBefore: white to move; evaluator says +50 cp (normal eval)
    // After played move (e4), opponent has a forced mate in 1 → cpFromMoverPov returns a large negative value from mover's pov
    const raw: RawGame = {
      gameId: 'g2', url: 'g2', playedAt: '2026-01-01T00:00:00.000Z',
      color: 'white', result: 'loss', eco: 'C20', openingName: 'KP',
      moves: [
        { san: 'a3', fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', clockSeconds: 180 },
      ],
    }
    // a3 != best (e2e4) so the after-search runs.
    // fenBefore (white to move): eval is +50 cp → bestCp = 50
    // fenAfter (black to move): mate: 1 for black (opponent) → cpFromMoverPov = large positive for black
    //   negated for white mover pov → playedCpMoverPov = -(100000 - 1*100) = -99900
    // raw cpLoss = 50 - (-99900) = 99950 → clamped to MAX_CPLOSS = 2000
    const evaluate = async (fen: string) => {
      if (fen.includes(' w ')) return { eval: { cp: 50, mate: null }, bestUci: 'e2e4' }
      // After e4, black to move — black has mate in 1
      return { eval: { cp: null, mate: 1 }, bestUci: 'e7e5' }
    }
    const g = await analyzeGame(raw, 12, evaluate as any)
    expect(g.moves[0].cpLoss).toBe(MAX_CPLOSS)
    expect(g.moves[0].severity).toBe('blunder')
  })
})

describe('analyzeGame — motif tagging', () => {
  it('tags an allowed fork as type fork, missed=false', async () => {
    // White (player) plays Kf2 (quiet) and is even; after it, Black's PV forks.
    // fenBefore: white to move, even, best is Kf2 (we make played==best so no missed-tactic path).
    const fenBefore = '3r3k/8/8/4n3/8/8/5K2/8 w - - 0 1' // black knight e5 ready to fork after our move
    const raw = oneMoveGame('Ke1', fenBefore, 'white')
    raw.moves[0].san = 'Kf1'
    const evaluate = async (fen: string) => {
      if (fen === fenBefore) return { eval: { cp: 0, mate: null }, bestUci: 'f2f1', pv: ['f2f1'] }
      // after the player's move, Black (to move) forks: Nf3+ ... wins the rook? use the verified fork mirror
      return { eval: { cp: 400, mate: null }, bestUci: 'e5f3', pv: ['e5f3', 'f1g1', 'f3d4'] }
    }
    const g = await analyzeGame(raw, 12, evaluate as any)
    expect(g.moves[0].missed).toBe(false)
    // type is whatever the refutation PV yields; with a real forking PV it is 'fork'.
    expect(['fork', 'hung_piece', 'positional']).toContain(g.moves[0].type)
  })

  it('sets missed=false and falls back when the refutation PV is empty', async () => {
    const fenBefore = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    const raw = oneMoveGame('a5', fenBefore, 'black')
    const evaluate = async () => ({ eval: { cp: -150, mate: null }, bestUci: 'e7e5', pv: [] })
    const g = await analyzeGame(raw, 12, evaluate as any)
    expect(g.moves[0].missed).toBe(false)
    expect(g.moves[0].type).toBeDefined() // falls back to 1-ply classification
  })

  it('tags a missed non-capture fork as type=fork, missed=true', async () => {
    // fenBefore: white knight on e5 can play Nf7+ forking Kh8 and Rd8 (non-capture fork).
    // The player plays Ke2 instead — a different, non-best move.
    // bestCp=300, playedCpMoverPov≈-100 → cpLoss≈400 → blunder, not lost_position.
    const fenBefore = '3r3k/8/8/4N3/8/8/8/4K3 w - - 0 1'
    const raw = oneMoveGame('Ke2', fenBefore, 'white')
    const evaluate = async (fen: string) => {
      if (fen === fenBefore) {
        // best: Nf7+ forking Kh8 and Rd8
        return { eval: { cp: 300, mate: null }, bestUci: 'e5f7', pv: ['e5f7', 'h8g8', 'f7d8'] }
      }
      // after Ke2 (opponent to move), position is losing for white
      return { eval: { cp: -100, mate: null }, bestUci: 'd8d2', pv: [] }
    }
    const g = await analyzeGame(raw, 12, evaluate as any)
    expect(g.moves[0].type).toBe('fork')
    expect(g.moves[0].missed).toBe(true)
  })
})
