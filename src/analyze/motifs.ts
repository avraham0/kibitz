import { Chess } from 'chess.js'
import type { Motif, PieceSymbol } from '../types.js'
import { MOTIFS, PIECE_VALUE } from '../types.js'

export type MotifHit = { motif: Motif; ply: number }

const MAX_PLIES = 8

type Ctx = {
  fens: string[]      // fens[i] = position before pv[i]; last entry = final position
  index: number       // index of the beneficiary move within pv
  move: any           // verbose move object for pv[index]
  beneficiary: 'w' | 'b'
}

// ---- geometry helpers ----
function coords(sq: string): { f: number; r: number } {
  return { f: sq.charCodeAt(0) - 97, r: Number(sq[1]) - 1 }
}
// direction step from a toward b if colinear on rank/file/diagonal, else null
function dir(a: string, b: string): { df: number; dr: number } | null {
  const A = coords(a), B = coords(b)
  const df = Math.sign(B.f - A.f), dr = Math.sign(B.r - A.r)
  if (A.f === B.f && A.r === B.r) return null
  if (A.f === B.f || A.r === B.r || Math.abs(B.f - A.f) === Math.abs(B.r - A.r)) {
    return { df, dr }
  }
  return null
}
function sameLine(a: string, mid: string, b: string): boolean {
  const d1 = dir(a, mid), d2 = dir(a, b)
  return !!d1 && !!d2 && d1.df === d2.df && d1.dr === d2.dr
}
// first occupied square stepping from `from` in the direction toward `through`, starting past `through`
function firstPieceBeyond(chess: Chess, from: string, through: string): { sq: string; piece: any } | null {
  const d = dir(from, through)
  if (!d) return null
  let f = coords(through).f + d.df, r = coords(through).r + d.dr
  while (f >= 0 && f < 8 && r >= 0 && r < 8) {
    const sq = String.fromCharCode(97 + f) + (r + 1)
    const p = chess.get(sq as any)
    if (p) return { sq, piece: p }
    f += d.df; r += d.dr
  }
  return null
}
function kingSquare(chess: Chess, color: 'w' | 'b'): string {
  for (const row of chess.board()) {
    for (const sq of row) {
      if (sq && sq.type === 'k' && sq.color === color) return sq.square
    }
  }
  return ''
}
function pieceValue(t: string): number {
  return t === 'k' ? 100000 : PIECE_VALUE[t as PieceSymbol]
}
function materialBalance(fen: string, color: 'w' | 'b'): number {
  const chess = new Chess(fen)
  let bal = 0
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.type === 'k') continue
      bal += sq.color === color ? PIECE_VALUE[sq.type as PieceSymbol] : -PIECE_VALUE[sq.type as PieceSymbol]
    }
  }
  return bal
}
// material the beneficiary gains from fenBefore to `n` plies after the move
function beneficiaryGain(ctx: Ctx, n: number): number {
  const endIdx = Math.min(ctx.index + 1 + n, ctx.fens.length - 1)
  return materialBalance(ctx.fens[endIdx], ctx.beneficiary) - materialBalance(ctx.fens[ctx.index], ctx.beneficiary)
}
function uciToMove(uci: string): { from: string; to: string; promotion?: string } {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined }
}

type Detector = (ctx: Ctx) => boolean

// ---- detectors (back_rank, fork here; rest registered in Task 4) ----
function backRank(ctx: Ctx): boolean {
  const after = new Chess(ctx.fens[ctx.index + 1])
  if (!after.isCheckmate()) return false
  const mated = after.turn() // the side just checkmated is to move
  const ksq = kingSquare(after, mated)
  if (!ksq) return false
  const backRankNum = mated === 'w' ? '1' : '8'
  return ksq[1] === backRankNum
}

function fork(ctx: Ctx): boolean {
  const after = new Chess(ctx.fens[ctx.index + 1])
  const mover = ctx.beneficiary
  const victim = mover === 'w' ? 'b' : 'w'
  const toSq = ctx.move.to
  const attackerVal = PIECE_VALUE[ctx.move.piece as PieceSymbol]
  let targets = 0
  for (const row of after.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== victim) continue
      const atks = after.attackers(sq.square as any, mover) as unknown as string[]
      if (!atks || !atks.includes(toSq)) continue
      const defended = (after.attackers(sq.square as any, victim) as unknown as string[]).length > 0
      if (sq.type === 'k' || pieceValue(sq.type) > attackerVal || !defended) targets++
    }
  }
  if (targets < 2) return false
  return beneficiaryGain(ctx, 2) >= 200
}

export const DETECTORS: Record<Motif, Detector> = {
  back_rank: backRank,
  fork,
  // discovered_attack, skewer, pin, trapped_piece added in Task 4:
  discovered_attack: () => false,
  skewer: () => false,
  pin: () => false,
  trapped_piece: () => false,
}

export function detectMotif(startFen: string, pv: string[]): MotifHit | null {
  if (!pv || pv.length === 0) return null
  const chess = new Chess(startFen)
  const beneficiary = chess.turn() as 'w' | 'b'
  const fens: string[] = [chess.fen()]
  const moves: any[] = []
  for (let i = 0; i < Math.min(pv.length, MAX_PLIES); i++) {
    let mv
    try { mv = chess.move(uciToMove(pv[i])) } catch { break }
    if (!mv) break
    moves.push(mv)
    fens.push(chess.fen())
  }
  for (let i = 0; i < moves.length; i++) {
    if (moves[i].color !== beneficiary) continue
    const ctx: Ctx = { fens, index: i, move: moves[i], beneficiary }
    for (const motif of MOTIFS) {
      if (DETECTORS[motif](ctx)) return { motif, ply: i }
    }
  }
  return null
}

// Export helpers and types for Task 4 (internal use via barrel or direct import)
export type { Ctx, Detector }
export { coords, dir, sameLine, firstPieceBeyond, kingSquare, pieceValue, materialBalance, beneficiaryGain, uciToMove }
