import type { Stats, CoachableType } from './api-types.js'
import { COACHABLE_TYPES } from './api-types.js'

const TYPE_LABEL: Record<CoachableType, string> = {
  hung_piece: 'Hanging pieces', missed_tactic: 'Missed tactics', bad_trade: 'Bad trades',
  king_safety: 'King safety', positional: 'Positional errors', fork: 'Forks', pin: 'Pins',
  skewer: 'Skewers', discovered_attack: 'Discovered attacks', trapped_piece: 'Trapped pieces',
  back_rank: 'Back-rank',
}

export type Leak = { title: string; detail: string }

// Turn the aggregate stats into a short ranked diagnosis — the recurring leaks
// that cost the most, where they happen, and whether the clock is a factor.
// Pure (no engine, no LLM): just reads what aggregate already computed.
export function topLeaks(stats: Stats): Leak[] {
  const out: Leak[] = []

  // 1. The mistake type with the most total damage (frequency × severity).
  const ranked = COACHABLE_TYPES
    .map((t) => ({ t, ...stats.byType[t] }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count * b.avgCpLoss - a.count * a.avgCpLoss)
  if (ranked.length) {
    const top = ranked[0]
    const mix = top.missed && top.allowed
      ? `${top.missed} missed / ${top.allowed} allowed`
      : top.missed ? `${top.missed} missed` : `${top.allowed} allowed`
    out.push({
      title: `${TYPE_LABEL[top.t]} — your most costly leak`,
      detail: `${top.count}× (avg −${top.avgCpLoss}cp, ${mix}).`,
    })
  }

  // 2. The phase where your accuracy is lowest.
  const phases = ['opening', 'middlegame', 'endgame'] as const
  const worst = [...phases].sort((a, b) => stats.accuracyByPhase[a] - stats.accuracyByPhase[b])[0]
  if (stats.accuracyByPhase[worst] < 100) {
    out.push({
      title: `Weakest phase: ${worst}`,
      detail: `${stats.accuracyByPhase[worst]}% accuracy, ${stats.byPhase[worst]} mistake${stats.byPhase[worst] === 1 ? '' : 's'} here.`,
    })
  }

  // 3. Whether time pressure drives blunders.
  if (stats.gamesWithClock > 0) {
    const lo = stats.byTimeBucket['<10s']
    const hi = stats.byTimeBucket['60s+']
    const loRate = lo.moves ? lo.blunders / lo.moves : 0
    const hiRate = hi.moves ? hi.blunders / hi.moves : 0
    if (lo.moves >= 3 && loRate > hiRate && loRate > 0.05) {
      out.push({
        title: 'Time pressure hurts you',
        detail: `${Math.round(loRate * 100)}% of moves under 10s are blunders, vs ${Math.round(hiRate * 100)}% with 60s+. Spend your time earlier.`,
      })
    }
  }

  if (!out.length && stats.mistakeCount === 0) {
    out.push({ title: 'No recurring leaks found', detail: `Clean across ${stats.gamesAnalyzed} game${stats.gamesAnalyzed === 1 ? '' : 's'}.` })
  }
  return out
}
