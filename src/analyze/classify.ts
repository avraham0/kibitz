import { Chess } from 'chess.js'
import type { MistakeType, PieceSymbol } from '../types.js'
import { PIECE_VALUE } from '../types.js'

function cheapestAttackerValue(chess: Chess, square: string, color: 'w' | 'b'): number | null {
  // chess.attackers(square, color) → array of source squares of `color` attacking `square`.
  const srcs = (chess as any).attackers?.(square, color) as string[] | undefined
  if (!srcs || srcs.length === 0) return null
  let min = Infinity
  for (const s of srcs) {
    const p = chess.get(s as any)
    if (p) min = Math.min(min, PIECE_VALUE[p.type as PieceSymbol])
  }
  return min === Infinity ? null : min
}

// Largest single-capture material gain for the side to move (simplified SEE).
export function maxHangingGain(fen: string): number {
  const chess = new Chess(fen)
  const mover = chess.turn() // 'w' | 'b'
  const enemy = mover === 'w' ? 'b' : 'w'
  let best = 0
  const moves = chess.moves({ verbose: true }) as any[]
  for (const mv of moves) {
    if (!mv.captured) continue
    const victim = PIECE_VALUE[mv.captured as PieceSymbol]
    const defender = cheapestAttackerValue(chess, mv.to, enemy)
    const gain = defender === null ? victim : victim - PIECE_VALUE[mv.piece as PieceSymbol]
    best = Math.max(best, gain)
  }
  return Math.max(0, best)
}

function castlingRights(fen: string): string {
  return fen.split(' ')[2] ?? '-'
}

/**
 * Heuristically construct the FEN after a SAN move, even if the move is not
 * strictly legal (e.g. the path is blocked). Used as a fallback for hung_piece
 * detection when chess.js rejects the move.
 *
 * Parses the destination square and piece type from SAN, finds the first
 * matching piece of the mover's color, removes it from its source, removes any
 * enemy piece on the destination, and places the mover's piece there. Returns
 * the resulting FEN with the opponent to move, or null if parsing fails.
 */
function buildHeuristicFenAfter(fenBefore: string, san: string): string | null {
  const chess = new Chess(fenBefore)
  const mover = chess.turn() as 'w' | 'b'

  // Strip check/mate/annotation markers
  const clean = san.replace(/[+#!?]/g, '')

  // Ignore castling – chess.js handles it correctly when the path is clear;
  // if castling itself is illegal we simply skip the heuristic.
  if (/^[O0]/.test(clean)) return null

  // Extract destination square (last a-h followed by 1-8, before optional =X)
  const destMatch = clean.match(/([a-h][1-8])(?:=[QRBN])?$/)
  if (!destMatch) return null
  const to = destMatch[1]

  // Determine piece type
  let pieceType: PieceSymbol = 'p'
  if (/^[A-Z]/.test(clean)) {
    const map: Record<string, PieceSymbol> = { K: 'k', Q: 'q', R: 'r', B: 'b', N: 'n' }
    pieceType = map[clean[0]] ?? 'p'
  }

  // Find the first piece of this type/color on the board
  const board = chess.board() as Array<Array<{ type: string; color: string } | null>>
  let fromSquare: string | null = null
  outer: for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.type === pieceType && p.color === mover) {
        fromSquare = String.fromCharCode(97 + c) + (8 - r)
        break outer
      }
    }
  }
  if (!fromSquare) return null

  // Manually move the piece (ignoring legality)
  chess.remove(fromSquare as any)
  if (chess.get(to as any)) chess.remove(to as any)
  chess.put({ type: pieceType, color: mover }, to as any)

  // Flip turn to opponent; clear en passant
  const parts = chess.fen().split(' ')
  parts[1] = mover === 'w' ? 'b' : 'w'
  parts[3] = '-'
  return parts.join(' ')
}

export function classifyMistake(input: {
  fenBefore: string
  san: string
  bestUci: string
}): MistakeType {
  const { fenBefore, san, bestUci } = input

  // missed_tactic: the player had a capture winning >= 200cp and did not play the engine best.
  const playerGain = maxHangingGain(fenBefore)
  const before = new Chess(fenBefore)
  const playedVerbose = (before.moves({ verbose: true }) as any[]).find((m) => m.san === san)
  const playedUci = playedVerbose
    ? `${playedVerbose.from}${playedVerbose.to}${playedVerbose.promotion ?? ''}`
    : ''
  if (playerGain >= 200 && playedUci !== bestUci) return 'missed_tactic'

  // Apply the played move to inspect the resulting position.
  // Fall back to a heuristic position when chess.js rejects the move (e.g. SAN
  // from an annotated game that requires a path the engine doesn't see).
  const after = new Chess(fenBefore)
  let fenAfter: string | null = null
  try {
    after.move(san)
    fenAfter = after.fen()
  } catch {
    fenAfter = buildHeuristicFenAfter(fenBefore, san)
  }

  // hung_piece: opponent (now to move) can win >= 200cp.
  if (fenAfter !== null && maxHangingGain(fenAfter) >= 200) return 'hung_piece'

  // bad_trade: played move was a capture with negative simplified SEE on its square.
  if (playedVerbose?.captured) {
    const enemy = before.turn() === 'w' ? 'b' : 'w'
    const recapture = cheapestAttackerValue(after, playedVerbose.to, enemy)
    const victim = PIECE_VALUE[playedVerbose.captured as PieceSymbol]
    const attacker = PIECE_VALUE[playedVerbose.piece as PieceSymbol]
    if (recapture !== null && victim - attacker < 0) return 'bad_trade'
  }

  // king_safety: a non-castling king move that forfeits still-available castling rights.
  const rightsBefore = castlingRights(fenBefore)
  const moverHadRights =
    before.turn() === 'w' ? /[KQ]/.test(rightsBefore) : /[kq]/.test(rightsBefore)
  const isKingMove = playedVerbose?.piece === 'k'
  const isCastle = playedVerbose?.flags?.includes('k') || playedVerbose?.flags?.includes('q')
  if (isKingMove && !isCastle && moverHadRights) return 'king_safety'

  return 'positional'
}
