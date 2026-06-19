import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnalyzeStream } from './useAnalyzeStream.js'

class MockES {
  static last: MockES
  url: string; listeners: Record<string, (e: any) => void> = {}; closed = false
  constructor(url: string) { this.url = url; MockES.last = this }
  addEventListener(t: string, cb: (e: any) => void) { this.listeners[t] = cb }
  close() { this.closed = true }
  emit(t: string, data: unknown) { this.listeners[t]?.({ data: JSON.stringify(data) }) }
}

beforeEach(() => { (globalThis as any).EventSource = MockES as any; localStorage.clear() })

describe('useAnalyzeStream', () => {
  it('moves through running → progress → done with the result', () => {
    const { result } = renderHook(() => useAnalyzeStream())
    act(() => result.current.start({ user: 'bob', depth: '8' }))
    expect(result.current.status).toBe('running')
    expect(MockES.last.url).toContain('user=bob')
    act(() => MockES.last.emit('progress', { done: 1, total: 2 }))
    expect(result.current.progress).toEqual({ done: 1, total: 2 })
    act(() => MockES.last.emit('result', { stats: { gamesAnalyzed: 2 }, suggestions: [], meta: { user: 'bob', since: '2025-06', depth: 8 } }))
    expect(result.current.status).toBe('done')
    expect(result.current.result?.stats.gamesAnalyzed).toBe(2)
    expect(MockES.last.closed).toBe(true)
  })

  it('persists the result and rehydrates it on a fresh mount (survives refresh)', () => {
    const r1 = renderHook(() => useAnalyzeStream())
    act(() => r1.result.current.start({ user: 'bob', depth: '8' }))
    act(() => MockES.last.emit('result', { stats: { gamesAnalyzed: 3 }, suggestions: [], meta: { user: 'bob', since: '2025-06', depth: 8 }, games: [] }))
    // a brand-new hook instance (simulating a page reload) starts already "done" with the stored result
    const r2 = renderHook(() => useAnalyzeStream())
    expect(r2.result.current.status).toBe('done')
    expect(r2.result.current.result?.stats.gamesAnalyzed).toBe(3)
  })

  it('cancel closes the stream and stops running', () => {
    const { result } = renderHook(() => useAnalyzeStream())
    act(() => result.current.start({ user: 'bob' }))
    expect(result.current.status).toBe('running')
    const es = MockES.last
    act(() => result.current.cancel())
    expect(es.closed).toBe(true)
    expect(result.current.status).toBe('idle')
  })

  it('captures an error event', () => {
    const { result } = renderHook(() => useAnalyzeStream())
    act(() => result.current.start({ user: 'nobody' }))
    act(() => MockES.last.emit('error', { message: 'Unknown chess.com user: nobody' }))
    expect(result.current.status).toBe('error')
    expect(result.current.error).toContain('Unknown')
  })
})
