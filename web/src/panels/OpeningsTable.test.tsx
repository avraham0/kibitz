import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OpeningsTable } from './OpeningsTable.js'
import type { OpeningStat, GameSummary } from '../api-types.js'

const openings: OpeningStat[] = [
  { eco: 'C50', name: 'Italian Game', games: 1, wins: 0, winPct: 0, avgMistakes: 1 },
]
const games: GameSummary[] = [
  {
    gameId: 'g', url: 'u', playedAt: '2026-02-03T00:00:00.000Z', color: 'white',
    result: 'loss', eco: 'C50', openingName: 'Italian Game', accuracy: 72, accuracyStrict: 58,
    moves: [
      { ply: 5, san: 'Ng5', bestSan: 'O-O', evalCp: -200, cpLoss: 300, isPlayerMove: true, severity: 'blunder', type: 'hung_piece', fenBefore: 'x', phase: 'opening', clockSeconds: 30 },
    ],
  },
]

describe('OpeningsTable', () => {
  it('expands a row to show its games and recurring mistakes', () => {
    render(<OpeningsTable openings={openings} games={games} />)
    expect(screen.queryByText(/Common mistakes/)).toBeNull() // collapsed
    fireEvent.click(screen.getByText('Italian Game'))
    expect(screen.getByText(/Common mistakes/)).toBeTruthy()
    expect(screen.getByText(/hung_piece \(1\)/)).toBeTruthy()
    expect(screen.getByText('2026-02-03')).toBeTruthy()
  })

  it('calls onOpenGame with the game id from a row', () => {
    const onOpenGame = vi.fn()
    render(<OpeningsTable openings={openings} games={games} onOpenGame={onOpenGame} />)
    fireEvent.click(screen.getByText('Italian Game'))
    fireEvent.click(screen.getByRole('button', { name: /review/i }))
    expect(onOpenGame).toHaveBeenCalledWith('g')
  })
})
