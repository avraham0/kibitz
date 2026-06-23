// Recompute Stats from filtered GameSummary[] client-side.
// Mirrors src/report/aggregate.ts but uses pre-computed per-game accuracy
// values (weighted average) instead of raw eval data.
import type { GameSummary, Stats, BlunderRef, OpeningStat, Phase, Color, TimeBucket, CoachableType, OpponentBand } from './api-types.js'
import { TIME_BUCKETS, COACHABLE_TYPES } from './api-types.js'

function clockBucket(sec: number): TimeBucket {
  if (sec < 10) return '<10s'
  if (sec < 30) return '10-30s'
  if (sec < 60) return '30-60s'
  return '60s+'
}

function bandOf(g: GameSummary): OpponentBand | null {
  if (g.playerRating == null || g.opponentRating == null) return null
  const d = g.opponentRating - g.playerRating
  return d >= 50 ? 'stronger' : d <= -50 ? 'weaker' : 'similar'
}

function weightedAccuracy(pairs: { acc: number; n: number }[]): number {
  const total = pairs.reduce((s, p) => s + p.n, 0)
  if (!total) return 0
  return Math.round(pairs.reduce((s, p) => s + p.acc * p.n, 0) / total)
}

export function recomputeStats(games: GameSummary[]): Stats {
  const record = { wins: 0, losses: 0, draws: 0 }
  const byPhase: Record<Phase, number> = { opening: 0, middlegame: 0, endgame: 0 }
  const typeAcc: Record<string, { count: number; sum: number; missed: number; allowed: number }> =
    Object.fromEntries(COACHABLE_TYPES.map((t) => [t, { count: 0, sum: 0, missed: 0, allowed: 0 }]))
  const openingMap = new Map<string, { name: string; games: number; wins: number; mistakes: number }>()
  const blunders: BlunderRef[] = []
  let mistakeCount = 0
  let lostPositionMoves = 0
  const timeAcc: Record<TimeBucket, { moves: number; mistakes: number; blunders: number; sum: number }> =
    Object.fromEntries(TIME_BUCKETS.map((b) => [b, { moves: 0, mistakes: 0, blunders: 0, sum: 0 }])) as any
  let gamesWithClock = 0
  const conversion = { winningGames: 0, converted: 0 }

  const colorAgg: Record<Color, { games: number; wins: number; mistakes: number; accPairs: { acc: number; n: number }[] }> = {
    white: { games: 0, wins: 0, mistakes: 0, accPairs: [] },
    black: { games: 0, wins: 0, mistakes: 0, accPairs: [] },
  }
  const oppAgg: Record<OpponentBand, { games: number; wins: number; mistakes: number; accPairs: { acc: number; n: number }[] }> = {
    stronger: { games: 0, wins: 0, mistakes: 0, accPairs: [] },
    similar:  { games: 0, wins: 0, mistakes: 0, accPairs: [] },
    weaker:   { games: 0, wins: 0, mistakes: 0, accPairs: [] },
  }
  const phaseAccPairs: Record<Phase, { acc: number; n: number }[]> = { opening: [], middlegame: [], endgame: [] }
  const allAccPairs: { acc: number; n: number }[] = []
  const allAccStrictPairs: { acc: number; n: number }[] = []

  for (const g of games) {
    if (g.result === 'win') record.wins++
    else if (g.result === 'loss') record.losses++
    else record.draws++

    colorAgg[g.color].games++
    if (g.result === 'win') colorAgg[g.color].wins++

    const band = bandOf(g)
    if (band) {
      oppAgg[band].games++
      if (g.result === 'win') oppAgg[band].wins++
    }

    const key = g.family || 'Unknown'
    const o = openingMap.get(key) ?? { name: key, games: 0, wins: 0, mistakes: 0 }
    o.games++
    if (g.result === 'win') o.wins++

    let gameHadClock = false
    let gameDecisions = 0

    for (let mi = 0; mi < g.moves.length; mi++) {
      const m = g.moves[mi]
      if (!m.isPlayerMove) continue

      if (m.clockSeconds != null) {
        gameHadClock = true
        const tb = clockBucket(m.clockSeconds)
        timeAcc[tb].moves++
        if (m.type !== 'lost_position' && m.severity !== 'ok') {
          timeAcc[tb].mistakes++
          timeAcc[tb].sum += m.cpLoss
          if (m.severity === 'blunder') timeAcc[tb].blunders++
        }
      }

      gameDecisions++

      if (m.type === 'lost_position') { lostPositionMoves++; continue }
      if (m.severity === 'ok') continue

      mistakeCount++
      o.mistakes++
      colorAgg[g.color].mistakes++
      if (band) oppAgg[band].mistakes++
      byPhase[m.phase]++
      if (m.type in typeAcc) {
        typeAcc[m.type].count++
        typeAcc[m.type].sum += m.cpLoss
        if (m.missed) typeAcc[m.type].missed++
        else typeAcc[m.type].allowed++
      }
      if (m.severity === 'blunder') {
        blunders.push({
          url: g.url, ply: m.ply, san: m.san, bestSan: m.bestSan,
          fenBefore: m.fenBefore, cpLoss: m.cpLoss, type: m.type, missed: m.missed,
          openingName: g.openingName, family: g.family,
          movesAfter: g.moves.slice(mi + 1, mi + 5).map((m2) => m2.san),
        })
      }
    }

    if (gameHadClock) gamesWithClock++

    if (gameDecisions > 0) {
      allAccPairs.push({ acc: g.accuracy, n: gameDecisions })
      allAccStrictPairs.push({ acc: g.accuracyStrict, n: gameDecisions })
      colorAgg[g.color].accPairs.push({ acc: g.accuracy, n: gameDecisions })
      if (band) oppAgg[band].accPairs.push({ acc: g.accuracy, n: gameDecisions })
    }

    for (const phase of ['opening', 'middlegame', 'endgame'] as Phase[]) {
      const phaseN = g.moves.filter((m) => m.isPlayerMove && m.type !== 'lost_position' && m.phase === phase).length
      if (phaseN > 0 && g.accuracyByPhase[phase] > 0) {
        phaseAccPairs[phase].push({ acc: g.accuracyByPhase[phase], n: phaseN })
      }
    }

    if (g.wasWinning) {
      conversion.winningGames++
      if (g.result === 'win') conversion.converted++
    }

    openingMap.set(key, o)
  }

  const byType = Object.fromEntries(
    COACHABLE_TYPES.map((t) => [t, {
      count: typeAcc[t].count,
      avgCpLoss: typeAcc[t].count ? Math.round(typeAcc[t].sum / typeAcc[t].count) : 0,
      missed: typeAcc[t].missed,
      allowed: typeAcc[t].allowed,
    }]),
  ) as Stats['byType']

  const byTimeBucket = Object.fromEntries(
    TIME_BUCKETS.map((b) => [b, {
      moves: timeAcc[b].moves,
      mistakes: timeAcc[b].mistakes,
      blunders: timeAcc[b].blunders,
      avgCpLoss: timeAcc[b].mistakes ? Math.round(timeAcc[b].sum / timeAcc[b].mistakes) : 0,
    }]),
  ) as Stats['byTimeBucket']

  const openings: OpeningStat[] = [...openingMap.values()]
    .map((o) => ({
      name: o.name, games: o.games, wins: o.wins,
      winPct: o.games ? Math.round((o.wins / o.games) * 100) : 0,
      avgMistakes: o.games ? Math.round((o.mistakes / o.games) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.games - a.games)

  const byColor = Object.fromEntries(
    (['white', 'black'] as Color[]).map((c) => [c, {
      games: colorAgg[c].games, wins: colorAgg[c].wins,
      winPct: colorAgg[c].games ? Math.round((colorAgg[c].wins / colorAgg[c].games) * 100) : 0,
      accuracy: weightedAccuracy(colorAgg[c].accPairs),
      mistakes: colorAgg[c].mistakes,
    }]),
  ) as Stats['byColor']

  const byOpponent = Object.fromEntries(
    (['stronger', 'similar', 'weaker'] as OpponentBand[]).map((b) => [b, {
      games: oppAgg[b].games, wins: oppAgg[b].wins,
      accuracy: weightedAccuracy(oppAgg[b].accPairs),
      mistakes: oppAgg[b].mistakes,
    }]),
  ) as Stats['byOpponent']

  return {
    gamesAnalyzed: games.length,
    record, mistakeCount, byPhase, byType, openings,
    topBlunders: blunders.sort((a, b) => b.cpLoss - a.cpLoss).slice(0, 50),
    lostPositionMoves, byTimeBucket, gamesWithClock,
    accuracy: weightedAccuracy(allAccPairs),
    accuracyStrict: weightedAccuracy(allAccStrictPairs),
    accuracyByPhase: Object.fromEntries(
      (['opening', 'middlegame', 'endgame'] as Phase[]).map((p) => [p, weightedAccuracy(phaseAccPairs[p])]),
    ) as Record<Phase, number>,
    conversion, byColor, byOpponent,
  }
}
