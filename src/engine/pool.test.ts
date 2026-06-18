import { describe, it, expect, afterAll } from 'vitest'
import { EnginePool, autoConcurrency } from './pool.js'

describe('autoConcurrency', () => {
  it('returns a sensible capped value (1..4)', () => {
    const n = autoConcurrency()
    expect(n).toBeGreaterThanOrEqual(1)
    expect(n).toBeLessThanOrEqual(4)
  })
})

let pool: EnginePool

describe('EnginePool', () => {
  it('boots N engines whose evaluators each return a legal best move', async () => {
    pool = await EnginePool.create(2)
    expect(pool.size).toBe(2)
    expect(pool.evaluators).toHaveLength(2)
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    // Run both engines concurrently — proves they are independent instances.
    const results = await Promise.all(pool.evaluators.map((e) => e(start, 8)))
    for (const r of results) {
      expect(r.bestUci).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/)
      expect(Array.isArray(r.pv)).toBe(true)
    }
  }, 30_000)
})

afterAll(() => pool?.quit())
