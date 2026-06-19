import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Splits } from './Splits.js'
import type { Stats, GameSummary } from '../api-types.js'

const base = {
  conversion: { winningGames: 4, converted: 3 },
  byColor: {
    white: { games: 6, wins: 4, winPct: 67, accuracy: 88, mistakes: 9 },
    black: { games: 4, wins: 1, winPct: 25, accuracy: 79, mistakes: 11 },
  },
  byOpponent: {
    stronger: { games: 3, wins: 1, accuracy: 80, mistakes: 6 },
    similar: { games: 5, wins: 3, accuracy: 85, mistakes: 8 },
    weaker: { games: 2, wins: 1, accuracy: 90, mistakes: 2 },
  },
} as unknown as Stats

describe('Splits', () => {
  it('shows conversion rate and per-color rows', () => {
    render(<Splits stats={base} />)
    expect(screen.getByText(/3 \/ 4/)).toBeTruthy()
    expect(screen.getByText(/75%/)).toBeTruthy() // 3/4 converted
    expect(screen.getByText('white')).toBeTruthy()
    expect(screen.getByText('black')).toBeTruthy()
  })

  it('handles no winning positions gracefully', () => {
    const s = { ...base, conversion: { winningGames: 0, converted: 0 } } as unknown as Stats
    render(<Splits stats={s} />)
    expect(screen.getByText(/No clearly winning positions/)).toBeTruthy()
  })

  it('drills into games you were winning but did not win, jumping to the turning point', () => {
    const blown: GameSummary = {
      gameId: 'g1', url: 'u', playedAt: '2026-03-04T00:00:00.000Z', color: 'white',
      result: 'loss', eco: 'C50', openingName: 'Italian', accuracy: 70, accuracyStrict: 55,
      accuracyByPhase: { opening: 72, middlegame: 68, endgame: 100 },
      playerRating: 1500, opponentRating: 1490, wasWinning: true, turningPointIdx: 17, moves: [],
    }
    const onOpenGame = vi.fn()
    render(<Splits stats={base} games={[blown]} onOpenGame={onOpenGame} />)
    fireEvent.click(screen.getByText(/you let slip/))
    fireEvent.click(screen.getByRole('button', { name: /review/i }))
    expect(onOpenGame).toHaveBeenCalledWith('g1', 17)
  })
})
