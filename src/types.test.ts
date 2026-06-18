import { describe, it, expect } from 'vitest'
import { cpLossToSeverity, PIECE_VALUE } from './types.js'

describe('cpLossToSeverity', () => {
  it('classifies by centipawn loss thresholds', () => {
    expect(cpLossToSeverity(0)).toBe('ok')
    expect(cpLossToSeverity(49)).toBe('ok')
    expect(cpLossToSeverity(50)).toBe('inaccuracy')
    expect(cpLossToSeverity(100)).toBe('mistake')
    expect(cpLossToSeverity(299)).toBe('mistake')
    expect(cpLossToSeverity(300)).toBe('blunder')
  })
})

describe('PIECE_VALUE', () => {
  it('uses standard centipawn values', () => {
    expect(PIECE_VALUE.q).toBe(900)
    expect(PIECE_VALUE.p).toBe(100)
  })
})
