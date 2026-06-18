import { describe, it, expect } from 'vitest'
import { analyzeGame, cpFromMoverPov } from './game.js'
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
    expect(g.moves[0].cpLoss).toBeGreaterThanOrEqual(0)
    expect(g.moves[0].severity).toBeDefined()
    expect(g.moves[0].isPlayerMove).toBe(true)  // white move, player is white
    expect(g.moves[1].isPlayerMove).toBe(false) // black move
    expect(g.depth).toBe(12)
  })
})
