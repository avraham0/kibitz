import { describe, it, expect } from 'vitest'
import { writeSse } from './sse.js'

describe('writeSse', () => {
  it('formats an SSE message with event, JSON data, and blank-line terminator', () => {
    const chunks: string[] = []
    writeSse((c) => chunks.push(c), 'progress', { done: 2, total: 5 })
    expect(chunks.join('')).toBe('event: progress\ndata: {"done":2,"total":5}\n\n')
  })
})
