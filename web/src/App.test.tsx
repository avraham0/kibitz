import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import App from './App.js'

class MockES {
  static last: MockES
  listeners: Record<string, (e: any) => void> = {}; closed = false
  constructor(public url: string) { MockES.last = this }
  addEventListener(t: string, cb: (e: any) => void) { this.listeners[t] = cb }
  close() { this.closed = true }
  emit(t: string, data: unknown) { this.listeners[t]?.({ data: JSON.stringify(data) }) }
}
beforeEach(() => { (globalThis as any).EventSource = MockES as any; localStorage.clear() })

const result = {
  meta: { user: 'bob', since: '2025-06', depth: 8 }, suggestions: [], games: [],
  stats: { gamesAnalyzed: 1, record: { wins: 1, losses: 0, draws: 0 }, mistakeCount: 0,
    byPhase: { opening: 0, middlegame: 0, endgame: 0 },
    byType: Object.fromEntries(['hung_piece','missed_tactic','bad_trade','king_safety','positional','fork','pin','skewer','discovered_attack','trapped_piece','back_rank'].map((t) => [t, { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 }])),
    openings: [], topBlunders: [], lostPositionMoves: 0,
    byTimeBucket: { '<10s': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 }, '10-30s': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 }, '30-60s': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 }, '60s+': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 } },
    gamesWithClock: 0, accuracy: 90 },
}

describe('App', () => {
  it('runs a full analyze flow', () => {
    render(<App />)
    fireEvent.change(screen.getByPlaceholderText('username'), { target: { value: 'bob' } })
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }))
    act(() => MockES.last.emit('progress', { done: 1, total: 1 }))
    expect(screen.getByText(/Analyzing/)).toBeTruthy()
    act(() => MockES.last.emit('result', result))
    expect(screen.getByText(/Summary/)).toBeTruthy()
  })
})
