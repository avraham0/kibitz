import { describe, it, expect } from 'vitest'
import { soundForSan } from './sound.js'

describe('soundForSan', () => {
  it('uses the capture sound only for captures', () => {
    expect(soundForSan('Nf3')).toBe('move')
    expect(soundForSan('Qh5+')).toBe('move')
    expect(soundForSan('O-O')).toBe('move')
    expect(soundForSan('exd5')).toBe('capture')
    expect(soundForSan('Rxe8#')).toBe('capture')
  })
})
