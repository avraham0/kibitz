import { describe, it, expect } from 'vitest'
import { soundForSan } from './sound.js'

describe('soundForSan', () => {
  it('classifies move kinds from SAN', () => {
    expect(soundForSan('Nf3')).toBe('move')
    expect(soundForSan('exd5')).toBe('capture')
    expect(soundForSan('Qh5+')).toBe('check')
    expect(soundForSan('Rxe8#')).toBe('check') // mate counts as check sound
    expect(soundForSan('O-O')).toBe('castle')
    expect(soundForSan('O-O-O')).toBe('castle')
  })
})
