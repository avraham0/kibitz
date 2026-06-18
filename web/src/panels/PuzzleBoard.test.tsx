import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PuzzleBoard } from './PuzzleBoard.js'
import type { BlunderRef } from '../api-types.js'

const blunder: BlunderRef = {
  url: 'u', ply: 20, san: 'a3', bestSan: 'e4',
  fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  cpLoss: 300, type: 'missed_tactic',
}

describe('PuzzleBoard', () => {
  it('prompts for the move and hides the answer until revealed', () => {
    render(<PuzzleBoard blunder={blunder} />)
    expect(screen.getByText(/Your move/)).toBeTruthy()
    expect(screen.queryByText(/e4/)).toBeNull() // answer hidden
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }))
    expect(screen.getByText(/Best was e4/)).toBeTruthy()
  })
})
