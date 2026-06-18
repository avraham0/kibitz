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
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'fork' } })
    expect(screen.queryByText(/Played Qd5/)).toBeNull() // hung_piece hidden
    expect(screen.getByText(/Played a4/)).toBeTruthy()   // fork shown
  })
})
