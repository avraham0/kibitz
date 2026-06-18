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
  // If chess.js throws (illegal SAN — should never happen on real game data), fall back to positional.
  const after = new Chess(fenBefore)
  let fenAfter: string | null = null
  try {
    after.move(san)
    fenAfter = after.fen()
  } catch {
    return 'positional'
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
