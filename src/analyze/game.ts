import { Chess } from 'chess.js'
import type { RawGame, GameAnalysis, MoveAnalysis, Eval } from '../types.js'
import { cpLossToSeverity } from '../types.js'
import { detectPhase } from './phase.js'
import { classifyMistake, maxHangingGain } from './classify.js'
import { detectMotif } from './motifs.js'

export type Evaluator = (fen: string, depth: number) => Promise<{ eval: Eval; bestUci: string; pv: string[] }>

export const MAX_CPLOSS = 2000
export const LOST_POSITION_CP = -500

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

    const before = await evaluate(rm.fenBefore, depth)
    const bestCp = cpFromMoverPov(before.eval)

    const playedV = (new Chess(rm.fenBefore).moves({ verbose: true }) as any[]).find((m) => m.san === rm.san)
    const playedUci = playedV ? `${playedV.from}${playedV.to}${playedV.promotion ?? ''}` : ''
    const playedIsBest = playedUci !== '' && playedUci === before.bestUci

    // The after-position search is only needed when the played move is NOT the engine's
    // best move. Playing the best move means zero centipawn loss by definition — so we
    // skip the second (expensive) engine search entirely. This also removes the small
    // two-search horizon noise that otherwise showed up on best-move plies.
    let cpLoss: number
    let evalAfterPlayed: Eval
    let fenAfter = ''
    let afterPv: string[] | null = null
    if (playedIsBest) {
      cpLoss = 0
      evalAfterPlayed = before.eval
    } else {
      const chess = new Chess(rm.fenBefore)
      chess.move(rm.san)
      fenAfter = chess.fen()
      const after = await evaluate(fenAfter, depth)
      afterPv = after.pv
      evalAfterPlayed = after.eval
      const playedCpMoverPov = -cpFromMoverPov(after.eval)
      cpLoss = Math.min(MAX_CPLOSS, Math.max(0, bestCp - playedCpMoverPov))
    }
    const severity = cpLossToSeverity(cpLoss)

    let type: import('../types.js').MistakeType
    let missed = false
    if (bestCp <= LOST_POSITION_CP) {
      type = 'lost_position'
    } else if (severity === 'ok') {
      type = classifyMistake({ fenBefore: rm.fenBefore, san: rm.san, bestUci: before.bestUci })
    } else {
      const playedDiffersFromBest = playedUci !== before.bestUci
      const missedHit = playedDiffersFromBest ? detectMotif(rm.fenBefore, before.pv) : null
      if (missedHit) {
        missed = true
        type = missedHit.motif
      } else {
        const allowedHit = afterPv ? detectMotif(fenAfter, afterPv) : null
        if (allowedHit) {
          missed = false
          type = allowedHit.motif
        } else if (maxHangingGain(rm.fenBefore) >= 200 && playedDiffersFromBest) {
          missed = true
          type = 'missed_tactic'
        } else {
          missed = false
          type = classifyMistake({ fenBefore: rm.fenBefore, san: rm.san, bestUci: before.bestUci })
        }
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
    depth,
    moves,
  }
}
