import type { GameAnalysis, MistakeType, Phase } from '../types.js'
import { cpFromMoverPov } from '../analyze/game.js'

// Win-% for the side to move from a centipawn eval (lichess model).
function winPct(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}
// Per-move accuracy from the win-% the move gave up (lichess accuracy curve).
function moveAccuracy(winBefore: number, winAfter: number): number {
  const drop = Math.max(0, winBefore - winAfter)
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669))
}

export type BlunderRef = {
  url: string; ply: number; san: string; bestSan: string
  fenBefore: string; cpLoss: number; type: MistakeType
}
export type OpeningStat = {
  eco: string; name: string; games: number; wins: number; winPct: number; avgMistakes: number
}

export type TimeBucket = '<10s' | '10-30s' | '30-60s' | '60s+'
export const TIME_BUCKETS: TimeBucket[] = ['<10s', '10-30s', '30-60s', '60s+']

function clockBucket(sec: number): TimeBucket {
  if (sec < 10) return '<10s'
  if (sec < 30) return '10-30s'
  if (sec < 60) return '30-60s'
  return '60s+'
}

type CoachableMistakeType = Exclude<MistakeType, 'lost_position'>

export type Stats = {
  gamesAnalyzed: number
  record: { wins: number; losses: number; draws: number }
  mistakeCount: number
  byPhase: Record<Phase, number>
  byType: Record<CoachableMistakeType, { count: number; avgCpLoss: number; missed: number; allowed: number }>
  openings: OpeningStat[]
  topBlunders: BlunderRef[]
  lostPositionMoves: number
  byTimeBucket: Record<TimeBucket, { moves: number; mistakes: number; blunders: number; avgCpLoss: number }>
  gamesWithClock: number
  // Overall accuracy (0–100) over the player's real decisions (excludes lost-position moves).
  accuracy: number
}

const TYPES: CoachableMistakeType[] = [
  'hung_piece', 'missed_tactic', 'bad_trade', 'king_safety', 'positional',
  'fork', 'pin', 'skewer', 'discovered_attack', 'trapped_piece', 'back_rank',
]

export type GameMove = {
  ply: number; san: string; evalCp: number; cpLoss: number; isPlayerMove: boolean; fenBefore: string
}
export type GameSummary = {
  gameId: string; url: string; playedAt: string; color: 'white' | 'black'
  result: 'win' | 'loss' | 'draw'; eco: string; openingName: string; accuracy: number
  moves: GameMove[]
}

// Per-game move list for the review/eval-graph UI. `evalCp` is white-POV centipawns
// (clamped to ±1500 for a readable graph); accuracy is this game's player accuracy.
export function perGameSummaries(games: GameAnalysis[]): GameSummary[] {
  return games.map((g) => {
    let accSum = 0
    let accN = 0
    const moves: GameMove[] = g.moves.map((m) => {
      const moverPov = cpFromMoverPov(m.evalBefore)
      const whitePov = m.fenBefore.split(' ')[1] === 'w' ? moverPov : -moverPov
      if (m.isPlayerMove && m.type !== 'lost_position') {
        accSum += moveAccuracy(winPct(moverPov), winPct(-cpFromMoverPov(m.evalAfterPlayed)))
        accN++
      }
      return {
        ply: m.ply, san: m.san, cpLoss: m.cpLoss, isPlayerMove: m.isPlayerMove, fenBefore: m.fenBefore,
        evalCp: Math.max(-1500, Math.min(1500, whitePov)),
      }
    })
    return {
      gameId: g.gameId, url: g.url, playedAt: g.playedAt, color: g.color, result: g.result,
      eco: g.eco, openingName: g.openingName, accuracy: accN ? Math.round(accSum / accN) : 100, moves,
    }
  })
}

export function aggregate(games: GameAnalysis[], opts?: { variations?: boolean }): Stats {
  // By default, group openings by ECO code (all C50 lines together), labelling each
  // row with the shortest opening name in the group. With `variations: true`, keep
  // each specific line (eco + full name) separate.
  const byVariation = opts?.variations === true
  const record = { wins: 0, losses: 0, draws: 0 }
  const byPhase: Record<Phase, number> = { opening: 0, middlegame: 0, endgame: 0 }
  const typeAcc: Record<string, { count: number; sum: number; missed: number; allowed: number }> =
    Object.fromEntries(TYPES.map((t) => [t, { count: 0, sum: 0, missed: 0, allowed: 0 }]))
  const openingMap = new Map<string, { eco: string; name: string; games: number; wins: number; mistakes: number }>()
  const blunders: BlunderRef[] = []
  let mistakeCount = 0
  let lostPositionMoves = 0
  const timeAcc: Record<TimeBucket, { moves: number; mistakes: number; blunders: number; sum: number }> =
    Object.fromEntries(TIME_BUCKETS.map((b) => [b, { moves: 0, mistakes: 0, blunders: 0, sum: 0 }])) as Record<TimeBucket, { moves: number; mistakes: number; blunders: number; sum: number }>
  let gamesWithClock = 0
  let accuracySum = 0
  let accuracyMoves = 0

  for (const g of games) {
    if (g.result === 'win') record.wins++
    else if (g.result === 'loss') record.losses++
    else record.draws++

    const key = byVariation ? g.eco + '|' + g.openingName : (g.eco || 'Unknown')
    const o = openingMap.get(key) ?? { eco: g.eco, name: g.openingName, games: 0, wins: 0, mistakes: 0 }
    o.games++
    if (g.result === 'win') o.wins++
    // ECO grouping: label the group with its shortest member name (most "base").
    if (!byVariation && g.openingName.length < o.name.length) o.name = g.openingName

    let gameHadClock = false

    for (const m of g.moves) {
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
      if (m.type === 'lost_position') {
        lostPositionMoves++
        continue
      }
      // Accuracy over every real decision (including good moves), not just mistakes.
      const winBefore = winPct(cpFromMoverPov(m.evalBefore))
      const winAfter = winPct(-cpFromMoverPov(m.evalAfterPlayed))
      accuracySum += moveAccuracy(winBefore, winAfter)
      accuracyMoves++
      if (m.severity === 'ok') continue
      mistakeCount++
      o.mistakes++
      byPhase[m.phase]++
      typeAcc[m.type].count++
      typeAcc[m.type].sum += m.cpLoss
      if (m.missed) typeAcc[m.type].missed++
      else typeAcc[m.type].allowed++
      if (m.severity === 'blunder') {
        blunders.push({
          url: g.url, ply: m.ply, san: m.san, bestSan: m.bestSan,
          fenBefore: m.fenBefore, cpLoss: m.cpLoss, type: m.type,
        })
      }
    }
    if (gameHadClock) gamesWithClock++
    openingMap.set(key, o)
  }

  const byType = Object.fromEntries(
    TYPES.map((t) => [t, {
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
      eco: o.eco, name: o.name, games: o.games, wins: o.wins,
      winPct: o.games ? Math.round((o.wins / o.games) * 100) : 0,
      avgMistakes: o.games ? Math.round((o.mistakes / o.games) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.games - a.games)

  const topBlunders = blunders.sort((a, b) => b.cpLoss - a.cpLoss).slice(0, 10)

  const accuracy = accuracyMoves ? Math.round(accuracySum / accuracyMoves) : 100

  return {
    gamesAnalyzed: games.length,
    record, mistakeCount, byPhase, byType, openings, topBlunders, lostPositionMoves,
    byTimeBucket, gamesWithClock, accuracy,
  }
}
