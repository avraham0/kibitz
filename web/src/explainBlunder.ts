import { Chess } from 'chess.js'
import type { BlunderRef } from './api-types.js'

// Just the fields needed to explain a move — satisfied by BlunderRef and GameMove.
type Explainable = Pick<BlunderRef, 'san' | 'bestSan' | 'cpLoss' | 'type' | 'missed' | 'fenBefore'>

const PIECE_NAME: Record<string, string> = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' }
const PIECE_VAL: Record<string, number> = { q: 9, r: 5, b: 3, n: 3, p: 1 }

// Name the most valuable piece the opponent can capture right after the move. The
// engine already verified (type === 'hung_piece') that it's genuinely hanging, so
// the most-valuable capturable piece is the one that was dropped.
function hungPieceName(fenBefore: string, san: string): string | null {
  try {
    const c = new Chess(fenBefore)
    c.move(san)
    let best: string | null = null
    let bestVal = 0
    for (const m of c.moves({ verbose: true }) as Array<{ captured?: string }>) {
      if (!m.captured) continue
      const v = PIECE_VAL[m.captured] ?? 0
      if (v > bestVal) { bestVal = v; best = m.captured }
    }
    return best && bestVal >= 3 ? PIECE_NAME[best] : null
  } catch {
    return null
  }
}

// Plain-language reason a move was a mistake, from the classified type + whether the
// tactic was missed (you had it) or allowed (you let the opponent have it) + cost.
// Pure and model-free — just turns the analysis into a sentence.
export function explainBlunder(b: Explainable): string {
  const best = b.bestSan
  const pawns = (b.cpLoss / 100).toFixed(1)
  const tactic = (name: string) =>
    b.missed
      ? `Missed a ${name} — ${best} won material.`
      : `Allowed a ${name}: after ${b.san} the opponent gets it. ${best} prevented it.`

  switch (b.type) {
    case 'hung_piece': {
      const piece = hungPieceName(b.fenBefore, b.san)
      return piece
        ? `${b.san} left your ${piece} hanging (~${pawns} pawns). ${best} kept it safe.`
        : `${b.san} left a piece undefended (hung ~${pawns} pawns). ${best} kept it safe.`
    }
    case 'fork': return tactic('fork')
    case 'pin': return tactic('pin')
    case 'skewer': return tactic('skewer')
    case 'discovered_attack': return tactic('discovered attack')
    case 'back_rank': return tactic('back-rank mate threat')
    case 'trapped_piece':
      return b.missed
        ? `Missed trapping a piece — ${best} boxed it in.`
        : `Let a piece get trapped; ${best} kept it active.`
    case 'missed_tactic':
      return `Missed a tactic worth ~${pawns} pawns — ${best} was the shot.`
    case 'king_safety':
      return `${b.san} exposed your king; ${best} was safer.`
    case 'bad_trade':
      return `Unfavorable trade giving up ~${pawns} pawns; ${best} kept the better pieces.`
    case 'positional':
      return `Positional slip — gave up ~${pawns} pawns of position. ${best} was stronger.`
    default:
      return `${best} was clearly better (worth ~${pawns} pawns).`
  }
}
