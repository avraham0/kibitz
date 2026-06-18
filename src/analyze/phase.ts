import { Chess } from 'chess.js'
import type { Phase } from '../types.js'

export function detectPhase(fen: string, ply: number): Phase {
  if (ply <= 24) return 'opening'
  const chess = new Chess(fen)
  const board = chess.board()
  let total = 0
  let queens = 0
  for (const row of board) {
    for (const sq of row) {
      if (!sq) continue
      total++
      if (sq.type === 'q') queens++
    }
  }
  if (total <= 7) return 'endgame'
  if (queens === 0 && total <= 12) return 'endgame'
  return 'middlegame'
}
