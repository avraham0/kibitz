import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MistakeTypesChart } from './MistakeTypesChart.js'
import { TimePressureChart } from './TimePressureChart.js'
import type { Stats } from '../api-types.js'

const base = (over: Partial<Stats>): Stats => ({
  gamesAnalyzed: 10, record: { wins: 3, losses: 7, draws: 0 }, mistakeCount: 9,
  byPhase: { opening: 1, middlegame: 5, endgame: 3 },
  byType: {
    hung_piece: { count: 3, avgCpLoss: 250, missed: 0, allowed: 3 }, missed_tactic: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
    bad_trade: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 }, king_safety: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
    positional: { count: 2, avgCpLoss: 150, missed: 0, allowed: 2 }, fork: { count: 4, avgCpLoss: 300, missed: 2, allowed: 2 },
    pin: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 }, skewer: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
    discovered_attack: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 }, trapped_piece: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
    back_rank: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
  },
  openings: [], topBlunders: [], lostPositionMoves: 0,
  byTimeBucket: { '<10s': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 }, '10-30s': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 }, '30-60s': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 }, '60s+': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 } },
  gamesWithClock: 0, accuracy: 90, accuracyStrict: 80, accuracyByPhase: { opening: 95, middlegame: 85, endgame: 80 },
  conversion: { winningGames: 0, converted: 0 },
  byColor: { white: { games: 0, wins: 0, winPct: 0, accuracy: 100, mistakes: 0 }, black: { games: 0, wins: 0, winPct: 0, accuracy: 100, mistakes: 0 } },
  byOpponent: { stronger: { games: 0, wins: 0, accuracy: 100, mistakes: 0 }, similar: { games: 0, wins: 0, accuracy: 100, mistakes: 0 }, weaker: { games: 0, wins: 0, accuracy: 100, mistakes: 0 } },
  ...over,
})

describe('charts', () => {
  it('renders the mistake-types chart heading without throwing', () => {
    render(<MistakeTypesChart stats={base({})} />)
    expect(screen.getByText(/Mistake types/i)).toBeTruthy()
    expect(screen.getByText(/Click a type to see the games/i)).toBeTruthy()
  })
  it('omits the time-pressure chart when there is no clock data', () => {
    render(<TimePressureChart stats={base({ gamesWithClock: 0 })} />)
    expect(screen.getByText(/No clock data/i)).toBeTruthy()
  })
  it('shows the time-pressure chart when clock data exists', () => {
    render(<TimePressureChart stats={base({ gamesWithClock: 5, byTimeBucket: { '<10s': { moves: 8, mistakes: 3, blunders: 2, avgCpLoss: 300 }, '10-30s': { moves: 10, mistakes: 1, blunders: 1, avgCpLoss: 200 }, '30-60s': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 }, '60s+': { moves: 20, mistakes: 1, blunders: 0, avgCpLoss: 100 } } })} />)
    expect(screen.getByText(/Clock data: 5 of/i)).toBeTruthy()
  })
})
