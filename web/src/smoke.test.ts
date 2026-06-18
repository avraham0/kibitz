import { describe, it, expect } from 'vitest'
import { TIME_BUCKETS } from './api-types.js'

describe('web scaffold', () => {
  it('exposes the time buckets', () => {
    expect(TIME_BUCKETS).toHaveLength(4)
  })
})
