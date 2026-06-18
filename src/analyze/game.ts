import { Chess } from 'chess.js'
import type { RawGame, GameAnalysis, MoveAnalysis, Eval } from '../types.js'
import { cpLossToSeverity } from '../types.js'
import { detectPhase } from './phase.js'
import { classifyMistake } from './classify.js'

export type Evaluator = (fen: string, depth: number) => Promise<{ eval: Eval; bestUci: string }>

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

    // Position after the played move (opponent to move): negate to mover POV.
    const chess = new Chess(rm.fenBefore)
    chess.move(rm.san)
    const fenAfter = chess.fen()
    const after = await evaluate(fenAfter, depth)
    const playedCpMoverPov = -cpFromMoverPov(after.eval)
    const evalAfterPlayed: Eval = after.eval

    const cpLoss = Math.min(MAX_CPLOSS, Math.max(0, bestCp - playedCpMoverPov))
    const severity = cpLossToSeverity(cpLoss)
    const type = bestCp <= LOST_POSITION_CP
      ? 'lost_position' as const
      : classifyMistake({ fenBefore: rm.fenBefore, san: rm.san, bestUci: before.bestUci })

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
