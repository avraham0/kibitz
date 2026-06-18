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

// ---- helpers added in Task 4 ----
function legalMovesFrom(chess: Chess, sq: string): any[] {
  return (chess.moves({ verbose: true }) as any[]).filter((m) => m.from === sq)
}
// after applying move m in position `fen`, is m.to attacked by `byColor`?
function landingAttacked(fen: string, m: any, byColor: 'w' | 'b'): boolean {
  const c = new Chess(fen)
  c.move({ from: m.from, to: m.to, promotion: m.promotion })
  return (c.attackers(m.to as any, byColor) as unknown as string[]).length > 0
}

// the front piece (king) moves next ply; beneficiary then captures the piece that was
// behind the front piece on the same line from `attackFrom`.
function skewerConfirm(ctx: Ctx, attackFrom: string, frontSq: string): boolean {
  const before = new Chess(ctx.fens[ctx.index + 1]) // before victim's reply
  const behind = firstPieceBeyond(before, attackFrom, frontSq)
  if (!behind) return false
  // find the beneficiary capture (ctx.index+2) landing on `behind.sq`
  const capIdx = ctx.index + 2
  const capFen = ctx.fens[capIdx]
  if (!capFen) return false
  // the move played at capIdx is moves[capIdx]; we only have fens, so check the square emptied/occupied
  const occupiedBefore = new Chess(ctx.fens[capIdx]).get(behind.sq as any)
  const occupiedAfter = ctx.fens[capIdx + 1] ? new Chess(ctx.fens[capIdx + 1]).get(behind.sq as any) : null
  // captured: behind square held a victim piece before and a beneficiary piece after
  return !!occupiedBefore && occupiedBefore.color !== ctx.beneficiary
      && !!occupiedAfter && occupiedAfter.color === ctx.beneficiary
}

function capturedLater(ctx: Ctx, sq: string): boolean {
  // true if `sq` (a victim piece now) is captured by the beneficiary at ply >= index+2
  for (let i = ctx.index + 2; i < ctx.fens.length - 1; i++) {
    const before = new Chess(ctx.fens[i]).get(sq as any)
    const afterFen = ctx.fens[i + 1]
    if (!afterFen) break
    const after = new Chess(afterFen).get(sq as any)
    if (before && before.color !== ctx.beneficiary && after && after.color === ctx.beneficiary) return true
    // if the victim piece left the square on its own, stop tracking
    if (!before || before.color === ctx.beneficiary) break
  }
  return false
}

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
  const attackerVal = pieceValue(ctx.move.piece)
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

function discoveredAttack(ctx: Ctx): boolean {
  const after = new Chess(ctx.fens[ctx.index + 1])
  if (!after.isCheck()) return false
  const mover = ctx.beneficiary
  const victim = mover === 'w' ? 'b' : 'w'
  const ksq = kingSquare(after, victim)
  const checkers = after.attackers(ksq as any, mover) as unknown as string[]
  for (const c of checkers) {
    if (c === ctx.move.to) continue // direct check by the moved piece, not discovered
    const p = after.get(c as any)
    if (p && (p.type === 'r' || p.type === 'b' || p.type === 'q')) {
      // the moved piece's origin must lie between the revealed checker and the king
      if (sameLine(c, ctx.move.from, ksq) && dir(c, ctx.move.from)?.df === dir(c, ksq)?.df
          && dir(c, ctx.move.from)?.dr === dir(c, ksq)?.dr) {
        return true
      }
    }
  }
  return false
}

function skewer(ctx: Ctx): boolean {
  const m = ctx.move
  if (!(m.piece === 'r' || m.piece === 'b' || m.piece === 'q')) return false
  const after = new Chess(ctx.fens[ctx.index + 1])
  const victim = ctx.beneficiary === 'w' ? 'b' : 'w'
  if (!after.isCheck()) return false
  const ksq = kingSquare(after, victim)
  if (!dir(m.to, ksq)) return false
  return skewerConfirm(ctx, m.to, ksq)
}

function pin(ctx: Ctx): boolean {
  const m = ctx.move
  if (!(m.piece === 'r' || m.piece === 'b' || m.piece === 'q')) return false
  const after = new Chess(ctx.fens[ctx.index + 1])
  const mover = ctx.beneficiary
  const victim = mover === 'w' ? 'b' : 'w'
  for (const row of after.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== victim) continue
      const atks = after.attackers(sq.square as any, mover) as unknown as string[]
      if (!atks.includes(m.to)) continue
      const behind = firstPieceBeyond(after, m.to, sq.square)
      if (!behind || behind.piece.color !== victim) continue
      if (behind.piece.type === 'k') return true
      if (pieceValue(behind.piece.type) > pieceValue(sq.type) && beneficiaryGain(ctx, 3) >= 200) return true
    }
  }
  return false
}

function trappedPiece(ctx: Ctx): boolean {
  const after = new Chess(ctx.fens[ctx.index + 1]) // victim to move
  const mover = ctx.beneficiary
  const victim = mover === 'w' ? 'b' : 'w'
  for (const row of after.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== victim || sq.type === 'k') continue
      const attacked = (after.attackers(sq.square as any, mover) as unknown as string[]).length > 0
      if (!attacked) continue
      const escapes = legalMovesFrom(after, sq.square)
      const hasSafe = escapes.some((e) => !landingAttacked(after.fen(), e, mover))
      if (hasSafe) continue
      // captured at least two plies after this move (owner had a move in between)
      // and the capture must win meaningful material
      if (capturedLater(ctx, sq.square) && beneficiaryGain(ctx, 4) >= 200) return true
    }
  }
  return false
}

export const DETECTORS: Record<Motif, Detector> = {
  back_rank: backRank,
  fork,
  discovered_attack: discoveredAttack,
  skewer,
  pin,
  trapped_piece: trappedPiece,
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
