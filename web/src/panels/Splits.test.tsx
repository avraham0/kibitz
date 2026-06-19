import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Splits } from './Splits.js'
import type { Stats } from '../api-types.js'

const base = {
  conversion: { winningGames: 4, converted: 3 },
  byColor: {
    white: { games: 6, wins: 4, winPct: 67, accuracy: 88, mistakes: 9 },
    black: { games: 4, wins: 1, winPct: 25, accuracy: 79, mistakes: 11 },
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
})
