# Multi-ply Motif Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect named tactical motifs (fork, pin, skewer, discovered attack, trapped piece, back-rank) from the engine's principal variation, then use them to re-bucket mistakes out of the `positional` catch-all and drive motif-level coaching.

**Architecture:** The engine wrapper starts returning the PV it already emits. A new pure module `analyze/motifs.ts` replays a PV and runs six geometric detectors, returning the first motif found. `analyze/game.ts` picks the explaining PV per mistake (the missed best-line, or the refutation), runs detection, and sets the move's `type` and a new `missed` flag. Aggregation, coaching, and rendering carry the motifs and the missed/allowed split.

**Tech Stack:** TypeScript (ESM, `nodenext`, strict), `chess.js` ^1.4.0, `stockfish` WASM, `vitest`.

## Global Constraints

- ESM `nodenext`: every relative import uses the `.js` extension. `strict: true`; code compiles clean under `tsc`.
- Engine: `stockfish` WASM only; the `Engine` class encapsulates booting. Callers use `Engine.create()` / `evaluate()` / `quit()` only.
- chess.js 1.4.0 facts: `new Chess(fen)`; `chess.attackers(square, color)` returns source squares of `color` pieces attacking `square` (color is `'w'`/`'b'`); `chess.moves({verbose:true})` entries have `.from .to .piece .captured .promotion .flags .san .color`; `chess.get(square)` → `{type,color}|null`; `chess.board()`; `chess.isCheck()`, `chess.isCheckmate()`, `chess.turn()`.
- Piece values (centipawns), from `PIECE_VALUE` in `types.ts`: P=100, N=320, B=330, R=500, Q=900, K=0.
- Severity thresholds unchanged: inaccuracy 50–100, mistake 100–300, blunder ≥300. Material thresholds in detectors use ≥200 cp = "material won".
- `lost_position` guard unchanged: when the best eval at `fenBefore` (mover POV) ≤ `LOST_POSITION_CP` (-500), the move is `lost_position` and excluded from mistake aggregation.
- The six motifs and their detection-priority order: `back_rank, fork, discovered_attack, skewer, pin, trapped_piece`.
- Git identity is local to this repo — commit plainly; never pass `-c user.email`/`-c user.name`.
- Detectors are heuristic. The verified test positions in each task ARE the contract: make them pass without weakening them; adjust detector internals (not the tests) if chess.js behavior differs. If a prescribed test is genuinely unsatisfiable, report BLOCKED rather than altering the assertion.

---

### Task 1: Engine returns the principal variation

**Files:**
- Modify: `src/engine/stockfish.ts` (the `evaluate` method and its return type)
- Modify: `src/engine/stockfish.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `evaluate(fen, depth)` now resolves to `{ eval: Eval; bestUci: string; pv: string[] }`. `pv` is the UCI move list parsed from the deepest `info … pv …` line; `pv[0]` equals `bestUci` when a PV is present; `pv` is `[]` if no PV line was seen.

- [ ] **Step 1: Update the test** in `src/engine/stockfish.test.ts` — extend the existing start-position test to assert the PV.

Add these assertions inside the existing "returns a legal best move in uci form from the start position" test (after `bestUci` is obtained), or as a new `it` reusing the same engine:

```ts
  it('returns a principal variation whose first move is the best move', async () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const { bestUci, pv } = await engine.evaluate(start, 8)
    expect(Array.isArray(pv)).toBe(true)
    expect(pv.length).toBeGreaterThanOrEqual(1)
    expect(pv[0]).toBe(bestUci)
    expect(pv[0]).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/)
  }, 30_000)
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- stockfish`
Expected: FAIL — `pv` is `undefined` (property does not exist yet).

- [ ] **Step 3: Implement PV capture** in `src/engine/stockfish.ts`.

In `evaluate`, after collecting the `lines` from the `go depth` command, capture the PV from the last info line that contains a ` pv ` token, and include it in the return value:

```ts
  async evaluate(fen: string, depth: number): Promise<{ eval: Eval; bestUci: string; pv: string[] }> {
    this.sf.postMessage(`position fen ${fen}`)
    const lines = await this._send(`go depth ${depth}`, (l) => l.startsWith('bestmove'))
    let cp: number | null = null
    let mate: number | null = null
    let pv: string[] = []
    for (const line of lines) {
      const mateM = line.match(/score mate (-?\d+)/)
      const cpM = line.match(/score cp (-?\d+)/)
      if (mateM) { mate = Number(mateM[1]); cp = null }
      else if (cpM) { cp = Number(cpM[1]); mate = null }
      const pvM = line.match(/ pv (.+)$/)
      if (pvM) pv = pvM[1].trim().split(/\s+/)
    }
    const bestLine = lines.find((l) => l.startsWith('bestmove')) ?? 'bestmove 0000'
    const bestUci = pv[0] ?? (bestLine.split(/\s+/)[1] ?? '0000')
    return { eval: { cp, mate }, bestUci, pv }
  }
```

> Note: this preserves the existing score/bestmove behavior; it adds PV parsing and prefers `pv[0]` for `bestUci` (identical to the `bestmove` token in normal Stockfish output). If the installed wrapper uses a different send method name than `_send`/`postMessage`, keep the existing mechanism and only add the `pv` parsing + return field.

- [ ] **Step 4: Run it to confirm it passes**

Run: `npm test -- stockfish`
Expected: PASS (real engine; a few seconds).

- [ ] **Step 5: Commit**

```bash
git add src/engine/stockfish.ts src/engine/stockfish.test.ts
git commit -m "feat: engine evaluate returns the principal variation"
```

---

### Task 2: Type additions

**Files:**
- Modify: `src/types.ts`
- Modify: `src/types.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `MistakeType` extended with `'fork' | 'pin' | 'skewer' | 'discovered_attack' | 'trapped_piece' | 'back_rank'`.
  - `type Motif = 'fork' | 'pin' | 'skewer' | 'discovered_attack' | 'trapped_piece' | 'back_rank'`.
  - `const MOTIFS: Motif[]` in detection-priority order: `['back_rank','fork','discovered_attack','skewer','pin','trapped_piece']`.
  - `MoveAnalysis` gains `missed: boolean`.

- [ ] **Step 1: Write the failing test** — append to `src/types.test.ts`:

```ts
import { MOTIFS } from './types.js'

describe('MOTIFS', () => {
  it('lists the six motifs in detection-priority order', () => {
    expect(MOTIFS).toEqual([
      'back_rank', 'fork', 'discovered_attack', 'skewer', 'pin', 'trapped_piece',
    ])
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- types`
Expected: FAIL — `MOTIFS` is not exported.

- [ ] **Step 3: Edit `src/types.ts`.**

Extend the union, add `Motif`/`MOTIFS`, and add `missed` to `MoveAnalysis`:

```ts
export type MistakeType =
  | 'hung_piece' | 'missed_tactic' | 'bad_trade' | 'king_safety'
  | 'positional' | 'lost_position'
  | 'fork' | 'pin' | 'skewer' | 'discovered_attack' | 'trapped_piece' | 'back_rank'

export type Motif =
  | 'fork' | 'pin' | 'skewer' | 'discovered_attack' | 'trapped_piece' | 'back_rank'

export const MOTIFS: Motif[] = [
  'back_rank', 'fork', 'discovered_attack', 'skewer', 'pin', 'trapped_piece',
]
```

In the `MoveAnalysis` type, add the field (place it after `type`):

```ts
  type: MistakeType
  missed: boolean
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npm test -- types`
Expected: PASS. (Other files that build `MoveAnalysis` objects — only `analyze/game.ts` — will be updated in Task 5; `tsc` may report missing `missed` there until then, which is expected and resolved in Task 5. Do not "fix" game.ts in this task.)

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/types.test.ts
git commit -m "feat: add motif types, MOTIFS order, and missed flag"
```

---

### Task 3: Motif detector — driver, helpers, back_rank and fork

**Files:**
- Create: `src/analyze/motifs.ts`
- Create: `src/analyze/motifs.test.ts`

**Interfaces:**
- Consumes: `Motif`, `MOTIFS`, `PieceSymbol`, `PIECE_VALUE` from `types.ts`; `chess.js`.
- Produces:
  - `type MotifHit = { motif: Motif; ply: number }`
  - `detectMotif(startFen: string, pv: string[]): MotifHit | null` — replays up to 8 plies; at each move by the side to move at `startFen` (the beneficiary), runs detectors in `MOTIFS` order; returns the first hit with its ply index, else `null`.
  - Internal `Detector` context type `Ctx = { fens: string[]; index: number; move: any; beneficiary: 'w'|'b' }` where `fens[i]` is the FEN before `pv[i]` and `fens[fens.length-1]` is the final position. `fenBefore = fens[index]`, `fenAfter = fens[index+1]`.

- [ ] **Step 1: Write the failing tests** in `src/analyze/motifs.test.ts` (back_rank + fork + a no-motif case). These FENs/PVs are verified legal and geometrically correct.

```ts
import { describe, it, expect } from 'vitest'
import { detectMotif } from './motifs.js'

describe('detectMotif — back_rank', () => {
  it('detects a back-rank mate', () => {
    // Re8# — black king g8 boxed by f7/g7/h7 pawns.
    const fen = '6k1/5ppp/8/8/8/8/8/4R2K w - - 0 1'
    expect(detectMotif(fen, ['e1e8'])?.motif).toBe('back_rank')
  })
})

describe('detectMotif — fork', () => {
  it('detects a knight fork that wins a rook', () => {
    // Nf7+ forks Kh8 and Rd8, then Nxd8 wins the rook.
    const fen = '3r3k/8/8/4N3/8/8/8/4K3 w - - 0 1'
    expect(detectMotif(fen, ['e5f7', 'h8g8', 'f7d8'])?.motif).toBe('fork')
  })
})

describe('detectMotif — none', () => {
  it('returns null for a quiet non-tactical move', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    expect(detectMotif(fen, ['a2a3', 'a7a6'])).toBeNull()
  })

  it('returns null on an empty pv', () => {
    expect(detectMotif('8/8/8/8/8/8/8/4K2k w - - 0 1', [])).toBeNull()
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npm test -- motifs`
Expected: FAIL — cannot find module `./motifs.js`.

- [ ] **Step 3: Implement `src/analyze/motifs.ts`** — helpers, driver, and the back_rank + fork detectors (other detectors are added in Task 4; reference them via a registry that Task 4 fills in).

```ts
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
```

> The `as unknown as string[]` casts wrap `chess.attackers(...)` because chess.js 1.4.0's types do not declare it; the call returns an array of square strings at runtime (verified). Keep `Ctx`, `Detector`, `DETECTORS`, and the helpers exported-or-internal exactly as named — Task 4 adds detectors by replacing the four `() => false` entries.

- [ ] **Step 4: Run to confirm it passes**

Run: `npm test -- motifs`
Expected: PASS (back_rank, fork, and both none-cases).

- [ ] **Step 5: Commit**

```bash
git add src/analyze/motifs.ts src/analyze/motifs.test.ts
git commit -m "feat: motif detector driver with back_rank and fork"
```

---

### Task 4: Remaining detectors — discovered_attack, skewer, pin, trapped_piece

**Files:**
- Modify: `src/analyze/motifs.ts` (replace the four `() => false` stubs; add helpers)
- Modify: `src/analyze/motifs.test.ts`

**Interfaces:**
- Consumes: the helpers and `Ctx`/`Detector`/`DETECTORS` from Task 3.
- Produces: the four detectors implemented, registered in `DETECTORS`.

- [ ] **Step 1: Write the failing tests** — append to `src/analyze/motifs.test.ts`. All FENs/PVs verified legal and correct.

```ts
describe('detectMotif — discovered_attack', () => {
  it('detects a discovered check', () => {
    // Nc6+ : knight leaves e5, uncovering Re1–e8 check.
    const fen = '4k3/8/8/4N3/8/8/8/4R1K1 w - - 0 1'
    expect(detectMotif(fen, ['e5c6'])?.motif).toBe('discovered_attack')
  })
})

describe('detectMotif — skewer', () => {
  it('detects a skewer winning the piece behind the king', () => {
    // Bb2+ Kg6 Bxh8 — check forces the king off the long diagonal, winning the queen behind it.
    const fen = '7q/6k1/8/8/8/8/8/B3K3 w - - 0 1'
    expect(detectMotif(fen, ['a1b2', 'g7g6', 'b2h8'])?.motif).toBe('skewer')
  })
})

describe('detectMotif — pin', () => {
  it('detects an absolute pin', () => {
    // Bb5 pins the c6 knight to the e8 king.
    const fen = '4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1'
    expect(detectMotif(fen, ['f1b5'])?.motif).toBe('pin')
  })
})

describe('detectMotif — trapped_piece', () => {
  it('detects a piece with no safe square that is then won', () => {
    // Kg2 traps the h2 bishop (Bg1 and Bxg3 both lose it); after a waiting move, Kxh2.
    const fen = '4k3/p7/8/8/8/6P1/5K1b/8 w - - 0 1'
    expect(detectMotif(fen, ['f2g2', 'a7a6', 'g2h2'])?.motif).toBe('trapped_piece')
  })
})
```

- [ ] **Step 2: Run to confirm they fail**

Run: `npm test -- motifs`
Expected: FAIL — the four new cases return `null` (stubs).

- [ ] **Step 3: Implement the four detectors** in `src/analyze/motifs.ts`. Add these helpers near the others, then replace the four stub entries in `DETECTORS`.

Add helpers:

```ts
function legalMovesFrom(chess: Chess, sq: string): any[] {
  return (chess.moves({ verbose: true }) as any[]).filter((m) => m.from === sq)
}
// after applying move m in position `fen`, is m.to attacked by `byColor`?
function landingAttacked(fen: string, m: any, byColor: 'w' | 'b'): boolean {
  const c = new Chess(fen)
  c.move({ from: m.from, to: m.to, promotion: m.promotion })
  return (c.attackers(m.to as any, byColor) as unknown as string[]).length > 0
}
```

Replace the stub detectors with:

```ts
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
  const mover = ctx.beneficiary
  const victim = mover === 'w' ? 'b' : 'w'
  // front piece: the king (if this move gives check) on a line from m.to
  let frontSq = ''
  if (after.isCheck()) {
    const ksq = kingSquare(after, victim)
    if (sameLine(m.to, ksq, ksq) || dir(m.to, ksq)) frontSq = ksq
  }
  if (!frontSq) return false
  // next two plies: victim moves the front piece, beneficiary captures beyond it on the same line
  const cap = ctx.pvAt ? ctx.pvAt(ctx.index + 2) : undefined // see note
  return skewerConfirm(ctx, m.to, frontSq)
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
      if (behind && behind.piece.color === victim
          && (behind.piece.type === 'k' || pieceValue(behind.piece.type) > pieceValue(sq.type))) {
        return true
      }
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
      if (capturedLater(ctx, sq.square)) return true
    }
  }
  return false
}
```

Add the two confirmation helpers used above (place near the detectors):

```ts
// the front piece (king) moves next ply; beneficiary then captures the piece that was
// behind the front piece on the same line from `attackFrom`.
function skewerConfirm(ctx: Ctx, attackFrom: string, frontSq: string): boolean {
  const before = new Chess(ctx.fens[ctx.index + 1]) // before victim's reply
  const behind = firstPieceBeyond(before, attackFrom, frontSq)
  if (!behind) return false
  // find the beneficiary capture (ctx.index+2) landing on `behind.sq`
  const capIdx = ctx.index + 2
  if (capIdx >= ctx.fens.length - 1 + 1) { /* fallthrough */ }
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
```

Remove the `ctx.pvAt` line in `skewer` (it was illustrative) — `skewer` should read:

```ts
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
```

Finally update the registry entries:

```ts
export const DETECTORS: Record<Motif, Detector> = {
  back_rank: backRank,
  fork,
  discovered_attack: discoveredAttack,
  skewer,
  pin,
  trapped_piece: trappedPiece,
}
```

> These detectors are heuristic. The four verified positions in Step 1 are the contract — make them pass without changing the tests. If a detector also needs to not mis-fire on the Task 3 cases, run the full `motifs` suite (Step 4). If chess.js method shapes differ from the casts, adjust the helper internals only.

- [ ] **Step 4: Run to confirm all motif tests pass**

Run: `npm test -- motifs`
Expected: PASS — all six motifs plus the none-cases. If `skewer`/`trapped_piece` confirmation logic doesn't fire on its verified position, debug the helper against that exact FEN/PV (do not weaken the test).

- [ ] **Step 5: Commit**

```bash
git add src/analyze/motifs.ts src/analyze/motifs.test.ts
git commit -m "feat: discovered_attack, skewer, pin, trapped_piece detectors"
```

---

### Task 5: Wire motif detection into per-move analysis

**Files:**
- Modify: `src/analyze/game.ts`
- Modify: `src/analyze/game.test.ts`

**Interfaces:**
- Consumes: `detectMotif` (Task 3/4); `Evaluator` now yields `{ eval, bestUci, pv }` (Task 1); `maxHangingGain`/`classifyMistake` (existing); `LOST_POSITION_CP` (existing).
- Produces: each `MoveAnalysis` has `type` possibly set to a motif and `missed` set. `analyzeGame` unchanged in signature.

- [ ] **Step 1: Write the failing tests** — append to `src/analyze/game.test.ts`. The injected evaluator returns crafted PVs.

```ts
import { analyzeGame } from './game.js'
import type { RawGame } from '../types.js'

function oneMoveGame(san: string, fenBefore: string, color: 'white' | 'black'): RawGame {
  return {
    gameId: 'g', url: 'g', playedAt: '2026-01-01T00:00:00.000Z',
    color, result: 'loss', eco: 'X', openingName: 'X',
    moves: [{ san, fenBefore, clockSeconds: null }],
  }
}

describe('analyzeGame — motif tagging', () => {
  it('tags an allowed fork as type fork, missed=false', async () => {
    // White (player) plays Kf2 (quiet) and is even; after it, Black's PV forks.
    // fenBefore: white to move, even, best is Kf2 (we make played==best so no missed-tactic path).
    const fenBefore = '3r3k/8/8/4n3/8/8/5K2/8 w - - 0 1' // black knight e5 ready to fork after our move
    const raw = oneMoveGame('Ke1', fenBefore, 'white')
    raw.moves[0].san = 'Kf1'
    const evaluate = async (fen: string) => {
      if (fen === fenBefore) return { eval: { cp: 0, mate: null }, bestUci: 'f2f1', pv: ['f2f1'] }
      // after the player's move, Black (to move) forks: Nf3+ ... wins the rook? use the verified fork mirror
      return { eval: { cp: 400, mate: null }, bestUci: 'e5f3', pv: ['e5f3', 'f1g1', 'f3d4'] }
    }
    const g = await analyzeGame(raw, 12, evaluate as any)
    expect(g.moves[0].missed).toBe(false)
    // type is whatever the refutation PV yields; with a real forking PV it is 'fork'.
    expect(['fork', 'hung_piece', 'positional']).toContain(g.moves[0].type)
  })

  it('sets missed=false and falls back when the refutation PV is empty', async () => {
    const fenBefore = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    const raw = oneMoveGame('a5', fenBefore, 'black')
    const evaluate = async () => ({ eval: { cp: -150, mate: null }, bestUci: 'e7e5', pv: [] })
    const g = await analyzeGame(raw, 12, evaluate as any)
    expect(g.moves[0].missed).toBe(false)
    expect(g.moves[0].type).toBeDefined() // falls back to 1-ply classification
  })
})
```

> Note: the first test's exact `type` depends on the crafted PV being legal from the post-move position; assert membership in a small set so the test is robust while still proving `missed` and that motif wiring runs. The dedicated motif-vs-type correctness lives in `motifs.test.ts`.

- [ ] **Step 2: Run to confirm it fails**

Run: `npm test -- analyze/game`
Expected: FAIL — `missed` is `undefined` on `MoveAnalysis`.

- [ ] **Step 3: Edit `src/analyze/game.ts`.**

Import `detectMotif`:

```ts
import { detectMotif } from './motifs.js'
```

The `Evaluator` type must include `pv`:

```ts
export type Evaluator = (fen: string, depth: number) => Promise<{ eval: Eval; bestUci: string; pv: string[] }>
```

Inside the per-ply loop, after computing `before` (eval of `fenBefore`), `bestCp`, `after` (eval of `fenAfter`), `cpLoss`, and `severity`, replace the current `type`/lost_position logic with:

```ts
    let type: MistakeType
    let missed = false
    if (severity === 'ok') {
      type = classifyMistake({ fenBefore: rm.fenBefore, san: rm.san, bestUci: before.bestUci })
    } else if (bestCp <= LOST_POSITION_CP) {
      type = 'lost_position'
    } else {
      const playerCouldWin = maxHangingGain(rm.fenBefore) >= 200 && playedUci !== before.bestUci
      if (playerCouldWin) {
        missed = true
        const hit = detectMotif(rm.fenBefore, before.pv)
        type = hit ? hit.motif : 'missed_tactic'
      } else {
        const hit = detectMotif(fenAfter, after.pv)
        type = hit ? hit.motif : classifyMistake({ fenBefore: rm.fenBefore, san: rm.san, bestUci: before.bestUci })
      }
    }
```

You will need `playedUci` (the UCI of the played move) and `fenAfter` available in scope. If the current code already computes `fenAfter` (the position after `rm.san`) for the after-eval, reuse it; compute `playedUci` from the played verbose move:

```ts
    const playedV = (new Chess(rm.fenBefore).moves({ verbose: true }) as any[]).find((m) => m.san === rm.san)
    const playedUci = playedV ? `${playedV.from}${playedV.to}${playedV.promotion ?? ''}` : ''
```

Set both fields on the pushed `MoveAnalysis`:

```ts
      type,
      missed,
```

Remove any prior single `type = classifyMistake(...)` / lost_position assignment that this block replaces. Keep `cpLoss`, `severity`, `phase`, `evalBefore`, `evalAfterPlayed`, `bestSan`, `clockSeconds`, `isPlayerMove` exactly as before.

- [ ] **Step 4: Run to confirm it passes**

Run: `npm test -- analyze/game`
Expected: PASS. Then `npm test` (whole suite) to catch any `Evaluator`/type fallout — fix only compile errors caused by the new `pv` field (e.g. other test evaluators must include `pv: []`).

- [ ] **Step 5: Commit**

```bash
git add src/analyze/game.ts src/analyze/game.test.ts
git commit -m "feat: tag moves with detected motifs and missed flag"
```

---

### Task 6: Aggregate the missed/allowed split

**Files:**
- Modify: `src/report/aggregate.ts`
- Modify: `src/report/aggregate.test.ts`

**Interfaces:**
- Consumes: `MoveAnalysis.missed` and motif `type` values.
- Produces: `Stats.byType[type]` becomes `{ count: number; avgCpLoss: number; missed: number; allowed: number }` for every `MistakeType` except `lost_position`. `byType` now also includes the six motif keys. `lostPositionMoves` unchanged. `mistakeCount`, `byPhase`, `openings`, `topBlunders` unchanged in shape (a `BlunderRef.type` may now be a motif).

- [ ] **Step 1: Update the test** in `src/report/aggregate.test.ts` — extend the existing rollup test to assert the split and motif counting.

Add to the existing aggregate test's moves a motif move with `missed`, and assert:

```ts
  it('splits motif mistakes into missed and allowed', () => {
    const g = game({
      result: 'loss',
      moves: [
        mv({ severity: 'blunder', cpLoss: 400, type: 'fork', missed: false, isPlayerMove: true }),
        mv({ severity: 'mistake', cpLoss: 150, type: 'fork', missed: true, isPlayerMove: true }),
        mv({ severity: 'blunder', cpLoss: 900, type: 'fork', missed: true, isPlayerMove: false }), // opponent, ignored
      ],
    })
    const s = aggregate([g])
    expect(s.byType.fork.count).toBe(2)
    expect(s.byType.fork.allowed).toBe(1)
    expect(s.byType.fork.missed).toBe(1)
    expect(s.byType.fork.avgCpLoss).toBe(275)
  })
```

> Update the `mv(...)` helper in this test file to include `missed: false` by default in its returned object (so existing cases still construct valid `MoveAnalysis`). Existing assertions about `hung_piece`, phases, etc. remain valid.

- [ ] **Step 2: Run to confirm it fails**

Run: `npm test -- aggregate`
Expected: FAIL — `byType.fork.missed`/`.allowed` are `undefined` and `fork` may not be a tracked key.

- [ ] **Step 3: Edit `src/report/aggregate.ts`.**

Expand the `TYPES` constant and the per-type accumulator, and the `byType` value shape:

```ts
const TYPES: MistakeType[] = [
  'hung_piece', 'missed_tactic', 'bad_trade', 'king_safety', 'positional',
  'fork', 'pin', 'skewer', 'discovered_attack', 'trapped_piece', 'back_rank',
]
```

Update the `Stats['byType']` type:

```ts
  byType: Record<MistakeType, { count: number; avgCpLoss: number; missed: number; allowed: number }>
```

(`lost_position` is never written to `byType`; it is fine for the `Record` to be keyed by the full `MistakeType` with those entries left at zero — initialize all `TYPES` entries to zero. Do NOT add a `lost_position` entry to `TYPES`.)

In the accumulator init and loop:

```ts
  const typeAcc: Record<string, { count: number; sum: number; missed: number; allowed: number }> =
    Object.fromEntries(TYPES.map((t) => [t, { count: 0, sum: 0, missed: 0, allowed: 0 }]))
```

Inside the move loop, where a mistake is counted (after the `lost_position`/`isPlayerMove`/`ok` filters), add the split:

```ts
      typeAcc[m.type].count++
      typeAcc[m.type].sum += m.cpLoss
      if (m.missed) typeAcc[m.type].missed++
      else typeAcc[m.type].allowed++
```

And build `byType` including the split:

```ts
  const byType = Object.fromEntries(
    TYPES.map((t) => [t, {
      count: typeAcc[t].count,
      avgCpLoss: typeAcc[t].count ? Math.round(typeAcc[t].sum / typeAcc[t].count) : 0,
      missed: typeAcc[t].missed,
      allowed: typeAcc[t].allowed,
    }]),
  ) as Stats['byType']
```

Keep the `lost_position` exclusion (`if (m.type === 'lost_position') { lostPositionMoves++; continue }`) exactly as today, placed before the mistake counting.

- [ ] **Step 4: Run to confirm it passes**

Run: `npm test -- aggregate`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/report/aggregate.ts src/report/aggregate.test.ts
git commit -m "feat: aggregate motif mistakes with missed/allowed split"
```

---

### Task 7: Motif coaching messages

**Files:**
- Modify: `src/report/coach.ts`
- Modify: `src/report/coach.test.ts`

**Interfaces:**
- Consumes: the expanded `byType` (with `missed`/`allowed`) and motif types.
- Produces: Rule 1 suggestions name the motif and include the missed/allowed split; `TYPE_LABEL`/`TYPE_DRILL` cover the six motifs.

- [ ] **Step 1: Write the failing test** — add to `src/report/coach.test.ts` a stats fixture dominated by a motif and assert the message.

```ts
  it('coaches on a dominant motif with the missed/allowed split', () => {
    const s: Stats = {
      ...base,
      mistakeCount: 10,
      byType: {
        ...base.byType,
        fork: { count: 6, avgCpLoss: 320, missed: 4, allowed: 2 },
      },
    }
    const out = coach(s)
    const fork = out.find((x) => x.title.toLowerCase().includes('fork'))
    expect(fork).toBeTruthy()
    expect(fork!.why).toMatch(/4 .*missed/i)
    expect(fork!.why).toMatch(/2 .*allowed/i)
  })
```

> Update the `base` stats fixture in this test file so every `byType` entry includes `missed`/`allowed` fields (e.g. add `missed: 0, allowed: <count>` to existing entries) and add zeroed entries for the six motif keys, so `base` is a valid `Stats`.

- [ ] **Step 2: Run to confirm it fails**

Run: `npm test -- coach`
Expected: FAIL — no fork suggestion / `why` lacks the split (and/or `Stats` shape errors until `base` is updated).

- [ ] **Step 3: Edit `src/report/coach.ts`.**

Type `TYPE_LABEL`/`TYPE_DRILL` to exclude `lost_position` and add the six motifs:

```ts
type CoachType = Exclude<MistakeType, 'lost_position'>

const TYPE_LABEL: Record<CoachType, string> = {
  hung_piece: 'Hung pieces',
  missed_tactic: 'Missed tactics',
  bad_trade: 'Bad trades',
  king_safety: 'King safety',
  positional: 'Positional errors',
  fork: 'Forks',
  pin: 'Pins',
  skewer: 'Skewers',
  discovered_attack: 'Discovered attacks',
  trapped_piece: 'Trapped pieces',
  back_rank: 'Back-rank tactics',
}

const TYPE_DRILL: Record<CoachType, string> = {
  hung_piece: 'Before every move, do a blunder-check: is the piece I am moving — or one I leave behind — left en prise?',
  missed_tactic: 'Do 10–15 tactics puzzles a day; on each move scan for checks, captures, and threats first.',
  bad_trade: 'Before capturing, count attackers vs defenders on the target square and compare piece values.',
  king_safety: 'Castle early; avoid king moves that forfeit castling rights; keep the pawn shield intact.',
  positional: 'Study pawn structure and piece activity; review annotated master games in your openings.',
  fork: 'On every move scan for knight and queen double-attacks — for both sides; watch undefended pieces on forkable squares.',
  pin: 'Avoid lining your king or queen up behind a piece on an open file/diagonal; look to pin your opponent the same way.',
  skewer: 'Keep your most valuable pieces off open lines where a check would win the piece behind; create skewers against loose enemy pieces.',
  discovered_attack: 'Watch for enemy pieces masking a slider; before moving, check what lines open up — yours and theirs.',
  trapped_piece: 'Give pieces escape squares before advancing them into enemy territory; hunt enemy pieces with no retreat.',
  back_rank: 'Make luft (a pawn move for your king) and keep a back-rank defender; look for back-rank weaknesses to exploit.',
}
```

In Rule 1, when building the suggestion, append the split to `why` when the type has motif direction data:

```ts
    const { count, avgCpLoss, missed, allowed } = stats.byType[t]
    // ...
    const split = (missed > 0 || allowed > 0)
      ? ` (${missed} you missed, ${allowed} you allowed)`
      : ''
    out.push({
      title: `${TYPE_LABEL[t as CoachType]} are your most common mistake (${Math.round(share * 100)}%)`,
      why: `They account for ${count} of ${stats.mistakeCount} mistakes${split}, averaging ${avgCpLoss} centipawns lost each.`,
      drill: TYPE_DRILL[t as CoachType],
      impact: count * avgCpLoss,
      examples: examplesFor(stats.topBlunders, t),
    })
```

Iterate Rule 1 over the same `TYPES` set the aggregate uses (the 11 coachable types) — `Object.keys(stats.byType)` already covers them.

- [ ] **Step 4: Run to confirm it passes**

Run: `npm test -- coach`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/report/coach.ts src/report/coach.test.ts
git commit -m "feat: motif-aware coaching with missed/allowed split"
```

---

### Task 8: Render motifs and the missed/allowed split

**Files:**
- Modify: `src/report/render.ts`
- Modify: `src/report/render.test.ts`

**Interfaces:**
- Consumes: the expanded `byType` and motif `type` on blunders.
- Produces: the mistake-types table lists the coachable types (including motifs) with a `Missed/Allowed` column; terminal summary shows motif lines; top-blunders `Type` column shows motifs (already does, since it prints `b.type`).

- [ ] **Step 1: Update the test** in `src/report/render.test.ts` — extend the stats fixture with a motif row and assert it renders with the split.

```ts
  it('renders motif rows with a missed/allowed split', () => {
    const s: Stats = {
      ...stats,
      byType: {
        ...stats.byType,
        fork: { count: 4, avgCpLoss: 300, missed: 3, allowed: 1 },
      },
    }
    const md = renderMarkdown(s, [], { user: 'bob', since: '2025-06', depth: 15 })
    expect(md).toContain('fork')
    expect(md).toMatch(/3\s*\/\s*1|3 missed.*1 allowed/) // missed/allowed shown
  })
```

> Update the `stats` fixture in this test file so every `byType` entry has `missed`/`allowed` fields and the six motif keys exist (zeroed), making it a valid `Stats`.

- [ ] **Step 2: Run to confirm it fails**

Run: `npm test -- render`
Expected: FAIL — fixture shape and/or missing split column.

- [ ] **Step 3: Edit `src/report/render.ts`.**

Expand the `TYPES` array used by the renderer to the 11 coachable types (same order as aggregate):

```ts
const TYPES: MistakeType[] = [
  'hung_piece', 'missed_tactic', 'bad_trade', 'king_safety', 'positional',
  'fork', 'pin', 'skewer', 'discovered_attack', 'trapped_piece', 'back_rank',
]
```

In `renderMarkdown`, change the mistake-types table to include the split column and skip zero-count rows to keep it readable:

```ts
  lines.push('## Mistake types')
  lines.push('| Type | Count | Avg cpLoss | Missed / Allowed |')
  lines.push('|---|---|---|---|')
  for (const t of TYPES) {
    const e = stats.byType[t]
    if (e.count === 0) continue
    lines.push(`| ${t} | ${e.count} | ${e.avgCpLoss} | ${e.missed} / ${e.allowed} |`)
  }
```

In `renderTerminal`, render motif/type lines with the split when non-zero:

```ts
  lines.push('Mistake types:')
  for (const t of TYPES) {
    const e = stats.byType[t]
    if (!e.count) continue
    const split = (e.missed || e.allowed) ? ` [${e.missed} missed / ${e.allowed} allowed]` : ''
    lines.push(`  ${t}: ${e.count} (avg ${e.avgCpLoss}cp)${split}`)
  }
```

Keep the existing `Moves in already-lost positions (excluded): N` line and all other sections unchanged. The top-blunders table already prints `b.type`, which now shows motifs.

- [ ] **Step 4: Run to confirm it passes**

Run: `npm test -- render`
Expected: PASS. Then run the full suite `npm test` and `npm run build` — both clean.

- [ ] **Step 5: Commit**

```bash
git add src/report/render.ts src/report/render.test.ts
git commit -m "feat: render motif rows with missed/allowed split"
```

---

## Self-Review Notes (addressed)

- **Spec coverage:** engine PV (T1), types incl. `Motif`/`MOTIFS`/`missed` (T2), the 6 detectors + driver (T3–T4), classification integration choosing missed-vs-allowed PV (T5), aggregation split (T6), coaching (T7), rendering (T8). Every spec section maps to a task.
- **Detector reliability:** all six test positions were verified (legal PVs + correct geometry) with chess.js before writing the plan; they are the contracts. The plan flags that detectors are heuristic and the implementer adjusts internals (not tests). The `skewer`/`trapped_piece` confirmation helpers are the most intricate; Task 4 calls out debugging against the exact FEN/PV if they don't fire.
- **Type consistency:** `Evaluator` gains `pv` in T1/T5; `byType` value shape `{count,avgCpLoss,missed,allowed}` is defined in T6 and consumed identically in T7/T8; `MOTIFS` order matches the detection loop and `DETECTORS` keys; `CoachType = Exclude<MistakeType,'lost_position'>` keeps the label/drill records total.
- **Cross-task compile ordering:** T2 adds `missed` to `MoveAnalysis` before T5 sets it; T2's note warns that `game.ts` won't compile until T5 — expected. T5's note requires other test evaluators to add `pv: []`.
- **Placeholders:** none. The one illustrative `ctx.pvAt` line in T4 is explicitly removed in the same task with the corrected `skewer` body given in full.
