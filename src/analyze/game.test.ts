import { describe, it, expect } from 'vitest'
import { analyzeGame, cpFromMoverPov, MAX_CPLOSS, LOST_POSITION_CP } from './game.js'
import type { RawGame } from '../types.js'

describe('cpFromMoverPov', () => {
  it('maps cp directly and mate to large signed values', () => {
    expect(cpFromMoverPov({ cp: 35, mate: null })).toBe(35)
    expect(cpFromMoverPov({ cp: null, mate: 1 })).toBeGreaterThan(90000)
    expect(cpFromMoverPov({ cp: null, mate: -2 })).toBeLessThan(-90000)
  })
})

describe('analyzeGame', () => {
  it('computes cpLoss and severity per move using the injected evaluator', async () => {
    const raw: RawGame = {
      gameId: 'g', url: 'g', playedAt: '2026-01-01T00:00:00.000Z',
      color: 'white', result: 'loss', eco: 'C20', openingName: 'KP',
      moves: [
        { san: 'e4', fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', clockSeconds: 180 },
        { san: 'e5', fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', clockSeconds: 178 },
      ],
    }
    // Evaluator: first ply best is e4 (no loss); after e4 opponent eval small.
    const evaluate = async (fen: string) => {
      if (fen.includes(' w ')) return { eval: { cp: 30, mate: null }, bestUci: 'e2e4' }
      return { eval: { cp: 20, mate: null }, bestUci: 'e7e5' }
    }
    const g = await analyzeGame(raw, 12, evaluate as any)
    expect(g.moves).toHaveLength(2)
    expect(g.moves[0].cpLoss).toBe(50)
    expect(g.moves[1].cpLoss).toBe(50)
    expect(g.moves[0].severity).toBeDefined()
    expect(g.moves[0].isPlayerMove).toBe(true)  // white move, player is white
    expect(g.moves[1].isPlayerMove).toBe(false) // black move
    expect(g.depth).toBe(12)
  })

  it('marks moves as lost_position when best eval at fenBefore is <= LOST_POSITION_CP', async () => {
    const raw: RawGame = {
      gameId: 'g3', url: 'g3', playedAt: '2026-01-01T00:00:00.000Z',
      color: 'white', result: 'loss', eco: 'C20', openingName: 'KP',
      moves: [
        { san: 'e4', fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', clockSeconds: null },
      ],
    }
    // Evaluator returns a clearly losing best eval (-800 cp) for fenBefore
    const evaluate = async (fen: string) => {
      if (fen.includes(' w ')) return { eval: { cp: -800, mate: null }, bestUci: 'e2e4' }
      return { eval: { cp: 20, mate: null }, bestUci: 'e7e5' }
    }
    const g = await analyzeGame(raw, 12, evaluate as any)
    expect(g.moves[0].type).toBe('lost_position')
  })

  it('exports LOST_POSITION_CP constant', () => {
    expect(LOST_POSITION_CP).toBe(-500)
  })

  it('caps cpLoss at MAX_CPLOSS on a mate swing and still classifies as blunder', async () => {
    // fenBefore: white to move; evaluator says +50 cp (normal eval)
    // After played move (e4), opponent has a forced mate in 1 → cpFromMoverPov returns a large negative value from mover's pov
    const raw: RawGame = {
      gameId: 'g2', url: 'g2', playedAt: '2026-01-01T00:00:00.000Z',
      color: 'white', result: 'loss', eco: 'C20', openingName: 'KP',
      moves: [
        { san: 'e4', fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', clockSeconds: 180 },
      ],
    }
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
