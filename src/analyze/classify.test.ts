import { describe, it, expect } from 'vitest'
import { maxHangingGain, classifyMistake } from './classify.js'

describe('maxHangingGain', () => {
  it('detects a free undefended queen capture', () => {
    // White to move; black queen on d5 undefended, white bishop on g2 can take.
    const fen = '4k3/8/8/3q4/8/8/6B1/4K3 w - - 0 1'
    expect(maxHangingGain(fen)).toBe(900)
  })
  it('is zero when nothing hangs', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    expect(maxHangingGain(fen)).toBe(0)
  })
})

describe('classifyMistake', () => {
  it('flags hung_piece when the move leaves a piece free to take', () => {
    // White to move plays Bg2-b7?? hanging nothing here; construct a real hang:
    // White queen on d1 moves to d5 where black pawn c6 can capture for free.
    const fenBefore = 'rnbqkbnr/pp1ppppp/2p5/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const t = classifyMistake({ fenBefore, san: 'Qd5', bestUci: 'g1f3' })
    expect(t).toBe('hung_piece')
  })

  it('flags king_safety when a non-castling king move forfeits castling rights', () => {
    const fenBefore = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
    const t = classifyMistake({ fenBefore, san: 'Ke2', bestUci: 'g1f3' })
    expect(t).toBe('king_safety')
  })

  it('falls back to positional when no motif matches', () => {
    const fenBefore = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const t = classifyMistake({ fenBefore, san: 'a3', bestUci: 'e2e4' })
    expect(t).toBe('positional')
  })
})
