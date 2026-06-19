import { Chess } from 'chess.js'
import type { BlunderRef } from './api-types.js'

// Just the fields needed to explain a move — satisfied by BlunderRef and GameMove.
type Explainable = Pick<BlunderRef, 'san' | 'bestSan' | 'cpLoss' | 'type' | 'missed' | 'fenBefore'>

const PIECE_NAME: Record<string, string> = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' }
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

// Plain-language reason a move was a mistake, from the classified type + whether the
// tactic was missed (you had it) or allowed (you let the opponent have it) + cost.
// Pure and model-free — just turns the analysis into a sentence.
export function explainBlunder(b: Explainable): string {
  const best = b.bestSan

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
