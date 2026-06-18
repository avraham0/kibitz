import { describe, it, expect } from 'vitest'
import { detectPhase } from './phase.js'

describe('detectPhase', () => {
  it('is opening for early plies regardless of material', () => {
    expect(detectPhase('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 1)).toBe('opening')
  })
  it('is endgame when few pieces remain', () => {
    // K+R vs K+R, late.
    expect(detectPhase('8/8/4k3/8/8/3K4/4R3/4r3 w - - 0 40', 60)).toBe('endgame')
  })
  it('is middlegame for a full board past the opening', () => {
    const fen = 'r2q1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 9'
    expect(detectPhase(fen, 30)).toBe('middlegame')
  })
})
