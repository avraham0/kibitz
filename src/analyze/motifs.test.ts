import { describe, it, expect } from 'vitest'
import { detectMotif } from './motifs.js'

describe('detectMotif — back_rank', () => {
  it('detects a back-rank mate', () => {
    // Re8# — black king g8 boxed by f7/g7/h7 pawns.
    const fen = '6k1/5ppp/8/8/8/8/8/4R2K w - - 0 1'
    expect(detectMotif(fen, ['e1e8'])?.motif).toBe('back_rank')
  })
})

describe('detectMotif — fork', () => {
  it('detects a knight fork that wins a rook', () => {
    // Nf7+ forks Kh8 and Rd8, then Nxd8 wins the rook.
    const fen = '3r3k/8/8/4N3/8/8/8/4K3 w - - 0 1'
    expect(detectMotif(fen, ['e5f7', 'h8g8', 'f7d8'])?.motif).toBe('fork')
  })
})

describe('detectMotif — none', () => {
  it('returns null for a quiet non-tactical move', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    expect(detectMotif(fen, ['a2a3', 'a7a6'])).toBeNull()
  })

  it('returns null on an empty pv', () => {
    expect(detectMotif('8/8/8/8/8/8/8/4K2k w - - 0 1', [])).toBeNull()
  })
})
