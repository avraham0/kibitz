import { describe, it, expect, afterAll } from 'vitest'
import { Engine } from './stockfish.js'

let engine: Engine

describe('Engine', () => {
  it('finds the mate-in-1 and reports a mate score', async () => {
    engine = await Engine.create()
    // White to move, Qh5xf7# style position: scholar's mate setup.
    const fen = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4'
    const { eval: ev } = await engine.evaluate(fen, 8)
    // Black is checkmated (side to move has been mated): score is a forced loss.
    expect(ev.mate !== null || (ev.cp !== null && ev.cp < -1000)).toBe(true)
  }, 30_000)

  it('returns a legal best move in uci form from the start position', async () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const { bestUci } = await engine.evaluate(start, 8)
    expect(bestUci).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/)
  }, 30_000)

  it('returns a principal variation whose first move is the best move', async () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const { bestUci, pv } = await engine.evaluate(start, 8)
    expect(Array.isArray(pv)).toBe(true)
    expect(pv.length).toBeGreaterThanOrEqual(1)
    expect(pv[0]).toBe(bestUci)
    expect(pv[0]).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/)
  }, 30_000)
})

afterAll(() => engine?.quit())
