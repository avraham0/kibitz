import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlunderList } from './BlunderList.js'
import type { BlunderRef } from '../api-types.js'

const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const blunders: BlunderRef[] = [
  { url: 'u', ply: 20, san: 'Qd5', bestSan: 'Nf3', fenBefore: 'rnbqkbnr/pp1ppppp/2p5/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', cpLoss: 400, type: 'hung_piece' },
  { url: 'u2', ply: 22, san: 'a4', bestSan: 'b4', fenBefore: start, cpLoss: 300, type: 'fork' },
]

describe('BlunderList', () => {
  it('renders a caption per blunder', () => {
    render(<BlunderList blunders={blunders} />)
    expect(screen.getByText(/Played Qd5/)).toBeTruthy()
    expect(screen.getByText(/Played a4/)).toBeTruthy()
  })

  it('filters the shown blunders by mistake type', () => {
    render(<BlunderList blunders={blunders} />)
    fireEvent.change(screen.getByLabelText(/filter by type/), { target: { value: 'fork' } })
    expect(screen.queryByText(/Played Qd5/)).toBeNull() // hung_piece hidden
    expect(screen.getByText(/Played a4/)).toBeTruthy()   // fork shown
  })

  it('switches to puzzle (solve) mode', () => {
    render(<BlunderList blunders={blunders} />)
    expect(screen.queryByText(/Your move/)).toBeNull() // review mode by default
    fireEvent.change(screen.getByLabelText(/mode/), { target: { value: 'solve' } })
    expect(screen.getAllByText(/Your move/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Played Qd5/)).toBeNull() // review captions gone
  })

  it('shows one puzzle at a time with next/prev nav', () => {
    render(<BlunderList blunders={blunders} />)
    fireEvent.change(screen.getByLabelText(/mode/), { target: { value: 'solve' } })
    expect(screen.getAllByText(/Your move/).length).toBe(1) // single board
    expect(screen.getByText('Puzzle 1 / 2')).toBeTruthy()
    expect((screen.getByRole('button', { name: /prev/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /next/ }))
    expect(screen.getByText('Puzzle 2 / 2')).toBeTruthy()
    expect((screen.getByRole('button', { name: /next/ }) as HTMLButtonElement).disabled).toBe(true)
  })
})
