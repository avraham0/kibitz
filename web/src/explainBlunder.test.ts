import { describe, it, expect } from 'vitest'
import { explainBlunder } from './explainBlunder.js'
import type { BlunderRef } from './api-types.js'

const b = (over: Partial<BlunderRef>): BlunderRef => ({
  url: 'u', ply: 10, san: 'Qd5', bestSan: 'Nf3', fenBefore: 'f', cpLoss: 400, type: 'hung_piece', missed: false, openingName: '', movesAfter: [], ...over,
})

describe('explainBlunder', () => {
  it('distinguishes missed vs allowed tactics', () => {
    expect(explainBlunder(b({ type: 'fork', missed: true }))).toMatch(/Missed a fork/)
    expect(explainBlunder(b({ type: 'fork', missed: false }))).toMatch(/Allowed a fork/)
  })
  it('explains a hung piece with the best move (no pawn count)', () => {
    const s = explainBlunder(b({ type: 'hung_piece', bestSan: 'Nf3' }))
    expect(s).toMatch(/undefended/)
    expect(s).toMatch(/Nf3/)
    expect(s).not.toMatch(/pawns/)
  })
})
