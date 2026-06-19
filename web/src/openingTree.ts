import { Chess } from 'chess.js'
import type { GameSummary } from './api-types.js'

export type MoveStats = { count: number; wins: number; fenAfter: string }
export type OpeningTree = Record<string, Record<string, MoveStats>>

function computeFenAfter(fenBefore: string, san: string): string {
  try { const c = new Chess(fenBefore); c.move(san); return c.fen() } catch { return '' }
}

export function buildTree(games: GameSummary[]): OpeningTree {
  const tree: OpeningTree = {}
  for (const g of games) {
    for (const m of g.moves) {
      if (m.phase !== 'opening') continue
      if (!tree[m.fenBefore]) tree[m.fenBefore] = {}
      const prev = tree[m.fenBefore][m.san] ?? { count: 0, wins: 0, fenAfter: '' }
      const fenAfter = prev.fenAfter || computeFenAfter(m.fenBefore, m.san)
      tree[m.fenBefore][m.san] = {
        count: prev.count + 1,
        wins: prev.wins + (g.result === 'win' ? 1 : 0),
        fenAfter,
      }
    }
  }
  return tree
}

export function topMove(tree: OpeningTree, fen: string): { san: string; stats: MoveStats } | null {
  const moves = tree[fen]
  if (!moves) return null
  const best = Object.entries(moves).sort((a, b) => b[1].count - a[1].count)[0]
  return best ? { san: best[0], stats: best[1] } : null
}
