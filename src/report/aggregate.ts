import type { GameAnalysis, MistakeType, Phase } from '../types.js'

export type BlunderRef = {
  url: string; ply: number; san: string; bestSan: string
  fenBefore: string; cpLoss: number; type: MistakeType
}
export type OpeningStat = {
  eco: string; name: string; games: number; wins: number; winPct: number; avgMistakes: number
}

type CoachableMistakeType = Exclude<MistakeType, 'lost_position'>

export type Stats = {
  gamesAnalyzed: number
  record: { wins: number; losses: number; draws: number }
  mistakeCount: number
  byPhase: Record<Phase, number>
  byType: Record<CoachableMistakeType, { count: number; avgCpLoss: number }>
  openings: OpeningStat[]
  topBlunders: BlunderRef[]
  lostPositionMoves: number
}

const TYPES: CoachableMistakeType[] = ['hung_piece', 'missed_tactic', 'bad_trade', 'king_safety', 'positional']

export function aggregate(games: GameAnalysis[]): Stats {
  const record = { wins: 0, losses: 0, draws: 0 }
  const byPhase: Record<Phase, number> = { opening: 0, middlegame: 0, endgame: 0 }
  const typeAcc: Record<CoachableMistakeType, { count: number; sum: number }> =
    Object.fromEntries(TYPES.map((t) => [t, { count: 0, sum: 0 }])) as any
  const openingMap = new Map<string, { eco: string; name: string; games: number; wins: number; mistakes: number }>()
  const blunders: BlunderRef[] = []
  let mistakeCount = 0
  let lostPositionMoves = 0

  for (const g of games) {
    if (g.result === 'win') record.wins++
    else if (g.result === 'loss') record.losses++
    else record.draws++

    const key = g.eco + '|' + g.openingName
    const o = openingMap.get(key) ?? { eco: g.eco, name: g.openingName, games: 0, wins: 0, mistakes: 0 }
    o.games++
    if (g.result === 'win') o.wins++

    for (const m of g.moves) {
      if (!m.isPlayerMove) continue
      if (m.type === 'lost_position') {
        lostPositionMoves++
        continue
      }
      if (m.severity === 'ok') continue
      mistakeCount++
      o.mistakes++
      byPhase[m.phase]++
      typeAcc[m.type as CoachableMistakeType].count++
      typeAcc[m.type as CoachableMistakeType].sum += m.cpLoss
      if (m.severity === 'blunder') {
        blunders.push({
          url: g.url, ply: m.ply, san: m.san, bestSan: m.bestSan,
          fenBefore: m.fenBefore, cpLoss: m.cpLoss, type: m.type,
        })
      }
    }
    openingMap.set(key, o)
  }

  const byType = Object.fromEntries(
    TYPES.map((t) => [t, {
      count: typeAcc[t].count,
      avgCpLoss: typeAcc[t].count ? Math.round(typeAcc[t].sum / typeAcc[t].count) : 0,
    }]),
  ) as Record<CoachableMistakeType, { count: number; avgCpLoss: number }>

  const openings: OpeningStat[] = [...openingMap.values()]
    .map((o) => ({
      eco: o.eco, name: o.name, games: o.games, wins: o.wins,
      winPct: o.games ? Math.round((o.wins / o.games) * 100) : 0,
      avgMistakes: o.games ? Math.round((o.mistakes / o.games) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.games - a.games)

  const topBlunders = blunders.sort((a, b) => b.cpLoss - a.cpLoss).slice(0, 10)

  return {
    gamesAnalyzed: games.length,
    record, mistakeCount, byPhase, byType, openings, topBlunders, lostPositionMoves,
  }
}
