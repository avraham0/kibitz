import type { Stats, BlunderRef } from './aggregate.js'
import type { MistakeType, Phase } from '../types.js'

export type Suggestion = {
  title: string
  why: string
  drill: string
  impact: number
  examples: { url: string; fenBefore: string; san: string; bestSan: string }[]
}

type CoachableMistakeType = Exclude<MistakeType, 'lost_position'>

const TYPE_LABEL: Record<CoachableMistakeType, string> = {
  hung_piece: 'Hung pieces',
  missed_tactic: 'Missed tactics',
  bad_trade: 'Bad trades',
  king_safety: 'King safety',
  positional: 'Positional errors',
  fork: 'Forks',
  pin: 'Pins',
  skewer: 'Skewers',
  discovered_attack: 'Discovered attacks',
  trapped_piece: 'Trapped pieces',
  back_rank: 'Back-rank tactics',
}

const TYPE_DRILL: Record<CoachableMistakeType, string> = {
  hung_piece: 'Before every move, do a blunder-check: is the piece I am moving — or one I leave behind — left en prise?',
  missed_tactic: 'Do 10–15 tactics puzzles a day; on each move scan for checks, captures, and threats first.',
  bad_trade: 'Before capturing, count attackers vs defenders on the target square and compare piece values.',
  king_safety: 'Castle early; avoid king moves that forfeit castling rights; keep the pawn shield intact.',
  positional: 'Study pawn structure and piece activity; review annotated master games in your openings.',
  fork: 'Drill fork patterns: knight forks, pawn forks, and royal forks. Before each move, check if your pieces fork two or more targets.',
  pin: 'Practice pin patterns; learn when to break pins with tempo and when to exploit pinned pieces.',
  skewer: 'Study skewer motifs with bishops, rooks, and queens; watch for king or queen exposed on open lines.',
  discovered_attack: 'Train discovered attack patterns; look for pieces hiding behind other pieces on open lines.',
  trapped_piece: 'After each move, verify all your pieces have safe retreat squares to avoid trapping.',
  back_rank: 'Keep your back rank defended or create escape squares; watch for heavy-piece battery checkmates.',
}

const PHASE_DRILL: Record<Phase, string> = {
  opening: 'Build a small, solid repertoire and learn the plans, not just the moves.',
  middlegame: 'Study middlegame plans and tactics arising from your openings.',
  endgame: 'Drill fundamental endgames: king-and-pawn, basic rook endings, opposition.',
}

function examplesFor(blunders: BlunderRef[], type?: MistakeType): Suggestion['examples'] {
  const pool = type ? blunders.filter((b) => b.type === type) : blunders
  const chosen = (pool.length ? pool : blunders).slice(0, 3)
  return chosen.map((b) => ({ url: b.url, fenBefore: b.fenBefore, san: b.san, bestSan: b.bestSan }))
}

export function coach(stats: Stats): Suggestion[] {
  const out: Suggestion[] = []
  if (stats.mistakeCount === 0) return out

  // Rule 1: dominant mistake type.
  for (const t of Object.keys(stats.byType) as CoachableMistakeType[]) {
    const { count, avgCpLoss } = stats.byType[t]
    if (count === 0) continue
    const share = count / stats.mistakeCount
    if (share >= 0.3) {
      out.push({
        title: `${TYPE_LABEL[t]} are your most common mistake (${Math.round(share * 100)}%)`,
        why: `They account for ${count} of ${stats.mistakeCount} mistakes, averaging ${avgCpLoss} centipawns lost each.`,
        drill: TYPE_DRILL[t],
        impact: count * avgCpLoss,
        examples: examplesFor(stats.topBlunders, t),
      })
    }
  }

  // Rule 2: dominant phase.
  for (const p of Object.keys(stats.byPhase) as Phase[]) {
    const c = stats.byPhase[p]
    if (c === 0) continue
    const share = c / stats.mistakeCount
    if (share >= 0.5) {
      out.push({
        title: `Most of your mistakes happen in the ${p} (${Math.round(share * 100)}%)`,
        why: `${c} of ${stats.mistakeCount} mistakes occur in the ${p}.`,
        drill: PHASE_DRILL[p],
        impact: c * 100,
        examples: examplesFor(stats.topBlunders),
      })
    }
  }

  // Rule 3: losing openings.
  for (const o of stats.openings) {
    if (o.name !== 'Unknown' && o.games >= 3 && o.winPct < 40) {
      out.push({
        title: `You struggle in the ${o.name} (${o.winPct}% over ${o.games} games)`,
        why: `Low score with this opening drags your rating; ${o.avgMistakes} mistakes per game on average.`,
        drill: `Study the main lines and typical plans of the ${o.name}, or switch to a repertoire you score better with.`,
        impact: o.games * (40 - o.winPct),
        examples: examplesFor(stats.topBlunders),
      })
    }
  }

  return out.sort((a, b) => b.impact - a.impact).slice(0, 5)
}
