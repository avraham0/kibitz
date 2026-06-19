import type { MoveAnalysis } from '../types.js'
import { cpFromMoverPov, LOST_POSITION_CP } from '../analyze/game.js'

// Win-% for the side to move from a centipawn eval (lichess model).
export function winPct(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

// Per-move accuracy from the win-% the move gave up (Lichess accuracy curve).
// Gives numbers ~10-15 pts below chess.com's CAPS2 for games with real mistakes,
// which feels more honest; clean games still score near 100%.
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const drop = Math.max(0, winBefore - winAfter)
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669))
}

// Pre-move win% and per-move accuracy from ONE consistent eval.
function moveStats(m: MoveAnalysis): { acc: number; win: number } {
  const before = cpFromMoverPov(m.evalBefore)
  const winB = winPct(before)
  const winA = winPct(before - m.cpLoss)
  return { acc: moveAccuracy(winB, winA), win: winB }
}

// Only moves from positions that were still competitive (not already lost).
// Moves played from a losing position get inflated accuracy by the Lichess formula
// because win% can't drop much further — excluding them makes the number honest.
function competitiveMoves(playerMoves: MoveAnalysis[]): MoveAnalysis[] {
  return playerMoves.filter((m) => cpFromMoverPov(m.evalBefore) >= LOST_POSITION_CP)
}

function geometricMean(accs: number[]): number {
  if (accs.length === 0) return 100
  const sumLog = accs.reduce((s, a) => s + Math.log(Math.max(a, 1)), 0)
  return Math.exp(sumLog / accs.length)
}

function harmonicMean(accs: number[]): number {
  if (accs.length === 0) return 100
  return accs.length / accs.reduce((a, b) => a + 1 / Math.max(b, 1), 0)
}

// Accuracy (0–100): geometric mean of per-move Lichess accuracies for competitive moves.
// Geometric mean penalizes catastrophic individual moves more than arithmetic mean,
// while excluding moves in already-lost positions (which get inflated scores).
export function accuracyOf(playerMoves: MoveAnalysis[]): number {
  const moves = competitiveMoves(playerMoves)
  if (moves.length === 0) return 100
  return Math.round(geometricMean(moves.map((m) => moveStats(m).acc)))
}

// Stricter variant: harmonic mean of competitive moves. More sensitive to individual blunders.
export function accuracyStrictOf(playerMoves: MoveAnalysis[]): number {
  const moves = competitiveMoves(playerMoves)
  if (moves.length === 0) return 100
  return Math.round(harmonicMean(moves.map((m) => moveStats(m).acc)))
}

// Index into the move list of the player move that surrendered the game: the
// largest win% drop on a move that began at least equal (≥45%) and left the player
// worse (<45%). null when no single move decisively lost it.
export function turningPointIdx(moves: MoveAnalysis[]): number | null {
  let bestIdx = -1
  let bestDrop = 0
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i]
    if (!m.isPlayerMove) continue
    const before = cpFromMoverPov(m.evalBefore)
    const wb = winPct(before)
    const wa = winPct(before - m.cpLoss)
    const drop = wb - wa
    if (wb >= 45 && wa < 45 && drop > bestDrop) { bestDrop = drop; bestIdx = i }
  }
  return bestIdx >= 0 && bestDrop >= 15 ? bestIdx : null
}

// Did the player reach a clearly winning position (peak eval ≥ threshold, their POV)?
export function reachedWinning(moves: MoveAnalysis[], cpThreshold = 300): boolean {
  let peak = -Infinity
  for (const m of moves) {
    const pov = m.isPlayerMove ? cpFromMoverPov(m.evalBefore) : -cpFromMoverPov(m.evalBefore)
    if (pov > peak) peak = pov
  }
  return peak >= cpThreshold
}
