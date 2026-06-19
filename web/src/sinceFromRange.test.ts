import { describe, it, expect } from 'vitest'
import { sinceFromRange } from './sinceFromRange.js'

describe('sinceFromRange', () => {
  const now = new Date(Date.UTC(2026, 5, 19)) // 2026-06-19

  it('counts back whole months', () => {
    expect(sinceFromRange('1month', now)).toBe('2026-05')
    expect(sinceFromRange('3month', now)).toBe('2026-03')
    expect(sinceFromRange('6month', now)).toBe('2025-12')
    expect(sinceFromRange('1year', now)).toBe('2025-06')
  })

  it('rolls the year over at January', () => {
    expect(sinceFromRange('3month', new Date(Date.UTC(2026, 0, 15)))).toBe('2025-10')
  })
})
