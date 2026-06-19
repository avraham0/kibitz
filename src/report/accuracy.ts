import type { Eval, MoveAnalysis } from '../types.js'
import { cpFromMoverPov } from '../analyze/game.js'

// Win-% for the side to move from a centipawn eval (lichess model).
export function winPct(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

// Per-move accuracy from the win-% the move gave up (lichess accuracy curve).
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const drop = Math.max(0, winBefore - winAfter)
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669))
}

function sameEval(a: Eval, b: Eval): boolean {
  return a.cp === b.cp && a.mate === b.mate
}

// Player win% AFTER their move. Best-move plies skip the after-search and store
// evalAfterPlayed === evalBefore (player POV) — those have no win% change. For all
// other moves evalAfterPlayed is from the opponent's POV, so negate to the player's.
export function playerWinAfter(m: MoveAnalysis): number {
  return sameEval(m.evalAfterPlayed, m.evalBefore)
    ? winPct(cpFromMoverPov(m.evalBefore))
    : winPct(-cpFromMoverPov(m.evalAfterPlayed))
}

function stdev(xs: number[]): number {
  if (xs.length === 0) return 0
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length)
}

// Blend a volatility-weighted mean with a harmonic mean of per-move accuracies
// (lichess method). The harmonic term makes a single blunder weigh heavily, so a
// lost game scores well below its average move quality — closer to how chess.com /
// lichess report accuracy. `wins` are the player-POV win% before each move, used to
// weight by local volatility (mistakes in sharp positions count more).
export function blendAccuracy(accs: number[], wins: number[]): number {
  const n = accs.length
  if (n === 0) return 100
  const windowSize = Math.max(2, Math.min(8, Math.floor(n / 10)))
  let wSum = 0
  let wTot = 0
  for (let i = 0; i < n; i++) {
    const window = wins.slice(Math.max(0, i - windowSize + 1), i + 1)
    const weight = Math.min(12, Math.max(0.5, stdev(window)))
    wSum += accs[i] * weight
    wTot += weight
  }
  const weighted = wSum / wTot
  const harmonic = n / accs.reduce((a, b) => a + 1 / Math.max(b, 1), 0)
  return Math.max(0, Math.min(100, Math.round((weighted + harmonic) / 2)))
}

// Accuracy (0–100) over a list of the player's moves. Includes moves made in losing
// positions — the win% model already dampens their penalty, so excluding them would
// inflate the score for games that were lost.
export function accuracyOf(playerMoves: MoveAnalysis[]): number {
  const accs: number[] = []
  const wins: number[] = []
  for (const m of playerMoves) {
    const wb = winPct(cpFromMoverPov(m.evalBefore))
    accs.push(moveAccuracy(wb, playerWinAfter(m)))
    wins.push(wb)
  }
  return blendAccuracy(accs, wins)
}

function harmonicMean(accs: number[]): number {
  if (accs.length === 0) return 100
  return accs.length / accs.reduce((a, b) => a + 1 / Math.max(b, 1), 0)
}

// A stricter, chess.com-leaning ESTIMATE: a steeper per-move penalty combined with a
// pure harmonic mean (so inaccuracies and blunders weigh more). This is an
// approximation for comparison only — chess.com's CAPS2 is proprietary and not
// reproducible; expect the same rough offset, not an exact match.
export function accuracyStrictOf(playerMoves: MoveAnalysis[]): number {
  if (playerMoves.length === 0) return 100
  const accs = playerMoves.map((m) => {
    const drop = Math.max(0, winPct(cpFromMoverPov(m.evalBefore)) - playerWinAfter(m))
    return Math.max(0, Math.min(100, 100 * Math.exp(-0.062 * drop)))
  })
  return Math.round(harmonicMean(accs))
}
