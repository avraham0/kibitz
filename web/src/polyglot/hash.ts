import { Chess } from 'chess.js'
import { R } from './random64.js'

// Polyglot piece indices: black=even, white=odd
// 0=bP, 1=wP, 2=bN, 3=wN, 4=bB, 5=wB, 6=bR, 7=wR, 8=bQ, 9=wQ, 10=bK, 11=wK
const POLY_PIECE: Record<string, number> = {
  bp: 0, wp: 1, bn: 2, wn: 3, bb: 4, wb: 5,
  br: 6, wr: 7, bq: 8, wq: 9, bk: 10, wk: 11,
}

export function polyglotHash(fen: string): bigint {
  const chess = new Chess(fen)
  const parts = fen.split(' ')
  let h = 0n

  // Pieces: chess.js board()[r][f] — row 0 = rank 8, row 7 = rank 1
  const board = chess.board()
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = board[r][f]
      if (!sq) continue
      const polyRank = 7 - r  // polyglot rank 0 = rank 1
      const polySq = polyRank * 8 + f
      h ^= R[POLY_PIECE[sq.color + sq.type] * 64 + polySq]
    }
  }

  // Castling: K=768, Q=769, k=770, q=771
  const cast = parts[2] ?? '-'
  if (cast.includes('K')) h ^= R[768]
  if (cast.includes('Q')) h ^= R[769]
  if (cast.includes('k')) h ^= R[770]
  if (cast.includes('q')) h ^= R[771]

  // En passant: only XOR if a pawn can actually capture
  const ep = parts[3] ?? '-'
  if (ep !== '-') {
    const epFile = ep.charCodeAt(0) - 97
    const epRankIdx = parseInt(ep[1]) - 1  // 0-indexed rank
    const turn = parts[1]
    const pawnRankIdx = turn === 'w' ? epRankIdx - 1 : epRankIdx + 1
    const boardRow = 7 - pawnRankIdx
    const canCapture =
      (epFile > 0 && board[boardRow]?.[epFile - 1]?.type === 'p' && board[boardRow]?.[epFile - 1]?.color === turn) ||
      (epFile < 7 && board[boardRow]?.[epFile + 1]?.type === 'p' && board[boardRow]?.[epFile + 1]?.color === turn)
    if (canCapture) h ^= R[772 + epFile]
  }

  // Side to move: black XORs R[780]
  if (parts[1] === 'b') h ^= R[780]

  return h
}
