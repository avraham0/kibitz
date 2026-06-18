import { describe, it, expect } from 'vitest'
import { orientationFromFen } from './orientationFromFen.js'

describe('orientationFromFen', () => {
  it('orients white when white is to move', () => {
    expect(orientationFromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe('white')
  })
  it('orients black when black is to move', () => {
    expect(orientationFromFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')).toBe('black')
  })
})
