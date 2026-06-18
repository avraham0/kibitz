import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressChart } from './ProgressChart.js'
import type { GameSummary } from '../api-types.js'

const g = (playedAt: string, accuracy: number): GameSummary => ({
  gameId: playedAt, url: playedAt, playedAt, color: 'white', result: 'win',
  eco: 'C50', openingName: 'Italian Game', accuracy, moves: [],
})

describe('ProgressChart', () => {
  it('renders a monthly trend when ≥2 months are present', () => {
    render(<ProgressChart games={[g('2026-04-01T00:00:00Z', 80), g('2026-05-01T00:00:00Z', 90)]} />)
    expect(screen.getByText('Progress over time')).toBeTruthy()
  })
  it('hides itself when all games fall in one month', () => {
    const { container } = render(<ProgressChart games={[g('2026-05-01T00:00:00Z', 80), g('2026-05-09T00:00:00Z', 90)]} />)
    expect(container.firstChild).toBeNull()
  })
})
