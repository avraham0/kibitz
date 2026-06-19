import type { BlunderRef } from './api-types.js'

// Plain-language reason a move was a mistake, from the classified type + whether the
// tactic was missed (you had it) or allowed (you let the opponent have it) + cost.
// Pure and model-free — just turns the analysis into a sentence.
export function explainBlunder(b: BlunderRef): string {
  const best = b.bestSan
  const pawns = (b.cpLoss / 100).toFixed(1)
  const tactic = (name: string) =>
    b.missed
      ? `Missed a ${name} — ${best} won material.`
      : `Allowed a ${name}: after ${b.san} the opponent gets it. ${best} prevented it.`

  switch (b.type) {
    case 'hung_piece':
      return `${b.san} left a piece undefended (hung ~${pawns} pawns). ${best} kept it safe.`
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
