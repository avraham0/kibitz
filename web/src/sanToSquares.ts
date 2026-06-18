import { Chess } from 'chess.js'

export function sanToSquares(fen: string, san: string): { from: string; to: string } | null {
  try {
    const c = new Chess(fen)
    const mv = c.move(san)
    return mv ? { from: mv.from, to: mv.to } : null
  } catch {
    return null
  }
}
