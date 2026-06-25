import type { GameSummary, CoachableType } from './api-types.js'

export type RecurringTheme = {
  type: CoachableType
  count: number
  share: number // of all player mistakes+blunders
  avgCpLoss: number
  earlyRate: number // mistakes of this type per game, earlier half
  recentRate: number // mistakes of this type per game, recent half
  trend: 'improving' | 'worsening' | 'flat' | 'unknown'
}

// A player mistake worth counting: their move, mistake-or-blunder severity, with a
// coachable type (exclude 'lost_position', which is just "the position was already lost").
function isCountable(m: GameSummary['moves'][number]): boolean {
  return m.isPlayerMove
    && (m.severity === 'mistake' || m.severity === 'blunder')
    && m.type !== 'lost_position'
}

// Build the recurring-mistake profile across all analysed games, with an
// early-vs-recent trend so the player can see whether a weakness is improving.
export function recurringMistakes(games: GameSummary[]): RecurringTheme[] {
  const ordered = [...games].sort((a, b) => a.playedAt.localeCompare(b.playedAt))
  const mid = Math.floor(ordered.length / 2)
  const early = ordered.slice(0, mid)
  const recent = ordered.slice(mid)

  const total: Record<string, { count: number; cp: number }> = {}
  const earlyCount: Record<string, number> = {}
  const recentCount: Record<string, number> = {}
  let grandTotal = 0

  const tally = (gs: GameSummary[], into: Record<string, number>) => {
    for (const g of gs) {
      for (const m of g.moves) {
        if (!isCountable(m)) continue
        into[m.type] = (into[m.type] ?? 0) + 1
      }
    }
  }
  tally(early, earlyCount)
  tally(recent, recentCount)

  for (const g of ordered) {
    for (const m of g.moves) {
      if (!isCountable(m)) continue
      const t = m.type
      total[t] = total[t] ?? { count: 0, cp: 0 }
      total[t].count++
      total[t].cp += m.cpLoss
      grandTotal++
    }
  }

  const themes: RecurringTheme[] = Object.entries(total).map(([type, { count, cp }]) => {
    const earlyRate = early.length ? (earlyCount[type] ?? 0) / early.length : 0
    const recentRate = recent.length ? (recentCount[type] ?? 0) / recent.length : 0
    // Only call a trend when there's enough signal: both halves present and a few cases.
    let trend: RecurringTheme['trend'] = 'unknown'
    if (early.length >= 3 && recent.length >= 3 && count >= 4) {
      if (recentRate <= earlyRate * 0.66) trend = 'improving'
      else if (recentRate >= earlyRate * 1.5) trend = 'worsening'
      else trend = 'flat'
    }
    return {
      type: type as CoachableType,
      count,
      share: grandTotal ? count / grandTotal : 0,
      avgCpLoss: Math.round(cp / count),
      earlyRate,
      recentRate,
      trend,
    }
  })

  // Most frequent first (the habits that cost the most games).
  return themes.sort((a, b) => b.count - a.count)
}
