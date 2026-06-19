import { Chess } from 'chess.js'
import type { RawGame, GameAnalysis, MoveAnalysis, Eval } from '../types.js'
import { cpLossToSeverity } from '../types.js'
import { detectPhase } from './phase.js'
import { classifyMistake, maxHangingGain } from './classify.js'
import { detectMotif } from './motifs.js'

export type Evaluator = (fen: string, depth: number) => Promise<{ eval: Eval; bestUci: string; pv: string[] }>

export const MAX_CPLOSS = 2000

// Two-pass analysis: scan every move at SCAN_DEPTH, then re-search only the suspect
// player moves (shallow loss ≥ CANDIDATE_CP) at the full requested depth. Most of the
// speed of the shallow pass, with full-depth accuracy where it actually matters
// (your blunders + turning points). Opponent moves get only the shallow scan.
const SCAN_DEPTH = 8
const CANDIDATE_CP = 60

function negateEval(e: Eval): Eval {
  return { cp: e.cp === null ? null : -e.cp, mate: e.mate === null ? null : -e.mate }
}
// If the best move before a move still leaves the player worse than this (≈ already
// down two pawns), it is treated as a lost-position move — not a coachable mistake.
// Mistakes made when you're already clearly losing aren't the ones worth studying.
// Applied at REPORT time in aggregate (from the stored eval), so changing it does
// not require re-analysis.
export const LOST_POSITION_CP = -200

export function cpFromMoverPov(ev: Eval): number {
  if (ev.mate !== null) {
    return ev.mate > 0 ? 100000 - ev.mate * 100 : -100000 - ev.mate * 100
  }
  return ev.cp ?? 0
}

function uciToSan(fen: string, uci: string): string {
  if (!uci || uci === '0000') return ''
  const chess = new Chess(fen)
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const promotion = uci.length > 4 ? uci[4] : undefined
  try {
    const mv = chess.move({ from, to, promotion } as any)
    return mv?.san ?? ''
  } catch {
    return ''
  }
}

export async function analyzeGame(
  raw: RawGame,
  depth: number,
  evaluate: Evaluator,
): Promise<GameAnalysis> {
  const moves: MoveAnalysis[] = []
  for (let i = 0; i < raw.moves.length; i++) {
    const rm = raw.moves[i]
    const ply = i + 1
    const sideToMove = rm.fenBefore.split(' ')[1] // 'w' | 'b'
    const isPlayerMove =
      (sideToMove === 'w' && raw.color === 'white') ||
      (sideToMove === 'b' && raw.color === 'black')

    const scanDepth = Math.min(SCAN_DEPTH, depth)

    // Opponent moves never count as the player's mistakes — a single shallow eval is
    // enough to feed the eval graph. Skip the after-search and classification.
    if (!isPlayerMove) {
      const ev = await evaluate(rm.fenBefore, scanDepth)
      moves.push({
        ply, fenBefore: rm.fenBefore, san: rm.san, bestSan: uciToSan(rm.fenBefore, ev.bestUci),
        evalBefore: ev.eval, evalAfterPlayed: negateEval(ev.eval), cpLoss: 0, severity: 'ok',
        type: 'positional', missed: false, phase: detectPhase(rm.fenBefore, ply),
        clockSeconds: rm.clockSeconds, isPlayerMove: false,
      })
      continue
    }

    // Player move — shallow scan first.
    let before = await evaluate(rm.fenBefore, scanDepth)
    const playedV = (new Chess(rm.fenBefore).moves({ verbose: true }) as any[]).find((m) => m.san === rm.san)
    const playedUci = playedV ? `${playedV.from}${playedV.to}${playedV.promotion ?? ''}` : ''
    let playedIsBest = playedUci !== '' && playedUci === before.bestUci

    let cpLoss: number
    let evalAfterPlayed: Eval
    let fenAfter = ''
    let afterPv: string[] | null = null

    if (playedIsBest) {
      // Played the best move → no loss; skip the after-search entirely.
      cpLoss = 0
      evalAfterPlayed = negateEval(before.eval)
    } else {
      const chess = new Chess(rm.fenBefore)
      chess.move(rm.san)
      fenAfter = chess.fen()
      let after = await evaluate(fenAfter, scanDepth)
      const shallowLoss = cpFromMoverPov(before.eval) - (-cpFromMoverPov(after.eval))

      if (depth > scanDepth && shallowLoss >= CANDIDATE_CP) {
        // Suspect move — confirm at full depth (both sides of the move).
        before = await evaluate(rm.fenBefore, depth)
        playedIsBest = playedUci === before.bestUci
        if (playedIsBest) {
          cpLoss = 0
          evalAfterPlayed = negateEval(before.eval)
        } else {
          after = await evaluate(fenAfter, depth)
          afterPv = after.pv
          evalAfterPlayed = after.eval
          cpLoss = Math.min(MAX_CPLOSS, Math.max(0, cpFromMoverPov(before.eval) - (-cpFromMoverPov(after.eval))))
        }
      } else {
        afterPv = after.pv
        evalAfterPlayed = after.eval
        cpLoss = Math.min(MAX_CPLOSS, Math.max(0, shallowLoss))
      }
    }
    const severity = cpLossToSeverity(cpLoss)

    // Note: lost-position exclusion is applied at report time (aggregate) from
    // evalBefore — not encoded into `type` here — so the threshold can change
    // without re-analysis. Here we just classify the move on its own merits.
    let type: import('../types.js').MistakeType
    let missed = false
    if (severity === 'ok') {
      type = classifyMistake({ fenBefore: rm.fenBefore, san: rm.san, bestUci: before.bestUci })
    } else {
      // What the move did to YOU ranks over what it failed to do. A move that hangs
      // material or walks into a tactic is explained by that — not by some unrelated
      // tactic in the engine's best line (which previously produced wrong "missed a
      // pin" labels on plain piece-hangs).
      const playedDiffersFromBest = playedUci !== before.bestUci
      const allowedHit = afterPv ? detectMotif(fenAfter, afterPv) : null
      const hungAfter = fenAfter ? maxHangingGain(fenAfter) : 0 // material the opponent can now grab
      const missedHit = playedDiffersFromBest ? detectMotif(rm.fenBefore, before.pv) : null
      if (hungAfter >= 200) {
        // Directly droppable material is a hang — not whatever motif the refutation
        // line happens to contain (a queen capture isn't a "pin").
        missed = false
        type = 'hung_piece'
      } else if (allowedHit) {
        missed = false
        type = allowedHit.motif
      } else if (missedHit) {
        missed = true
        type = missedHit.motif
      } else if (maxHangingGain(rm.fenBefore) >= 200 && playedDiffersFromBest) {
        missed = true
        type = 'missed_tactic'
      } else {
        missed = false
        type = classifyMistake({ fenBefore: rm.fenBefore, san: rm.san, bestUci: before.bestUci })
      }
    }

    moves.push({
      ply,
      fenBefore: rm.fenBefore,
      san: rm.san,
      bestSan: uciToSan(rm.fenBefore, before.bestUci),
      evalBefore: before.eval,
      evalAfterPlayed,
      cpLoss,
      severity,
      type,
      missed,
      phase: detectPhase(rm.fenBefore, ply),
      clockSeconds: rm.clockSeconds,
      isPlayerMove,
    })
  }

  return {
    gameId: raw.gameId,
    url: raw.url,
    playedAt: raw.playedAt,
    color: raw.color,
    result: raw.result,
    eco: raw.eco,
    openingName: raw.openingName,
    playerRating: raw.playerRating,
    opponentRating: raw.opponentRating,
    depth,
    moves,
  }
}
