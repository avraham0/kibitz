import type { GameAnalysis, MistakeType, Phase, Color } from '../types.js'
import { cpFromMoverPov, LOST_POSITION_CP } from '../analyze/game.js'
import type { MoveAnalysis } from '../types.js'
import { accuracyOf, accuracyStrictOf, turningPointIdx, reachedWinning } from './accuracy.js'

export type OpponentBand = 'stronger' | 'similar' | 'weaker'

// A player move counts as "already losing" (excluded from mistakes) when the best
// available eval before it was already worse than the threshold. Computed from the
// stored eval at report time, so the cutoff can change without re-analysis. The
// legacy `type === 'lost_position'` check covers caches written before this change.
// NOTE: this gates the coaching mistake buckets only — accuracy intentionally
// includes losing-position moves (the win% model already dampens their penalty).
function isLostPosition(m: MoveAnalysis): boolean {
  return m.type === 'lost_position' || cpFromMoverPov(m.evalBefore) <= LOST_POSITION_CP
}

export type BlunderRef = {
  url: string; ply: number; san: string; bestSan: string
  fenBefore: string; cpLoss: number; type: MistakeType; missed: boolean
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
  // Stricter, chess.com-leaning estimate of overall accuracy (for comparison only).
  accuracyStrict: number
  // Accuracy (0–100) restricted to the player's real decisions in each game phase.
  accuracyByPhase: Record<Phase, number>
  // Games where the player reached a clearly winning position (peak eval ≥ +300
  // from their POV) and how many of those ended in a win.
  conversion: { winningGames: number; converted: number }
  // Per-color split of games, results, accuracy, and mistakes.
  byColor: Record<Color, { games: number; wins: number; winPct: number; accuracy: number; mistakes: number }>
  // Accuracy / mistakes split by opponent strength relative to the player.
  byOpponent: Record<OpponentBand, { games: number; wins: number; accuracy: number; mistakes: number }>
}

// Eval (player POV, cp) at/above which a position is considered "clearly winning".
const WINNING_CP = 300

const TYPES: CoachableMistakeType[] = [
  'hung_piece', 'missed_tactic', 'bad_trade', 'king_safety', 'positional',
  'fork', 'pin', 'skewer', 'discovered_attack', 'trapped_piece', 'back_rank',
]

export type GameMove = {
  ply: number; san: string; bestSan: string; evalCp: number; cpLoss: number
  isPlayerMove: boolean; severity: MoveAnalysis['severity']; type: MistakeType; missed: boolean; fenBefore: string
  phase: Phase; clockSeconds: number | null
}
export type GameSummary = {
  gameId: string; url: string; playedAt: string; color: 'white' | 'black'
  result: 'win' | 'loss' | 'draw'; eco: string; openingName: string
  accuracy: number; accuracyStrict: number
  chesscomAccuracy?: number
  accuracyByPhase: Record<Phase, number>
  playerRating: number | null; opponentRating: number | null
  wasWinning: boolean; turningPointIdx: number | null
  moves: GameMove[]
}

// Per-game move list for the review/eval-graph UI. `evalCp` is white-POV centipawns
// (clamped to ±1500 for a readable graph); accuracy is this game's player accuracy.
export function perGameSummaries(games: GameAnalysis[]): GameSummary[] {
  return games.map((g) => {
    const moves: GameMove[] = g.moves.map((m) => {
      const moverPov = cpFromMoverPov(m.evalBefore)
      const whitePov = m.fenBefore.split(' ')[1] === 'w' ? moverPov : -moverPov
      return {
        ply: m.ply, san: m.san, bestSan: m.bestSan, cpLoss: m.cpLoss, isPlayerMove: m.isPlayerMove,
        severity: m.severity, type: m.type, missed: m.missed, fenBefore: m.fenBefore,
        phase: m.phase, clockSeconds: m.clockSeconds,
        evalCp: Math.max(-1500, Math.min(1500, whitePov)),
      }
    })
    const playerMoves = g.moves.filter((m) => m.isPlayerMove)
    const phasePlayerMoves: Record<Phase, MoveAnalysis[]> = { opening: [], middlegame: [], endgame: [] }
    for (const m of playerMoves) phasePlayerMoves[m.phase].push(m)
    const accuracyByPhase = Object.fromEntries(
      (['opening', 'middlegame', 'endgame'] as Phase[]).map((p) => [p, accuracyOf(phasePlayerMoves[p])]),
    ) as Record<Phase, number>
    return {
      gameId: g.gameId, url: g.url, playedAt: g.playedAt, color: g.color, result: g.result,
      eco: g.eco, openingName: g.openingName,
      accuracy: accuracyOf(playerMoves),
      accuracyStrict: accuracyStrictOf(playerMoves),
      chesscomAccuracy: g.chesscomAccuracy,
      accuracyByPhase,
      playerRating: g.playerRating, opponentRating: g.opponentRating,
      wasWinning: reachedWinning(g.moves), turningPointIdx: turningPointIdx(g.moves),
      moves,
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
  // Accuracy is blended per-game (lichess weighted+harmonic), so collect the player's
  // moves into segments and run the blend once per segment at the end.
  let accWeightedSum = 0
  let accStrictWeightedSum = 0
  let accWeightTotal = 0
  const conversion = { winningGames: 0, converted: 0 }
  const colorAgg: Record<Color, { games: number; wins: number; mistakes: number }> = {
    white: { games: 0, wins: 0, mistakes: 0 },
    black: { games: 0, wins: 0, mistakes: 0 },
  }
  const phaseMoves: Record<Phase, MoveAnalysis[]> = { opening: [], middlegame: [], endgame: [] }
  const colorMoves: Record<Color, MoveAnalysis[]> = { white: [], black: [] }
  const oppAgg: Record<OpponentBand, { games: number; wins: number; mistakes: number }> = {
    stronger: { games: 0, wins: 0, mistakes: 0 }, similar: { games: 0, wins: 0, mistakes: 0 }, weaker: { games: 0, wins: 0, mistakes: 0 },
  }
  const oppMoves: Record<OpponentBand, MoveAnalysis[]> = { stronger: [], similar: [], weaker: [] }
  // Opponent strength relative to the player (±50 Elo band). null when ratings unknown.
  const bandOf = (g: GameAnalysis): OpponentBand | null => {
    if (g.playerRating == null || g.opponentRating == null) return null
    const d = g.opponentRating - g.playerRating
    return d >= 50 ? 'stronger' : d <= -50 ? 'weaker' : 'similar'
  }

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

    const key = byVariation ? g.eco + '|' + g.openingName : (g.eco || 'Unknown')
    const o = openingMap.get(key) ?? { eco: g.eco, name: g.openingName, games: 0, wins: 0, mistakes: 0 }
    o.games++
    if (g.result === 'win') o.wins++
    // ECO grouping: label the group with its shortest member name (most "base").
    if (!byVariation && g.openingName.length < o.name.length) o.name = g.openingName

    let gameHadClock = false
    let gamePeak = -Infinity
    const gamePlayerMoves: MoveAnalysis[] = []

    for (const m of g.moves) {
      // Peak position quality from the player's POV across the whole game.
      const pov = m.isPlayerMove ? cpFromMoverPov(m.evalBefore) : -cpFromMoverPov(m.evalBefore)
      if (pov > gamePeak) gamePeak = pov
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
      // Accuracy includes every player move (even losing positions).
      gamePlayerMoves.push(m)
      phaseMoves[m.phase].push(m)
      colorMoves[g.color].push(m)
      if (band) oppMoves[band].push(m)
      if (isLostPosition(m)) {
        lostPositionMoves++
        continue
      }
      if (m.severity === 'ok') continue
      mistakeCount++
      o.mistakes++
      colorAgg[g.color].mistakes++
      if (band) oppAgg[band].mistakes++
      byPhase[m.phase]++
      typeAcc[m.type].count++
      typeAcc[m.type].sum += m.cpLoss
      if (m.missed) typeAcc[m.type].missed++
      else typeAcc[m.type].allowed++
      if (m.severity === 'blunder') {
        blunders.push({
          url: g.url, ply: m.ply, san: m.san, bestSan: m.bestSan,
          fenBefore: m.fenBefore, cpLoss: m.cpLoss, type: m.type, missed: m.missed,
        })
      }
    }
    if (gameHadClock) gamesWithClock++
    // Per-game accuracy, weighted by the number of decisions in the game.
    if (gamePlayerMoves.length) {
      accWeightedSum += accuracyOf(gamePlayerMoves) * gamePlayerMoves.length
      accStrictWeightedSum += accuracyStrictOf(gamePlayerMoves) * gamePlayerMoves.length
      accWeightTotal += gamePlayerMoves.length
    }
    if (gamePeak >= WINNING_CP) {
      conversion.winningGames++
      if (g.result === 'win') conversion.converted++
    }
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

  const topBlunders = blunders.sort((a, b) => b.cpLoss - a.cpLoss).slice(0, 50)

  const accuracy = accWeightTotal ? Math.round(accWeightedSum / accWeightTotal) : 100
  const accuracyStrict = accWeightTotal ? Math.round(accStrictWeightedSum / accWeightTotal) : 100
  const accuracyByPhase = Object.fromEntries(
    (['opening', 'middlegame', 'endgame'] as Phase[]).map((p) => [p, accuracyOf(phaseMoves[p])]),
  ) as Record<Phase, number>
  const byColor = Object.fromEntries(
    (['white', 'black'] as Color[]).map((c) => {
      const a = colorAgg[c]
      return [c, {
        games: a.games, wins: a.wins,
        winPct: a.games ? Math.round((a.wins / a.games) * 100) : 0,
        accuracy: accuracyOf(colorMoves[c]),
        mistakes: a.mistakes,
      }]
    }),
  ) as Stats['byColor']
  const byOpponent = Object.fromEntries(
    (['stronger', 'similar', 'weaker'] as OpponentBand[]).map((b) => [b, {
      games: oppAgg[b].games, wins: oppAgg[b].wins,
      accuracy: accuracyOf(oppMoves[b]), mistakes: oppAgg[b].mistakes,
    }]),
  ) as Stats['byOpponent']

  return {
    gamesAnalyzed: games.length,
    record, mistakeCount, byPhase, byType, openings, topBlunders, lostPositionMoves,
    byTimeBucket, gamesWithClock, accuracy, accuracyStrict, accuracyByPhase, conversion, byColor, byOpponent,
  }
}
