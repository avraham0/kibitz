import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameReview } from './GameReview.js'
import type { GameSummary } from '../api-types.js'

const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
const games: GameSummary[] = [
  {
    gameId: 'g', url: 'u', playedAt: '2026-01-02T00:00:00.000Z', color: 'white',
    result: 'win', eco: 'C50', openingName: 'Italian Game', accuracy: 88,
    moves: [
      { ply: 1, san: 'e4', evalCp: 30, cpLoss: 0, isPlayerMove: true, fenBefore: start },
      { ply: 2, san: 'e5', evalCp: 20, cpLoss: 0, isPlayerMove: false, fenBefore: afterE4 },
    ],
  },
]

describe('GameReview', () => {
  it('renders the game selector and steps through moves', () => {
    render(<GameReview games={games} />)
    expect(screen.getByText('Game review')).toBeTruthy()
    expect(screen.getByText(/Italian Game/)).toBeTruthy()
    expect(screen.getByText(/· e4/)).toBeTruthy() // first move shown
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(/· e5/)).toBeTruthy() // advanced to second move
  })

  it('renders nothing when there are no games', () => {
    const { container } = render(<GameReview games={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
