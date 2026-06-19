import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Dashboard } from './Dashboard.js'
import type { AnalyzeResult } from './api-types.js'

const sample: AnalyzeResult = {
  meta: { user: 'bob', since: '2025-06', depth: 15 },
  games: [],
  suggestions: [{ title: 'Forks are your most common mistake', why: 'w', drill: 'd', impact: 100, examples: [] }],
  stats: {
    gamesAnalyzed: 10, record: { wins: 3, losses: 7, draws: 0 }, mistakeCount: 40,
    byPhase: { opening: 5, middlegame: 25, endgame: 10 },
    byType: {
      hung_piece: { count: 3, avgCpLoss: 250, missed: 0, allowed: 3 },
      missed_tactic: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
      bad_trade: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
      king_safety: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
      positional: { count: 28, avgCpLoss: 150, missed: 0, allowed: 28 },
      fork: { count: 5, avgCpLoss: 300, missed: 2, allowed: 3 },
      pin: { count: 4, avgCpLoss: 200, missed: 1, allowed: 3 }, skewer: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
      discovered_attack: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 }, trapped_piece: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
      back_rank: { count: 0, avgCpLoss: 0, missed: 0, allowed: 0 },
    },
    openings: [{ eco: 'C50', name: 'Italian Game', games: 4, wins: 1, winPct: 25, avgMistakes: 4.2 }],
    topBlunders: [],
    lostPositionMoves: 12,
    byTimeBucket: { '<10s': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 }, '10-30s': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 }, '30-60s': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 }, '60s+': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 } },
    gamesWithClock: 0, accuracy: 88, accuracyStrict: 76, accuracyByPhase: { opening: 95, middlegame: 85, endgame: 80 },
    conversion: { winningGames: 3, converted: 2 },
    byColor: { white: { games: 2, wins: 1, winPct: 50, accuracy: 89, mistakes: 5 }, black: { games: 2, wins: 0, winPct: 0, accuracy: 84, mistakes: 7 } },
  },
}

describe('Dashboard', () => {
  it('renders summary, openings, and coaching', () => {
    render(<Dashboard result={sample} />)
    expect(screen.getByText('3W-7L-0D')).toBeTruthy()
    expect(screen.getByText('88%')).toBeTruthy() // accuracy tile value
    expect(screen.getByText('Italian Game')).toBeTruthy()
    expect(screen.getByText(/Forks are your most common mistake/)).toBeTruthy()
  })

  it('switches tabs (overview content hidden on the blunders tab)', () => {
    render(<Dashboard result={sample} />)
    expect(screen.queryByText('Top blunders')).toBeNull() // blunders behind a tab
    fireEvent.click(screen.getByRole('button', { name: /blunders/i }))
    expect(screen.getByText('Top blunders')).toBeTruthy()
    expect(screen.queryByText('88%')).toBeNull() // overview hidden now
  })
})
