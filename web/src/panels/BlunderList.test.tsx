import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BlunderList } from './BlunderList.js'
import type { BlunderRef } from '../api-types.js'

const blunders: BlunderRef[] = [
  { url: 'u', ply: 20, san: 'Qd5', bestSan: 'Nf3', fenBefore: 'rnbqkbnr/pp1ppppp/2p5/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', cpLoss: 400, type: 'hung_piece' },
]

describe('BlunderList', () => {
  it('renders a caption per blunder', () => {
    render(<BlunderList blunders={blunders} />)
    expect(screen.getByText(/Played Qd5/)).toBeTruthy()
    expect(screen.getByText(/Best Nf3/)).toBeTruthy()
  })
})
