import { describe, it, expect } from 'vitest'
import { sanToSquares } from './sanToSquares.js'

describe('sanToSquares', () => {
  it('returns from/to for a legal SAN', () => {
    expect(sanToSquares('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e4')).toEqual({ from: 'e2', to: 'e4' })
  })
  it('returns null for an illegal SAN', () => {
    expect(sanToSquares('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'Qd5')).toBeNull()
  })
})
