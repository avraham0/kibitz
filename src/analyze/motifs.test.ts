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

describe('detectMotif — discovered_attack', () => {
  it('detects a discovered check', () => {
    // Nc6+ : knight leaves e5, uncovering Re1–e8 check.
    const fen = '4k3/8/8/4N3/8/8/8/4R1K1 w - - 0 1'
    expect(detectMotif(fen, ['e5c6'])?.motif).toBe('discovered_attack')
  })
})

describe('detectMotif — skewer', () => {
  it('detects a skewer winning the piece behind the king', () => {
    // Bb2+ Kg6 Bxh8 — check forces the king off the long diagonal, winning the queen behind it.
    const fen = '7q/6k1/8/8/8/8/8/B3K3 w - - 0 1'
    expect(detectMotif(fen, ['a1b2', 'g7g6', 'b2h8'])?.motif).toBe('skewer')
  })
})

describe('detectMotif — pin', () => {
  it('detects an absolute pin', () => {
    // Bb5 pins the c6 knight to the e8 king.
    const fen = '4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1'
    expect(detectMotif(fen, ['f1b5'])?.motif).toBe('pin')
  })
})

describe('detectMotif — trapped_piece', () => {
  it('detects a piece with no safe square that is then won', () => {
    // Kg2 traps the h2 bishop (Bg1 and Bxg3 both lose it); after a waiting move, Kxh2.
    const fen = '4k3/p7/8/8/8/6P1/5K1b/8 w - - 0 1'
    expect(detectMotif(fen, ['f2g2', 'a7a6', 'g2h2'])?.motif).toBe('trapped_piece')
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

describe('detectMotif — pin tightening (relative pin, no material won)', () => {
  it('does NOT detect pin when a relative pin wins no material within 3 plies', () => {
    // White rook on d1 plays Rd3, attacking the black knight on d5 with the black queen
    // on d8 behind it on the same file (queen > knight: relative pin geometry is present).
    // PV is only 1 move long so beneficiaryGain(ctx, 3) = 0 — the pin nets nothing.
    // Expected: motif is NOT 'pin' (should be null since no higher-priority motif fires).
    const fen = '3qk3/8/8/3n4/8/8/8/3RK3 w - - 0 1'
    const result = detectMotif(fen, ['d1d3'])
    expect(result?.motif).not.toBe('pin')
  })
})

describe('detectMotif — trapped_piece tightening (even trade → not trapped)', () => {
  it('does NOT detect trapped_piece when the capture only wins a pawn (< 200 cp gain)', () => {
    // White king on e1, white rook on b1, black pawn on b6 (attacked by Rb1, only escape
    // is b5 which is also attacked by Rb1 — the pawn is genuinely trapped).
    // White plays Ke1d1 (quiet king move). Black plays Ke8e7. White then Rb1xb6, winning a
    // pawn (+100 cp). beneficiaryGain(ctx, 4) = 100 < 200 — an insignificant capture.
    // Expected: motif is NOT 'trapped_piece'.
    const fen = '4k3/8/1p6/8/8/8/8/1R2K3 w - - 0 1'
    const result = detectMotif(fen, ['e1d1', 'e8e7', 'b1b6'])
    expect(result?.motif).not.toBe('trapped_piece')
  })
})
