import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameReview } from './GameReview.js'
import type { GameSummary } from '../api-types.js'

const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
const afterE4E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
const games: GameSummary[] = [
  {
    gameId: 'g', url: 'u', playedAt: '2026-01-02T00:00:00.000Z', color: 'white',
    result: 'win', eco: 'C50', openingName: 'Italian Game', accuracy: 88, accuracyStrict: 75,
    moves: [
      { ply: 1, san: 'e4', bestSan: 'e4', evalCp: 30, cpLoss: 0, isPlayerMove: true, severity: 'ok', type: 'positional', fenBefore: start, phase: 'opening', clockSeconds: 180 },
      { ply: 2, san: 'e5', bestSan: 'e5', evalCp: 20, cpLoss: 0, isPlayerMove: false, severity: 'ok', type: 'positional', fenBefore: afterE4, phase: 'opening', clockSeconds: 178 },
      { ply: 3, san: 'a3', bestSan: 'd4', evalCp: -400, cpLoss: 400, isPlayerMove: true, severity: 'blunder', type: 'hung_piece', fenBefore: afterE4E5, phase: 'middlegame', clockSeconds: 8 },
    ],
  },
]

describe('GameReview', () => {
  it('renders the game selector and steps through moves', () => {
    render(<GameReview games={games} />)
    expect(screen.getByText('Game review')).toBeTruthy()
    expect(screen.getByText(/Italian Game/)).toBeTruthy()
    expect(screen.getByText(/· e4/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(/· e5/)).toBeTruthy()
  })

  it('shows the mistake and best move when stepping onto a player blunder', () => {
    render(<GameReview games={games} />)
    fireEvent.click(screen.getByRole('button', { name: /next/i })) // → e5
    fireEvent.click(screen.getByRole('button', { name: /next/i })) // → a3 (blunder)
    expect(screen.getByText(/best d4/)).toBeTruthy()
    expect(screen.getByText(/hung_piece/)).toBeTruthy()
  })

  it('steps forward with the right arrow key', () => {
    render(<GameReview games={games} />)
    expect(screen.getByText(/· e4/)).toBeTruthy()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText(/· e5/)).toBeTruthy()
  })

  it('jumps to a move when clicked in the move list', () => {
    render(<GameReview games={games} />)
    // The move list renders a clickable SAN button for the blunder move "a3".
    fireEvent.click(screen.getByRole('button', { name: 'a3' }))
    expect(screen.getByText(/best d4/)).toBeTruthy() // landed on the blunder
  })

  it('renders nothing when there are no games', () => {
    const { container } = render(<GameReview games={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
