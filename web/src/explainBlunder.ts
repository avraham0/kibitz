import { Chess } from 'chess.js'
import type { BlunderRef } from './api-types.js'

// Just the fields needed to explain a move — satisfied by BlunderRef and GameMove.
type Explainable = Pick<BlunderRef, 'san' | 'bestSan' | 'cpLoss' | 'type' | 'missed' | 'fenBefore'>

const PIECE_NAME: Record<string, string> = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn', k: 'king' }
const PIECE_VAL: Record<string, number> = { q: 9, r: 5, b: 3, n: 3, p: 1 }

// Did the move directly hang material? Largest favourable capture the opponent has
// right after it (victim value minus the recapturing piece if the square is defended)
// — the same simplified-SEE check the engine uses. Returns the dropped piece, if any.
// This is the truth of "you hung your queen", independent of any motif the engine
// happened to see in the best line.
export function hangingAfter(fenBefore: string, san: string): { piece: string } | null {
  try {
    const c = new Chess(fenBefore)
    c.move(san)
    const recapturer = c.turn() === 'w' ? 'b' : 'w' // we recapture; opponent is to move
    let best: { piece: string; value: number } | null = null
    for (const m of c.moves({ verbose: true }) as Array<{ captured?: string; to: string; piece: string }>) {
      if (!m.captured) continue
      const victim = PIECE_VAL[m.captured] ?? 0
      const defenders = (c as unknown as { attackers?: (sq: string, color: string) => string[] }).attackers?.(m.to, recapturer)
      const gain = defenders && defenders.length ? victim - (PIECE_VAL[m.piece] ?? 0) : victim
      if (gain >= 2 && (!best || victim > best.value)) best = { piece: m.captured, value: victim }
    }
    return best ? { piece: best.piece } : null
  } catch {
    return null
  }
}

// Apply a move and return the resulting FEN, or null if illegal.
function applyMove(fen: string, san: string): string | null {
  try { const c = new Chess(fen); c.move(san); return c.fen() } catch { return null }
}

// Attackers helper — works around the loose chess.js typings.
function attackers(c: Chess, sq: string, color: 'w' | 'b'): string[] {
  return (c as any).attackers(sq, color) as string[]
}

// Find a piece of `color` absolutely pinned to its king: removing it exposes the king.
function findAbsolutePin(fen: string, color: 'w' | 'b'): string | null {
  try {
    const c = new Chess(fen)
    const board = c.board()
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = board[r][f]
        if (!sq || sq.color !== color || sq.type === 'k') continue
        const sqStr = 'abcdefgh'[f] + (8 - r)
        const c2 = new Chess(fen)
        c2.remove(sqStr as any)
        const parts = c2.fen().split(' ')
        parts[1] = color  // check if THIS color's king is exposed
        parts[3] = '-'
        try {
          if (new Chess(parts.join(' ')).inCheck()) return PIECE_NAME[sq.type] ?? 'piece'
        } catch { continue }
      }
    }
  } catch { /* */ }
  return null
}

// Find a non-king piece of `trappedColor` that is attacked and has no safe escape squares.
// Uses a flipped-turn FEN to get the trapped side's legal moves.
function findTrappedPiece(fen: string, trappedColor: 'w' | 'b'): string | null {
  try {
    const c = new Chess(fen)
    const attackerColor = trappedColor === 'w' ? 'b' : 'w'
    // Build a FEN where trappedColor is to move so we can call .moves() for their pieces.
    const parts = fen.split(' ')
    parts[1] = trappedColor
    parts[3] = '-'
    let cTrapped: Chess
    try { cTrapped = new Chess(parts.join(' ')) } catch { return null }

    for (const row of c.board()) {
      for (const sq of row) {
        if (!sq || sq.color !== trappedColor || sq.type === 'k') continue
        if (!attackers(c, sq.square, attackerColor).length) continue
        const escapes = (cTrapped.moves({ verbose: true }) as any[]).filter((m: any) => m.from === sq.square)
        if (escapes.length === 0) return PIECE_NAME[sq.type] ?? 'piece'
        const hasSafe = escapes.some((move: any) => {
          try {
            const c2 = new Chess(parts.join(' '))
            c2.move(move)
            return attackers(c2, move.to, attackerColor).length === 0
          } catch { return true }
        })
        if (!hasSafe) return PIECE_NAME[sq.type] ?? 'piece'
      }
    }
  } catch { /* */ }
  return null
}

// Find 2+ pieces of `forkedColor` all attacked by a single opponent piece.
// Returns the two most valuable forked pieces, or null.
function findForkedPieces(fen: string, forkedColor: 'w' | 'b'): [string, string] | null {
  try {
    const c = new Chess(fen)
    const attackerColor = forkedColor === 'w' ? 'b' : 'w'
    // For each attacker square, collect which forkedColor pieces it attacks.
    const byAttacker: Record<string, { name: string; val: number }[]> = {}
    for (const row of c.board()) {
      for (const sq of row) {
        if (!sq || sq.color !== forkedColor) continue
        for (const atkSq of attackers(c, sq.square, attackerColor)) {
          if (!byAttacker[atkSq]) byAttacker[atkSq] = []
          byAttacker[atkSq].push({ name: PIECE_NAME[sq.type] ?? 'piece', val: PIECE_VAL[sq.type] ?? 0 })
        }
      }
    }
    for (const targets of Object.values(byAttacker)) {
      if (targets.length < 2) continue
      // Sort by value descending, return two most valuable.
      targets.sort((a, b) => b.val - a.val)
      return [targets[0].name, targets[1].name]
    }
  } catch { /* */ }
  return null
}

export function explainWrongMove(fenBefore: string, wrongSan: string, blunder: Explainable): string {
  const hung = hangingAfter(fenBefore, wrongSan)
  if (hung) return `${wrongSan} hangs your ${PIECE_NAME[hung.piece] ?? 'piece'}.`
  if (blunder.missed) return `${wrongSan} doesn't win material — there's a stronger shot.`
  return `${wrongSan} isn't the best move here.`
}

// Plain-language reason a move was a mistake, from the classified type + whether the
// tactic was missed (you had it) or allowed (you let the opponent have it) + cost.
export function explainBlunder(b: Explainable): string {
  const best = b.bestSan
  const playerColor = b.fenBefore.split(' ')[1] as 'w' | 'b'
  const opponentColor: 'w' | 'b' = playerColor === 'w' ? 'b' : 'w'

  // A direct material hang is the headline, whatever the engine's best line contained.
  const hung = hangingAfter(b.fenBefore, b.san)
  if (hung) return `${b.san} left your ${PIECE_NAME[hung.piece] ?? 'piece'} hanging. ${best} kept it safe.`

  const tactic = (name: string) =>
    b.missed
      ? `Missed a ${name} — ${best} won material.`
      : `Allowed a ${name}: after ${b.san} the opponent gets it. ${best} prevented it.`

  switch (b.type) {
    case 'hung_piece':
      return `${b.san} left a piece undefended. ${best} kept it safe.`

    case 'fork': {
      if (!b.missed) {
        const fenAfter = applyMove(b.fenBefore, b.san)
        if (fenAfter) {
          const forked = findForkedPieces(fenAfter, playerColor)
          if (forked) return `Allowed a fork — opponent hits your ${forked[0]} and ${forked[1]}. ${best} prevented it.`
        }
      } else {
        const fenAfterBest = applyMove(b.fenBefore, best)
        if (fenAfterBest) {
          const forked = findForkedPieces(fenAfterBest, opponentColor)
          if (forked) return `Missed a fork — ${best} hits their ${forked[0]} and ${forked[1]}.`
        }
      }
      return tactic('fork')
    }

    case 'pin': {
      if (!b.missed) {
        const fenAfter = applyMove(b.fenBefore, b.san)
        if (fenAfter) {
          const pinned = findAbsolutePin(fenAfter, playerColor)
          if (pinned) return `Allowed a pin — your ${pinned} is now pinned to your king. ${best} prevented it.`
        }
      } else {
        const fenAfterBest = applyMove(b.fenBefore, best)
        if (fenAfterBest) {
          const pinned = findAbsolutePin(fenAfterBest, opponentColor)
          if (pinned) return `Missed pinning their ${pinned} — ${best} set up the pin.`
        }
      }
      return tactic('pin')
    }

    case 'skewer': return tactic('skewer')

    case 'discovered_attack': return tactic('discovered attack')

    case 'back_rank': return tactic('back-rank mate threat')

    case 'trapped_piece': {
      if (!b.missed) {
        const fenAfter = applyMove(b.fenBefore, b.san)
        if (fenAfter) {
          const trapped = findTrappedPiece(fenAfter, playerColor)
          if (trapped) return `Let your ${trapped} get trapped; ${best} kept it active.`
        }
      } else {
        const fenAfterBest = applyMove(b.fenBefore, best)
        if (fenAfterBest) {
          const trapped = findTrappedPiece(fenAfterBest, opponentColor)
          if (trapped) return `Missed trapping their ${trapped} — ${best} boxed it in.`
        }
      }
      return b.missed
        ? `Missed trapping a piece — ${best} boxed it in.`
        : `Let a piece get trapped; ${best} kept it active.`
    }

    case 'missed_tactic':
      return `Missed a tactic — ${best} was the shot.`

    case 'king_safety':
      return `${b.san} exposed your king; ${best} was safer.`

    case 'bad_trade':
      return `Unfavorable trade; ${best} kept the better pieces.`

    case 'positional':
      return `Positional slip — ${best} was stronger.`

    default:
      return `${best} was clearly better.`
  }
}
