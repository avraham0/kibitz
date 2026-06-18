# chess-coach CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A TypeScript CLI that downloads a chess.com player's games, analyzes them with Stockfish, and reports their most common mistakes with prioritized improvement suggestions.

**Architecture:** Ten focused modules wired by a thin `cli.ts`: fetch (chess.com API) → parse (PGN→Game) → analyze (engine eval + severity + type + phase, with on-disk cache) → aggregate → coach → render. Each module is a pure-ish unit with a small interface, unit-tested in isolation; only the engine wrapper and CLI touch I/O heavily.

**Tech Stack:** Node 24, TypeScript, `tsx` (dev runner), `vitest` (tests), `chess.js` (^1.0.0, move/FEN/attacker logic), `stockfish` (WASM engine), native `fetch` and `node:util` `parseArgs` (no extra arg-parsing dep).

## Global Constraints

- Language: TypeScript, target ES2022, module `nodenext`, `strict: true`.
- Runtime: Node 24. Use native `fetch`; no `axios`/`node-fetch`.
- CLI flags: `--user` (required), `--since YYYY-MM` (default 12 months ago), `--last N`, `--depth` (default 15), `--out` (optional, no default → terminal only).
- Engine source: `stockfish` npm WASM package only. No native binary, no `brew`.
- Severity thresholds (centipawn loss): inaccuracy 50–100, mistake 100–300, blunder ≥300.
- Cache path: `~/.chess-coach/cache/<user>/<gameId>-d<depth>.json`. Cache key includes depth.
- Mistake types: `hung_piece | missed_tactic | bad_trade | king_safety | positional`.
- Phases: `opening` (ply ≤ 24), `endgame` (≤ 7 pieces total OR queens off with ≤ 6 pieces), else `middlegame`.
- Git identity for this repo is already set local-only (`gabor <gabor@personal.email>`). Commit plainly; never pass `-c user.email`.
- All money/material values in centipawns; piece values: P=100, N=320, B=330, R=500, Q=900, K=0.

---

### Task 1: Project scaffold + core types

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/types.ts`, `src/types.test.ts`
- Create: `.gitignore` (already present from spec commit — verify it lists `node_modules/`, `dist/`)

**Interfaces:**
- Consumes: nothing.
- Produces: all shared types — `Eval`, `Severity`, `MistakeType`, `Phase`, `MoveAnalysis`, `GameAnalysis`, `RawGame`, plus `PIECE_VALUE` constant and `cpLossToSeverity(cpLoss: number): Severity`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "chess-coach",
  "version": "0.1.0",
  "type": "module",
  "bin": { "chess-coach": "dist/cli.js" },
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "chess.js": "^1.0.0",
    "stockfish": "^16.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": false,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
```

- [ ] **Step 4: Install deps**

Run: `npm install`
Expected: completes; `node_modules/` created.

- [ ] **Step 5: Write the failing test** in `src/types.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { cpLossToSeverity, PIECE_VALUE } from './types.js'

describe('cpLossToSeverity', () => {
  it('classifies by centipawn loss thresholds', () => {
    expect(cpLossToSeverity(0)).toBe('ok')
    expect(cpLossToSeverity(49)).toBe('ok')
    expect(cpLossToSeverity(50)).toBe('inaccuracy')
    expect(cpLossToSeverity(100)).toBe('mistake')
    expect(cpLossToSeverity(299)).toBe('mistake')
    expect(cpLossToSeverity(300)).toBe('blunder')
  })
})

describe('PIECE_VALUE', () => {
  it('uses standard centipawn values', () => {
    expect(PIECE_VALUE.q).toBe(900)
    expect(PIECE_VALUE.p).toBe(100)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- types`
Expected: FAIL — cannot find module `./types.js`.

- [ ] **Step 7: Write `src/types.ts`**

```ts
export type Color = 'white' | 'black'

export type Eval = { cp: number | null; mate: number | null }

export type Severity = 'ok' | 'inaccuracy' | 'mistake' | 'blunder'

export type MistakeType =
  | 'hung_piece' | 'missed_tactic' | 'bad_trade' | 'king_safety' | 'positional'

export type Phase = 'opening' | 'middlegame' | 'endgame'

export type PieceSymbol = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'

export const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 0,
}

export function cpLossToSeverity(cpLoss: number): Severity {
  if (cpLoss >= 300) return 'blunder'
  if (cpLoss >= 100) return 'mistake'
  if (cpLoss >= 50) return 'inaccuracy'
  return 'ok'
}

// One half-move parsed from a PGN, before any engine analysis.
export type RawMove = { san: string; fenBefore: string; clockSeconds: number | null }

// A single game parsed from chess.com, before engine analysis.
export type RawGame = {
  gameId: string
  url: string
  playedAt: string // ISO
  color: Color
  result: 'win' | 'loss' | 'draw'
  eco: string
  openingName: string
  moves: RawMove[] // only the player's-and-opponent's full move list
}

export type MoveAnalysis = {
  ply: number
  fenBefore: string
  san: string
  bestSan: string
  evalBefore: Eval
  evalAfterPlayed: Eval
  cpLoss: number
  severity: Severity
  type: MistakeType
  phase: Phase
  clockSeconds: number | null
  isPlayerMove: boolean // true if this move was made by the analyzed player
}

export type GameAnalysis = {
  gameId: string
  url: string
  playedAt: string
  color: Color
  result: 'win' | 'loss' | 'draw'
  eco: string
  openingName: string
  depth: number
  moves: MoveAnalysis[]
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- types`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts package-lock.json src/types.ts src/types.test.ts .gitignore
git commit -m "feat: scaffold project and core types"
```

---

### Task 2: chess.com API client

**Files:**
- Create: `src/api/chesscom.ts`, `src/api/chesscom.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `monthsSince(sinceYYYYMM: string, nowISO: string): string[]` → archive month suffixes like `["2025/06", ...]` inclusive of the current month.
  - `archiveUrls(user: string): Promise<string[]>` → all monthly archive URLs from the player index.
  - `fetchArchive(url: string): Promise<any[]>` → the `games` array (raw chess.com game objects, each with `.pgn`, `.url`, `.end_time`, `.white`, `.black`).
  - `fetchGamesSince(user: string, sinceYYYYMM: string, nowISO: string, fetchFn?): Promise<any[]>` → games across all matching archive months, oldest first.
  - All accept an injectable `fetchFn = fetch` for testing. On 404 throw `Error('Unknown chess.com user: <user>')`; on 429 retry with backoff (max 3 tries).

- [ ] **Step 1: Write the failing test** in `src/api/chesscom.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest'
import { monthsSince, fetchGamesSince } from './chesscom.js'

describe('monthsSince', () => {
  it('lists YYYY/MM from start through now inclusive', () => {
    expect(monthsSince('2025-11', '2026-01-15T00:00:00Z')).toEqual([
      '2025/11', '2025/12', '2026/01',
    ])
  })
  it('handles a single month', () => {
    expect(monthsSince('2026-01', '2026-01-15T00:00:00Z')).toEqual(['2026/01'])
  })
})

describe('fetchGamesSince', () => {
  it('only fetches archives within the window and concatenates games', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.endsWith('2026/01')) {
        return new Response(JSON.stringify({ games: [{ url: 'g1' }] }), { status: 200 })
      }
      return new Response(JSON.stringify({ games: [] }), { status: 200 })
    })
    const games = await fetchGamesSince('bob', '2026-01', '2026-01-10T00:00:00Z', fetchFn as any)
    expect(games).toEqual([{ url: 'g1' }])
    expect(fetchFn).toHaveBeenCalledWith('https://api.chess.com/pub/player/bob/games/2026/01')
  })

  it('throws a clear error on 404', async () => {
    const fetchFn = vi.fn(async () => new Response('', { status: 404 }))
    await expect(
      fetchGamesSince('nobody', '2026-01', '2026-01-10T00:00:00Z', fetchFn as any),
    ).rejects.toThrow('Unknown chess.com user: nobody')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- chesscom`
Expected: FAIL — cannot find module `./chesscom.js`.

- [ ] **Step 3: Write `src/api/chesscom.ts`**

```ts
type FetchFn = typeof fetch

const BASE = 'https://api.chess.com/pub/player'

export function monthsSince(sinceYYYYMM: string, nowISO: string): string[] {
  const [sy, sm] = sinceYYYYMM.split('-').map(Number)
  const now = new Date(nowISO)
  const ey = now.getUTCFullYear()
  const em = now.getUTCMonth() + 1
  const out: string[] = []
  let y = sy, m = sm
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}/${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}

async function getJson(url: string, fetchFn: FetchFn, user: string): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetchFn(url)
    if (res.status === 404) throw new Error(`Unknown chess.com user: ${user}`)
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      continue
    }
    if (!res.ok) throw new Error(`chess.com request failed (${res.status}): ${url}`)
    return res.json()
  }
  throw new Error(`chess.com rate-limited after retries: ${url}`)
}

export async function archiveUrls(user: string, fetchFn: FetchFn = fetch): Promise<string[]> {
  const data = await getJson(`${BASE}/${user}/games/archives`, fetchFn, user)
  return data.archives ?? []
}

export async function fetchArchive(url: string, fetchFn: FetchFn = fetch, user = ''): Promise<any[]> {
  const data = await getJson(url, fetchFn, user)
  return data.games ?? []
}

export async function fetchGamesSince(
  user: string,
  sinceYYYYMM: string,
  nowISO: string,
  fetchFn: FetchFn = fetch,
): Promise<any[]> {
  const wanted = new Set(monthsSince(sinceYYYYMM, nowISO))
  const all: any[] = []
  for (const ym of wanted) {
    const games = await fetchArchive(`${BASE}/${user}/games/${ym}`, fetchFn, user)
    all.push(...games)
  }
  return all
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- chesscom`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/chesscom.ts src/api/chesscom.test.ts
git commit -m "feat: chess.com API client with date-window fetch"
```

---

### Task 3: PGN parser

**Files:**
- Create: `src/pgn/parse.ts`, `src/pgn/parse.test.ts`

**Interfaces:**
- Consumes: `RawGame`, `RawMove`, `Color` from `types.ts`; a raw chess.com game object from Task 2.
- Produces: `parseGame(raw: any, user: string): RawGame | null` — returns `null` (caller skips) if the PGN is unparseable. Determines `color` by matching `user` (case-insensitive) against `raw.white.username` / `raw.black.username`; derives `result` from the player's POV; extracts `eco`, `openingName` (from `ECOUrl`/`Opening` headers, falling back to `'Unknown'`), `playedAt` from `raw.end_time` (unix seconds) as ISO; builds `moves[]` with `fenBefore` and `clockSeconds` (parsed from `%clk` comments, `null` if absent).

- [ ] **Step 1: Write the failing test** in `src/pgn/parse.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { parseGame } from './parse.js'

const PGN = `[Event "Live Chess"]
[White "alice"]
[Black "bob"]
[Result "0-1"]
[ECO "C50"]
[Opening "Italian Game"]

1. e4 {[%clk 0:03:00]} e5 {[%clk 0:02:58]} 2. Nf3 {[%clk 0:02:55]} Nc6 {[%clk 0:02:50]} 0-1`

const raw = {
  url: 'https://www.chess.com/game/live/123',
  end_time: 1_700_000_000,
  white: { username: 'alice' },
  black: { username: 'bob' },
  pgn: PGN,
}

describe('parseGame', () => {
  it('parses color, result, opening, and moves from the player POV', () => {
    const g = parseGame(raw, 'BOB')! // case-insensitive
    expect(g.color).toBe('black')
    expect(g.result).toBe('win') // bob is black, black won
    expect(g.eco).toBe('C50')
    expect(g.openingName).toBe('Italian Game')
    expect(g.gameId).toBe('https://www.chess.com/game/live/123')
    expect(g.moves.length).toBe(4)
    expect(g.moves[0].san).toBe('e4')
    expect(g.moves[0].fenBefore).toContain('rnbqkbnr/pppppppp')
    expect(g.moves[0].clockSeconds).toBe(180)
    expect(g.moves[1].clockSeconds).toBe(178)
  })

  it('returns null on malformed pgn', () => {
    expect(parseGame({ ...raw, pgn: 'not a real pgn @@@' }, 'bob')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- parse`
Expected: FAIL — cannot find module `./parse.js`.

- [ ] **Step 3: Write `src/pgn/parse.ts`**

```ts
import { Chess } from 'chess.js'
import type { RawGame, RawMove, Color } from '../types.js'

function clockToSeconds(comment: string | undefined): number | null {
  if (!comment) return null
  const m = comment.match(/\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/)
  if (!m) return null
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Math.floor(Number(m[3]))
}

export function parseGame(raw: any, user: string): RawGame | null {
  const chess = new Chess()
  try {
    chess.loadPgn(raw.pgn)
  } catch {
    return null
  }
  const u = user.toLowerCase()
  const whiteName = (raw.white?.username ?? '').toLowerCase()
  const blackName = (raw.black?.username ?? '').toLowerCase()
  let color: Color
  if (whiteName === u) color = 'white'
  else if (blackName === u) color = 'black'
  else return null

  const header = chess.header()
  const resultStr = header.Result ?? '*'
  let result: 'win' | 'loss' | 'draw' = 'draw'
  if (resultStr === '1-0') result = color === 'white' ? 'win' : 'loss'
  else if (resultStr === '0-1') result = color === 'black' ? 'win' : 'loss'

  // Replay to capture fenBefore and clocks per ply.
  const verbose = chess.history({ verbose: true }) as any[]
  const replay = new Chess()
  const moves: RawMove[] = []
  for (const mv of verbose) {
    moves.push({
      san: mv.san,
      fenBefore: replay.fen(),
      clockSeconds: clockToSeconds(mv.comment),
    })
    replay.move(mv.san)
  }

  return {
    gameId: raw.url,
    url: raw.url,
    playedAt: new Date((raw.end_time ?? 0) * 1000).toISOString(),
    color,
    result,
    eco: header.ECO ?? 'Unknown',
    openingName: header.Opening ?? 'Unknown',
    moves,
  }
}
```

> Note: if `chess.history({verbose}）` does not expose `.comment` in the installed chess.js version, parse clocks directly from the PGN movetext as a fallback — split on move tokens and pair each with the following `{...}` comment. Verify against the test before moving on; adjust the extraction to make the test pass without changing the test.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- parse`
Expected: PASS. If clock assertions fail, apply the fallback noted above.

- [ ] **Step 5: Commit**

```bash
git add src/pgn/parse.ts src/pgn/parse.test.ts
git commit -m "feat: PGN parser producing RawGame with clocks"
```

---

### Task 4: Stockfish engine wrapper

**Files:**
- Create: `src/engine/stockfish.ts`, `src/engine/stockfish.test.ts`

**Interfaces:**
- Consumes: `Eval` from `types.ts`.
- Produces: `class Engine` with:
  - `static async create(): Promise<Engine>` — boots the WASM engine, sends `uci`/`isready`.
  - `evaluate(fen: string, depth: number): Promise<{ eval: Eval; bestUci: string }>` — sets position, runs `go depth N`, returns score **from the side-to-move POV** and the best move in UCI (e.g. `e2e4`). Mate scores set `mate` and leave `cp: null`.
  - `quit(): void`.
- This task's test is an integration sanity check using the real WASM engine (no mock), kept to one or two positions at low depth.

- [ ] **Step 1: Write the failing test** in `src/engine/stockfish.test.ts`

```ts
import { describe, it, expect, afterAll } from 'vitest'
import { Engine } from './stockfish.js'

let engine: Engine

describe('Engine', () => {
  it('finds the mate-in-1 and reports a mate score', async () => {
    engine = await Engine.create()
    // White to move, Qh5xf7# style position: scholar's mate setup.
    const fen = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4'
    const { eval: ev } = await engine.evaluate(fen, 8)
    // Black is checkmated (side to move has been mated): score is a forced loss.
    expect(ev.mate !== null || (ev.cp !== null && ev.cp < -1000)).toBe(true)
  }, 30_000)

  it('returns a legal best move in uci form from the start position', async () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const { bestUci } = await engine.evaluate(start, 8)
    expect(bestUci).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/)
  }, 30_000)
})

afterAll(() => engine?.quit())
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- stockfish`
Expected: FAIL — cannot find module `./stockfish.js`.

- [ ] **Step 3: Write `src/engine/stockfish.ts`**

```ts
import type { Eval } from '../types.js'
// The stockfish WASM package exports a factory returning a worker-like object
// with postMessage(cmd) and an onmessage handler receiving UCI text lines.
// @ts-ignore - no bundled types
import StockfishFactory from 'stockfish'

type Listener = (line: string) => void

export class Engine {
  private sf: any
  private listeners: Listener[] = []

  private constructor(sf: any) {
    this.sf = sf
    this.sf.onmessage = (e: any) => {
      const line: string = typeof e === 'string' ? e : e?.data ?? ''
      for (const l of this.listeners) l(line)
    }
  }

  static async create(): Promise<Engine> {
    const sf = await Promise.resolve(StockfishFactory())
    const engine = new Engine(sf)
    await engine.send('uci', (l) => l.startsWith('uciok'))
    await engine.send('isready', (l) => l.startsWith('readyok'))
    return engine
  }

  private send(cmd: string, until: (line: string) => boolean): Promise<string[]> {
    return new Promise((resolve) => {
      const collected: string[] = []
      const listener: Listener = (line) => {
        collected.push(line)
        if (until(line)) {
          this.listeners = this.listeners.filter((x) => x !== listener)
          resolve(collected)
        }
      }
      this.listeners.push(listener)
      this.sf.postMessage(cmd)
    })
  }

  async evaluate(fen: string, depth: number): Promise<{ eval: Eval; bestUci: string }> {
    this.sf.postMessage(`position fen ${fen}`)
    const lines = await this.send(`go depth ${depth}`, (l) => l.startsWith('bestmove'))
    let cp: number | null = null
    let mate: number | null = null
    for (const line of lines) {
      const cpM = line.match(/score cp (-?\d+)/)
      const mateM = line.match(/score mate (-?\d+)/)
      if (mateM) { mate = Number(mateM[1]); cp = null }
      else if (cpM) { cp = Number(cpM[1]); mate = null }
    }
    const bestLine = lines.find((l) => l.startsWith('bestmove')) ?? 'bestmove 0000'
    const bestUci = bestLine.split(/\s+/)[1] ?? '0000'
    return { eval: { cp, mate }, bestUci }
  }

  quit(): void {
    try { this.sf.postMessage('quit') } catch { /* ignore */ }
  }
}
```

> Note: WASM packaging varies. If `StockfishFactory()` is not a function in the installed version, adapt the import to its actual entrypoint (some builds export `default`, some require `new Worker`). The contract the rest of the code depends on is only `Engine.create()` and `evaluate()`. Keep that contract; adjust internals until both tests pass.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- stockfish`
Expected: PASS (may take a few seconds per position).

- [ ] **Step 5: Commit**

```bash
git add src/engine/stockfish.ts src/engine/stockfish.test.ts
git commit -m "feat: stockfish WASM UCI wrapper"
```

---

### Task 5: Phase detection

**Files:**
- Create: `src/analyze/phase.ts`, `src/analyze/phase.test.ts`

**Interfaces:**
- Consumes: `Phase` from `types.ts`; `chess.js`.
- Produces: `detectPhase(fen: string, ply: number): Phase` — `opening` if `ply <= 24`; else `endgame` if total pieces ≤ 7 OR (no queens on board AND total pieces ≤ 12); else `middlegame`. `ply` is 1-based half-move count of the move being made.

- [ ] **Step 1: Write the failing test** in `src/analyze/phase.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { detectPhase } from './phase.js'

describe('detectPhase', () => {
  it('is opening for early plies regardless of material', () => {
    expect(detectPhase('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 1)).toBe('opening')
  })
  it('is endgame when few pieces remain', () => {
    // K+R vs K+R, late.
    expect(detectPhase('8/8/4k3/8/8/3K4/4R3/4r3 w - - 0 40', 60)).toBe('endgame')
  })
  it('is middlegame for a full board past the opening', () => {
    const fen = 'r2q1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 9'
    expect(detectPhase(fen, 30)).toBe('middlegame')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- phase`
Expected: FAIL — cannot find module `./phase.js`.

- [ ] **Step 3: Write `src/analyze/phase.ts`**

```ts
import { Chess } from 'chess.js'
import type { Phase } from '../types.js'

export function detectPhase(fen: string, ply: number): Phase {
  if (ply <= 24) return 'opening'
  const chess = new Chess(fen)
  const board = chess.board()
  let total = 0
  let queens = 0
  for (const row of board) {
    for (const sq of row) {
      if (!sq) continue
      total++
      if (sq.type === 'q') queens++
    }
  }
  if (total <= 7) return 'endgame'
  if (queens === 0 && total <= 12) return 'endgame'
  return 'middlegame'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- phase`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/analyze/phase.ts src/analyze/phase.test.ts
git commit -m "feat: game phase detection"
```

---

### Task 6: Mistake type classification

**Files:**
- Create: `src/analyze/classify.ts`, `src/analyze/classify.test.ts`

**Interfaces:**
- Consumes: `MistakeType`, `PieceSymbol`, `PIECE_VALUE` from `types.ts`; `chess.js` (uses `.attackers(square, color)`, `.get`, `.move`, `.board`, `.moveNumber`/castling rights via FEN).
- Produces:
  - `maxHangingGain(fen: string): number` — for the side **to move** in `fen`, the largest material (centipawns) it can win via a single capture on an enemy square, accounting for one recapture (simplified SEE: `victim - (defended ? cheapestAttacker : 0)`). Returns 0 if none positive.
  - `classifyMistake(input: { fenBefore: string; san: string; bestUci: string }): MistakeType` — applies, in priority order: `missed_tactic` (best move at `fenBefore` wins ≥200cp via `maxHangingGain` of the position the player was in, and the played move was not that best move), `hung_piece` (after playing `san`, the opponent's `maxHangingGain` ≥ 200), `bad_trade` (played `san` is a capture whose square has negative simplified SEE for the player), `king_safety` (played `san` forfeits castling rights the player still had, i.e. a king move that is not castling while castling rights existed), else `positional`.

- [ ] **Step 1: Write the failing test** in `src/analyze/classify.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { maxHangingGain, classifyMistake } from './classify.js'

describe('maxHangingGain', () => {
  it('detects a free undefended queen capture', () => {
    // White to move; black queen on d5 undefended, white bishop on g2 can take.
    const fen = '4k3/8/8/3q4/8/8/6B1/4K3 w - - 0 1'
    expect(maxHangingGain(fen)).toBe(900)
  })
  it('is zero when nothing hangs', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    expect(maxHangingGain(fen)).toBe(0)
  })
})

describe('classifyMistake', () => {
  it('flags hung_piece when the move leaves a piece free to take', () => {
    // White to move plays Bg2-b7?? hanging nothing here; construct a real hang:
    // White queen on d1 moves to d5 where black pawn c6 can capture for free.
    const fenBefore = 'rnbqkbnr/pp1ppppp/2p5/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const t = classifyMistake({ fenBefore, san: 'Qd5', bestUci: 'g1f3' })
    expect(t).toBe('hung_piece')
  })

  it('flags king_safety when a non-castling king move forfeits castling rights', () => {
    const fenBefore = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
    const t = classifyMistake({ fenBefore, san: 'Ke2', bestUci: 'g1f3' })
    expect(t).toBe('king_safety')
  })

  it('falls back to positional when no motif matches', () => {
    const fenBefore = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const t = classifyMistake({ fenBefore, san: 'a3', bestUci: 'e2e4' })
    expect(t).toBe('positional')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- classify`
Expected: FAIL — cannot find module `./classify.js`.

- [ ] **Step 3: Write `src/analyze/classify.ts`**

```ts
import { Chess } from 'chess.js'
import type { MistakeType, PieceSymbol } from '../types.js'
import { PIECE_VALUE } from '../types.js'

function cheapestAttackerValue(chess: Chess, square: string, color: 'w' | 'b'): number | null {
  // chess.attackers(square, color) → array of source squares of `color` attacking `square`.
  const srcs = (chess as any).attackers?.(square, color) as string[] | undefined
  if (!srcs || srcs.length === 0) return null
  let min = Infinity
  for (const s of srcs) {
    const p = chess.get(s as any)
    if (p) min = Math.min(min, PIECE_VALUE[p.type as PieceSymbol])
  }
  return min === Infinity ? null : min
}

// Largest single-capture material gain for the side to move (simplified SEE).
export function maxHangingGain(fen: string): number {
  const chess = new Chess(fen)
  const mover = chess.turn() // 'w' | 'b'
  const enemy = mover === 'w' ? 'b' : 'w'
  let best = 0
  const moves = chess.moves({ verbose: true }) as any[]
  for (const mv of moves) {
    if (!mv.captured) continue
    const victim = PIECE_VALUE[mv.captured as PieceSymbol]
    const defender = cheapestAttackerValue(chess, mv.to, enemy)
    const gain = defender === null ? victim : victim - PIECE_VALUE[mv.piece as PieceSymbol]
    best = Math.max(best, gain)
  }
  return Math.max(0, best)
}

function castlingRights(fen: string): string {
  return fen.split(' ')[2] ?? '-'
}

export function classifyMistake(input: {
  fenBefore: string
  san: string
  bestUci: string
}): MistakeType {
  const { fenBefore, san, bestUci } = input

  // missed_tactic: the player had a capture winning >= 200cp and did not play the engine best.
  const playerGain = maxHangingGain(fenBefore)
  const before = new Chess(fenBefore)
  const playedVerbose = (before.moves({ verbose: true }) as any[]).find((m) => m.san === san)
  const playedUci = playedVerbose ? `${playedVerbose.from}${playedVerbose.to}${playedVerbose.promotion ?? ''}` : ''
  if (playerGain >= 200 && playedUci !== bestUci) return 'missed_tactic'

  // Apply the played move to inspect the resulting position.
  const after = new Chess(fenBefore)
  try { after.move(san) } catch { return 'positional' }

  // hung_piece: opponent (now to move) can win >= 200cp.
  if (maxHangingGain(after.fen()) >= 200) return 'hung_piece'

  // bad_trade: played move was a capture with negative simplified SEE on its square.
  if (playedVerbose?.captured) {
    const enemy = before.turn() === 'w' ? 'b' : 'w'
    const recapture = cheapestAttackerValue(after, playedVerbose.to, enemy)
    const victim = PIECE_VALUE[playedVerbose.captured as PieceSymbol]
    const attacker = PIECE_VALUE[playedVerbose.piece as PieceSymbol]
    if (recapture !== null && victim - attacker < 0) return 'bad_trade'
  }

  // king_safety: a non-castling king move that forfeits still-available castling rights.
  const rightsBefore = castlingRights(fenBefore)
  const moverHadRights =
    before.turn() === 'w' ? /[KQ]/.test(rightsBefore) : /[kq]/.test(rightsBefore)
  const isKingMove = playedVerbose?.piece === 'k'
  const isCastle = playedVerbose?.flags?.includes('k') || playedVerbose?.flags?.includes('q')
  if (isKingMove && !isCastle && moverHadRights) return 'king_safety'

  return 'positional'
}
```

> Note: `maxHangingGain` is a deliberately simplified static-exchange heuristic, per the spec ("heuristics"). The tests pin the intended behavior; if `chess.attackers` has a different signature in the installed chess.js, adapt `cheapestAttackerValue` to make the tests pass without weakening them.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- classify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/analyze/classify.ts src/analyze/classify.test.ts
git commit -m "feat: mistake type classification heuristics"
```

---

### Task 7: Per-move game analysis

**Files:**
- Create: `src/analyze/game.ts`, `src/analyze/game.test.ts`

**Interfaces:**
- Consumes: `RawGame`, `GameAnalysis`, `MoveAnalysis`, `Eval`, `cpLossToSeverity` from `types.ts`; `Engine` from Task 4 (only its `evaluate` shape is needed — accept an injected `evaluator` for testing); `detectPhase` (Task 5); `classifyMistake` (Task 6); `chess.js` for SAN↔UCI and best-move SAN.
- Produces:
  - `type Evaluator = (fen: string, depth: number) => Promise<{ eval: Eval; bestUci: string }>`
  - `cpFromMoverPov(ev: Eval): number` — converts an `Eval` to a centipawn number from the side-to-move POV (mate = ±large, e.g. `mate>0 → 100000 - mate*100`, `mate<0 → -100000 - mate*100`).
  - `analyzeGame(raw: RawGame, depth: number, evaluate: Evaluator): Promise<GameAnalysis>` — for each ply: eval `fenBefore` (best line, mover POV) and eval the position after the played move (opponent POV; negate to mover POV); `cpLoss = max(0, bestCp - playedCp)`; `severity = cpLossToSeverity(cpLoss)`; `type` via `classifyMistake` (only meaningful when severity≠ok, but always computed); `phase` via `detectPhase`; `bestSan` derived from `bestUci`; `isPlayerMove` = the side to move matches `raw.color`.

- [ ] **Step 1: Write the failing test** in `src/analyze/game.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { analyzeGame, cpFromMoverPov } from './game.js'
import type { RawGame } from '../types.js'

describe('cpFromMoverPov', () => {
  it('maps cp directly and mate to large signed values', () => {
    expect(cpFromMoverPov({ cp: 35, mate: null })).toBe(35)
    expect(cpFromMoverPov({ cp: null, mate: 1 })).toBeGreaterThan(90000)
    expect(cpFromMoverPov({ cp: null, mate: -2 })).toBeLessThan(-90000)
  })
})

describe('analyzeGame', () => {
  it('computes cpLoss and severity per move using the injected evaluator', async () => {
    const raw: RawGame = {
      gameId: 'g', url: 'g', playedAt: '2026-01-01T00:00:00.000Z',
      color: 'white', result: 'loss', eco: 'C20', openingName: 'KP',
      moves: [
        { san: 'e4', fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', clockSeconds: 180 },
        { san: 'e5', fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', clockSeconds: 178 },
      ],
    }
    // Evaluator: first ply best is e4 (no loss); after e4 opponent eval small.
    const evaluate = async (fen: string) => {
      if (fen.includes(' w ')) return { eval: { cp: 30, mate: null }, bestUci: 'e2e4' }
      return { eval: { cp: 20, mate: null }, bestUci: 'e7e5' }
    }
    const g = await analyzeGame(raw, 12, evaluate as any)
    expect(g.moves).toHaveLength(2)
    expect(g.moves[0].cpLoss).toBeGreaterThanOrEqual(0)
    expect(g.moves[0].severity).toBeDefined()
    expect(g.moves[0].isPlayerMove).toBe(true)  // white move, player is white
    expect(g.moves[1].isPlayerMove).toBe(false) // black move
    expect(g.depth).toBe(12)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- analyze/game`
Expected: FAIL — cannot find module `./game.js`.

- [ ] **Step 3: Write `src/analyze/game.ts`**

```ts
import { Chess } from 'chess.js'
import type { RawGame, GameAnalysis, MoveAnalysis, Eval } from '../types.js'
import { cpLossToSeverity } from '../types.js'
import { detectPhase } from './phase.js'
import { classifyMistake } from './classify.js'

export type Evaluator = (fen: string, depth: number) => Promise<{ eval: Eval; bestUci: string }>

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

    const cpLoss = Math.max(0, bestCp - playedCpMoverPov)
    const severity = cpLossToSeverity(cpLoss)
    const type = classifyMistake({ fenBefore: rm.fenBefore, san: rm.san, bestUci: before.bestUci })

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- analyze/game`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/analyze/game.ts src/analyze/game.test.ts
git commit -m "feat: per-move game analysis with cpLoss and severity"
```

---

### Task 8: Cache store

**Files:**
- Create: `src/cache/store.ts`, `src/cache/store.test.ts`

**Interfaces:**
- Consumes: `GameAnalysis` from `types.ts`.
- Produces:
  - `cachePath(user: string, gameId: string, depth: number, root?: string): string` — `<root>/<user>/<sanitizedGameId>-d<depth>.json`; default root `~/.chess-coach/cache`; `gameId` sanitized by replacing non-alphanumerics with `_`.
  - `readCached(user, gameId, depth, root?): Promise<GameAnalysis | null>`
  - `writeCached(analysis: GameAnalysis, user: string, root?): Promise<void>` (creates dirs).

- [ ] **Step 1: Write the failing test** in `src/cache/store.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cachePath, readCached, writeCached } from './store.js'
import type { GameAnalysis } from '../types.js'

let root: string
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'cc-')) })

const sample: GameAnalysis = {
  gameId: 'https://chess.com/game/live/42', url: 'https://chess.com/game/live/42',
  playedAt: '2026-01-01T00:00:00.000Z', color: 'white', result: 'win',
  eco: 'C50', openingName: 'Italian', depth: 15, moves: [],
}

describe('cache store', () => {
  it('builds a depth-keyed sanitized path', () => {
    const p = cachePath('bob', 'https://chess.com/game/live/42', 15, root)
    expect(p).toBe(join(root, 'bob', 'https___chess_com_game_live_42-d15.json'))
  })

  it('returns null on miss, then round-trips after write', async () => {
    expect(await readCached('bob', sample.gameId, 15, root)).toBeNull()
    await writeCached(sample, 'bob', root)
    const got = await readCached('bob', sample.gameId, 15, root)
    expect(got?.gameId).toBe(sample.gameId)
    expect(got?.depth).toBe(15)
  })

  it('misses when depth differs', async () => {
    await writeCached(sample, 'bob', root)
    expect(await readCached('bob', sample.gameId, 12, root)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- store`
Expected: FAIL — cannot find module `./store.js`.

- [ ] **Step 3: Write `src/cache/store.ts`**

```ts
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import type { GameAnalysis } from '../types.js'

const DEFAULT_ROOT = join(homedir(), '.chess-coach', 'cache')

function sanitize(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '_')
}

export function cachePath(user: string, gameId: string, depth: number, root = DEFAULT_ROOT): string {
  return join(root, user, `${sanitize(gameId)}-d${depth}.json`)
}

export async function readCached(
  user: string, gameId: string, depth: number, root = DEFAULT_ROOT,
): Promise<GameAnalysis | null> {
  try {
    const txt = await readFile(cachePath(user, gameId, depth, root), 'utf8')
    return JSON.parse(txt) as GameAnalysis
  } catch {
    return null
  }
}

export async function writeCached(
  analysis: GameAnalysis, user: string, root = DEFAULT_ROOT,
): Promise<void> {
  const p = cachePath(user, analysis.gameId, analysis.depth, root)
  await mkdir(dirname(p), { recursive: true })
  await writeFile(p, JSON.stringify(analysis), 'utf8')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- store`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cache/store.ts src/cache/store.test.ts
git commit -m "feat: depth-keyed on-disk analysis cache"
```

---

### Task 9: Aggregation

**Files:**
- Create: `src/report/aggregate.ts`, `src/report/aggregate.test.ts`

**Interfaces:**
- Consumes: `GameAnalysis`, `MoveAnalysis`, `MistakeType`, `Phase` from `types.ts`.
- Produces: `aggregate(games: GameAnalysis[]): Stats` where

```ts
type BlunderRef = { url: string; ply: number; san: string; bestSan: string; fenBefore: string; cpLoss: number; type: MistakeType }
type OpeningStat = { eco: string; name: string; games: number; wins: number; winPct: number; avgMistakes: number }
type Stats = {
  gamesAnalyzed: number
  record: { wins: number; losses: number; draws: number }
  // counts consider only the player's own moves with severity != 'ok'
  mistakeCount: number
  byPhase: Record<Phase, number>
  byType: Record<MistakeType, { count: number; avgCpLoss: number }>
  openings: OpeningStat[] // sorted by games desc
  topBlunders: BlunderRef[] // player blunders, sorted by cpLoss desc, max 10
}
```

Only the player's own moves (`isPlayerMove === true`) with `severity !== 'ok'` count as mistakes.

- [ ] **Step 1: Write the failing test** in `src/report/aggregate.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { aggregate } from './aggregate.js'
import type { GameAnalysis, MoveAnalysis } from '../types.js'

function mv(p: Partial<MoveAnalysis>): MoveAnalysis {
  return {
    ply: 1, fenBefore: 'x', san: 'e4', bestSan: 'd4',
    evalBefore: { cp: 0, mate: null }, evalAfterPlayed: { cp: 0, mate: null },
    cpLoss: 0, severity: 'ok', type: 'positional', phase: 'middlegame',
    clockSeconds: null, isPlayerMove: true, ...p,
  }
}

const game = (over: Partial<GameAnalysis>): GameAnalysis => ({
  gameId: 'g', url: 'u', playedAt: '2026-01-01T00:00:00.000Z',
  color: 'white', result: 'win', eco: 'C50', openingName: 'Italian',
  depth: 15, moves: [], ...over,
})

describe('aggregate', () => {
  it('counts only player mistakes and rolls up phase/type/openings/blunders', () => {
    const g = game({
      result: 'loss',
      moves: [
        mv({ severity: 'blunder', cpLoss: 400, type: 'hung_piece', phase: 'middlegame', isPlayerMove: true, san: 'Qd5', bestSan: 'Nf3' }),
        mv({ severity: 'mistake', cpLoss: 150, type: 'hung_piece', phase: 'endgame', isPlayerMove: true }),
        mv({ severity: 'blunder', cpLoss: 999, type: 'missed_tactic', phase: 'middlegame', isPlayerMove: false }), // opponent, ignored
      ],
    })
    const s = aggregate([g])
    expect(s.gamesAnalyzed).toBe(1)
    expect(s.record).toEqual({ wins: 0, losses: 1, draws: 0 })
    expect(s.mistakeCount).toBe(2)
    expect(s.byPhase.middlegame).toBe(1)
    expect(s.byPhase.endgame).toBe(1)
    expect(s.byType.hung_piece.count).toBe(2)
    expect(s.byType.hung_piece.avgCpLoss).toBe(275)
    expect(s.openings[0]).toMatchObject({ eco: 'C50', games: 1, wins: 0 })
    expect(s.topBlunders[0].cpLoss).toBe(400) // only player blunders
    expect(s.topBlunders.every((b) => b.cpLoss >= 300)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- aggregate`
Expected: FAIL — cannot find module `./aggregate.js`.

- [ ] **Step 3: Write `src/report/aggregate.ts`**

```ts
import type { GameAnalysis, MistakeType, Phase } from '../types.js'

export type BlunderRef = {
  url: string; ply: number; san: string; bestSan: string
  fenBefore: string; cpLoss: number; type: MistakeType
}
export type OpeningStat = {
  eco: string; name: string; games: number; wins: number; winPct: number; avgMistakes: number
}
export type Stats = {
  gamesAnalyzed: number
  record: { wins: number; losses: number; draws: number }
  mistakeCount: number
  byPhase: Record<Phase, number>
  byType: Record<MistakeType, { count: number; avgCpLoss: number }>
  openings: OpeningStat[]
  topBlunders: BlunderRef[]
}

const TYPES: MistakeType[] = ['hung_piece', 'missed_tactic', 'bad_trade', 'king_safety', 'positional']

export function aggregate(games: GameAnalysis[]): Stats {
  const record = { wins: 0, losses: 0, draws: 0 }
  const byPhase: Record<Phase, number> = { opening: 0, middlegame: 0, endgame: 0 }
  const typeAcc: Record<MistakeType, { count: number; sum: number }> =
    Object.fromEntries(TYPES.map((t) => [t, { count: 0, sum: 0 }])) as any
  const openingMap = new Map<string, { eco: string; name: string; games: number; wins: number; mistakes: number }>()
  const blunders: BlunderRef[] = []
  let mistakeCount = 0

  for (const g of games) {
    if (g.result === 'win') record.wins++
    else if (g.result === 'loss') record.losses++
    else record.draws++

    const key = g.eco + '|' + g.openingName
    const o = openingMap.get(key) ?? { eco: g.eco, name: g.openingName, games: 0, wins: 0, mistakes: 0 }
    o.games++
    if (g.result === 'win') o.wins++

    for (const m of g.moves) {
      if (!m.isPlayerMove || m.severity === 'ok') continue
      mistakeCount++
      o.mistakes++
      byPhase[m.phase]++
      typeAcc[m.type].count++
      typeAcc[m.type].sum += m.cpLoss
      if (m.severity === 'blunder') {
        blunders.push({
          url: g.url, ply: m.ply, san: m.san, bestSan: m.bestSan,
          fenBefore: m.fenBefore, cpLoss: m.cpLoss, type: m.type,
        })
      }
    }
    openingMap.set(key, o)
  }

  const byType = Object.fromEntries(
    TYPES.map((t) => [t, {
      count: typeAcc[t].count,
      avgCpLoss: typeAcc[t].count ? Math.round(typeAcc[t].sum / typeAcc[t].count) : 0,
    }]),
  ) as Record<MistakeType, { count: number; avgCpLoss: number }>

  const openings: OpeningStat[] = [...openingMap.values()]
    .map((o) => ({
      eco: o.eco, name: o.name, games: o.games, wins: o.wins,
      winPct: o.games ? Math.round((o.wins / o.games) * 100) : 0,
      avgMistakes: o.games ? Math.round((o.mistakes / o.games) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.games - a.games)

  const topBlunders = blunders.sort((a, b) => b.cpLoss - a.cpLoss).slice(0, 10)

  return {
    gamesAnalyzed: games.length,
    record, mistakeCount, byPhase, byType, openings, topBlunders,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- aggregate`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/report/aggregate.ts src/report/aggregate.test.ts
git commit -m "feat: aggregate analysis into report stats"
```

---

### Task 10: Coaching rules

**Files:**
- Create: `src/report/coach.ts`, `src/report/coach.test.ts`

**Interfaces:**
- Consumes: `Stats`, `BlunderRef` from Task 9; `MistakeType`, `Phase` from `types.ts`.
- Produces:
  - `type Suggestion = { title: string; why: string; drill: string; impact: number; examples: { url: string; fenBefore: string; san: string; bestSan: string }[] }`
  - `coach(stats: Stats): Suggestion[]` — runs each rule, dedupes, sorts by `impact` desc, returns top 5. Rules:
    1. Any type ≥ 30% of `mistakeCount` → habit/drill advice for that type; impact = `count * avgCpLoss`.
    2. Any phase ≥ 50% of `mistakeCount` → phase-study advice; impact = `phaseCount * 100`.
    3. Any opening with `games ≥ 3` and `winPct < 40` → repertoire advice; impact = `games * (40 - winPct)`.
  - Each suggestion attaches up to 3 `examples` drawn from `stats.topBlunders` matching the rule's type/phase when applicable (else the highest-cpLoss blunders).

- [ ] **Step 1: Write the failing test** in `src/report/coach.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { coach } from './coach.js'
import type { Stats } from './aggregate.js'

const base: Stats = {
  gamesAnalyzed: 10,
  record: { wins: 3, losses: 6, draws: 1 },
  mistakeCount: 10,
  byPhase: { opening: 1, middlegame: 3, endgame: 6 },
  byType: {
    hung_piece: { count: 6, avgCpLoss: 350 },
    missed_tactic: { count: 2, avgCpLoss: 200 },
    bad_trade: { count: 1, avgCpLoss: 150 },
    king_safety: { count: 1, avgCpLoss: 120 },
    positional: { count: 0, avgCpLoss: 0 },
  },
  openings: [
    { eco: 'B20', name: 'Sicilian', games: 4, wins: 1, winPct: 25, avgMistakes: 2.5 },
    { eco: 'C50', name: 'Italian', games: 6, wins: 2, winPct: 33, avgMistakes: 1.0 },
  ],
  topBlunders: [
    { url: 'u1', ply: 20, san: 'Qd5', bestSan: 'Nf3', fenBefore: 'f1', cpLoss: 500, type: 'hung_piece' },
  ],
}

describe('coach', () => {
  it('produces type, phase, and opening suggestions ranked by impact', () => {
    const s = coach(base)
    const titles = s.map((x) => x.title.toLowerCase()).join(' | ')
    expect(titles).toContain('hung') // 60% of mistakes
    expect(titles).toContain('endgame') // 60% of mistakes in endgame
    expect(titles).toMatch(/sicilian/) // losing opening with >=3 games
    // highest-impact suggestion first
    expect(s[0].impact).toBeGreaterThanOrEqual(s[s.length - 1].impact)
    expect(s.length).toBeLessThanOrEqual(5)
  })

  it('returns nothing actionable when there are no mistakes', () => {
    const empty: Stats = { ...base, mistakeCount: 0,
      byPhase: { opening: 0, middlegame: 0, endgame: 0 },
      byType: { hung_piece: { count: 0, avgCpLoss: 0 }, missed_tactic: { count: 0, avgCpLoss: 0 },
        bad_trade: { count: 0, avgCpLoss: 0 }, king_safety: { count: 0, avgCpLoss: 0 },
        positional: { count: 0, avgCpLoss: 0 } },
      openings: [] }
    expect(coach(empty)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- coach`
Expected: FAIL — cannot find module `./coach.js`.

- [ ] **Step 3: Write `src/report/coach.ts`**

```ts
import type { Stats, BlunderRef } from './aggregate.js'
import type { MistakeType, Phase } from '../types.js'

export type Suggestion = {
  title: string
  why: string
  drill: string
  impact: number
  examples: { url: string; fenBefore: string; san: string; bestSan: string }[]
}

const TYPE_LABEL: Record<MistakeType, string> = {
  hung_piece: 'Hung pieces',
  missed_tactic: 'Missed tactics',
  bad_trade: 'Bad trades',
  king_safety: 'King safety',
  positional: 'Positional errors',
}

const TYPE_DRILL: Record<MistakeType, string> = {
  hung_piece: 'Before every move, do a blunder-check: is the piece I am moving — or one I leave behind — left en prise?',
  missed_tactic: 'Do 10–15 tactics puzzles a day; on each move scan for checks, captures, and threats first.',
  bad_trade: 'Before capturing, count attackers vs defenders on the target square and compare piece values.',
  king_safety: 'Castle early; avoid king moves that forfeit castling rights; keep the pawn shield intact.',
  positional: 'Study pawn structure and piece activity; review annotated master games in your openings.',
}

const PHASE_DRILL: Record<Phase, string> = {
  opening: 'Build a small, solid repertoire and learn the plans, not just the moves.',
  middlegame: 'Study middlegame plans and tactics arising from your openings.',
  endgame: 'Drill fundamental endgames: king-and-pawn, basic rook endings, opposition.',
}

function examplesFor(blunders: BlunderRef[], type?: MistakeType): Suggestion['examples'] {
  const pool = type ? blunders.filter((b) => b.type === type) : blunders
  const chosen = (pool.length ? pool : blunders).slice(0, 3)
  return chosen.map((b) => ({ url: b.url, fenBefore: b.fenBefore, san: b.san, bestSan: b.bestSan }))
}

export function coach(stats: Stats): Suggestion[] {
  const out: Suggestion[] = []
  if (stats.mistakeCount === 0) return out

  // Rule 1: dominant mistake type.
  for (const t of Object.keys(stats.byType) as MistakeType[]) {
    const { count, avgCpLoss } = stats.byType[t]
    if (count === 0) continue
    const share = count / stats.mistakeCount
    if (share >= 0.3) {
      out.push({
        title: `${TYPE_LABEL[t]} are your most common mistake (${Math.round(share * 100)}%)`,
        why: `They account for ${count} of ${stats.mistakeCount} mistakes, averaging ${avgCpLoss} centipawns lost each.`,
        drill: TYPE_DRILL[t],
        impact: count * avgCpLoss,
        examples: examplesFor(stats.topBlunders, t),
      })
    }
  }

  // Rule 2: dominant phase.
  for (const p of Object.keys(stats.byPhase) as Phase[]) {
    const c = stats.byPhase[p]
    if (c === 0) continue
    const share = c / stats.mistakeCount
    if (share >= 0.5) {
      out.push({
        title: `Most of your mistakes happen in the ${p} (${Math.round(share * 100)}%)`,
        why: `${c} of ${stats.mistakeCount} mistakes occur in the ${p}.`,
        drill: PHASE_DRILL[p],
        impact: c * 100,
        examples: examplesFor(stats.topBlunders),
      })
    }
  }

  // Rule 3: losing openings.
  for (const o of stats.openings) {
    if (o.games >= 3 && o.winPct < 40) {
      out.push({
        title: `You struggle in the ${o.name} (${o.winPct}% over ${o.games} games)`,
        why: `Low score with this opening drags your rating; ${o.avgMistakes} mistakes per game on average.`,
        drill: `Study the main lines and typical plans of the ${o.name}, or switch to a repertoire you score better with.`,
        impact: o.games * (40 - o.winPct),
        examples: examplesFor(stats.topBlunders),
      })
    }
  }

  return out.sort((a, b) => b.impact - a.impact).slice(0, 5)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- coach`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/report/coach.ts src/report/coach.test.ts
git commit -m "feat: rule-based coaching suggestions"
```

---

### Task 11: Report rendering

**Files:**
- Create: `src/report/render.ts`, `src/report/render.test.ts`

**Interfaces:**
- Consumes: `Stats` (Task 9), `Suggestion` (Task 10); `BlunderRef`.
- Produces:
  - `renderMarkdown(stats: Stats, suggestions: Suggestion[], meta: { user: string; since: string; depth: number }): string` — full markdown report (summary, top blunders table with analysis links, phase table, type table, opening table, coaching section).
  - `renderTerminal(stats: Stats, suggestions: Suggestion[], meta): string` — condensed plain-text summary for stdout.
  - `analysisLink(url: string, fen: string): string` — `https://www.chess.com/analysis?fen=<encoded>` (FEN-based analysis board link).

- [ ] **Step 1: Write the failing test** in `src/report/render.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { renderMarkdown, renderTerminal, analysisLink } from './render.js'
import type { Stats } from './aggregate.js'
import type { Suggestion } from './coach.js'

const stats: Stats = {
  gamesAnalyzed: 5, record: { wins: 2, losses: 3, draws: 0 }, mistakeCount: 4,
  byPhase: { opening: 0, middlegame: 1, endgame: 3 },
  byType: {
    hung_piece: { count: 3, avgCpLoss: 300 }, missed_tactic: { count: 1, avgCpLoss: 200 },
    bad_trade: { count: 0, avgCpLoss: 0 }, king_safety: { count: 0, avgCpLoss: 0 },
    positional: { count: 0, avgCpLoss: 0 },
  },
  openings: [{ eco: 'B20', name: 'Sicilian', games: 3, wins: 1, winPct: 33, avgMistakes: 1.3 }],
  topBlunders: [{ url: 'https://chess.com/game/1', ply: 20, san: 'Qd5', bestSan: 'Nf3', fenBefore: '8/8/8 w - - 0 1', cpLoss: 400, type: 'hung_piece' }],
}
const sugg: Suggestion[] = [{ title: 'Hung pieces', why: 'w', drill: 'd', impact: 900, examples: [] }]

describe('render', () => {
  it('markdown contains all sections and a usable analysis link', () => {
    const md = renderMarkdown(stats, sugg, { user: 'bob', since: '2025-06', depth: 15 })
    expect(md).toContain('# chess-coach report for bob')
    expect(md).toContain('Top blunders')
    expect(md).toContain('Mistake types')
    expect(md).toContain('Openings')
    expect(md).toContain('Coaching')
    expect(md).toContain('Hung pieces')
    expect(md).toContain('chess.com/analysis?fen=')
  })

  it('terminal summary is plain text with the record and top suggestion', () => {
    const txt = renderTerminal(stats, sugg, { user: 'bob', since: '2025-06', depth: 15 })
    expect(txt).toContain('bob')
    expect(txt).toContain('2W-3L-0D')
    expect(txt).toContain('Hung pieces')
  })

  it('analysisLink encodes the FEN', () => {
    expect(analysisLink('x', 'r n/8 w - - 0 1')).toContain('fen=r%20n')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- render`
Expected: FAIL — cannot find module `./render.js`.

- [ ] **Step 3: Write `src/report/render.ts`**

```ts
import type { Stats } from './aggregate.js'
import type { Suggestion } from './coach.js'
import type { MistakeType, Phase } from '../types.js'

type Meta = { user: string; since: string; depth: number }

export function analysisLink(_url: string, fen: string): string {
  return `https://www.chess.com/analysis?fen=${encodeURIComponent(fen)}`
}

const TYPES: MistakeType[] = ['hung_piece', 'missed_tactic', 'bad_trade', 'king_safety', 'positional']
const PHASES: Phase[] = ['opening', 'middlegame', 'endgame']

function recordStr(r: Stats['record']): string {
  return `${r.wins}W-${r.losses}L-${r.draws}D`
}

export function renderMarkdown(stats: Stats, suggestions: Suggestion[], meta: Meta): string {
  const lines: string[] = []
  lines.push(`# chess-coach report for ${meta.user}`)
  lines.push('')
  lines.push(`Games since ${meta.since} • analyzed at depth ${meta.depth}`)
  lines.push('')
  lines.push('## Summary')
  lines.push(`- Games analyzed: ${stats.gamesAnalyzed}`)
  lines.push(`- Record: ${recordStr(stats.record)}`)
  lines.push(`- Total mistakes (your moves): ${stats.mistakeCount}`)
  lines.push('')

  lines.push('## Top blunders')
  lines.push('| Move | Played | Best | cpLoss | Type | Analyze |')
  lines.push('|---|---|---|---|---|---|')
  for (const b of stats.topBlunders) {
    lines.push(`| ${b.ply} | ${b.san} | ${b.bestSan} | ${b.cpLoss} | ${b.type} | [board](${analysisLink(b.url, b.fenBefore)}) |`)
  }
  lines.push('')

  lines.push('## Mistakes by phase')
  lines.push('| Phase | Count |')
  lines.push('|---|---|')
  for (const p of PHASES) lines.push(`| ${p} | ${stats.byPhase[p]} |`)
  lines.push('')

  lines.push('## Mistake types')
  lines.push('| Type | Count | Avg cpLoss |')
  lines.push('|---|---|---|')
  for (const t of TYPES) lines.push(`| ${t} | ${stats.byType[t].count} | ${stats.byType[t].avgCpLoss} |`)
  lines.push('')

  lines.push('## Openings')
  lines.push('| ECO | Opening | Games | Win % | Avg mistakes |')
  lines.push('|---|---|---|---|---|')
  for (const o of stats.openings) lines.push(`| ${o.eco} | ${o.name} | ${o.games} | ${o.winPct} | ${o.avgMistakes} |`)
  lines.push('')

  lines.push('## Coaching')
  if (suggestions.length === 0) lines.push('No high-priority issues found. Keep it up!')
  for (const s of suggestions) {
    lines.push(`### ${s.title}`)
    lines.push(s.why)
    lines.push('')
    lines.push(`**Drill:** ${s.drill}`)
    if (s.examples.length) {
      lines.push('')
      lines.push('Examples:')
      for (const e of s.examples) {
        lines.push(`- ${e.san} (best: ${e.bestSan}) — [analyze](${analysisLink(e.url, e.fenBefore)})`)
      }
    }
    lines.push('')
  }
  return lines.join('\n')
}

export function renderTerminal(stats: Stats, suggestions: Suggestion[], meta: Meta): string {
  const lines: string[] = []
  lines.push(`chess-coach — ${meta.user} (since ${meta.since}, depth ${meta.depth})`)
  lines.push(`Games: ${stats.gamesAnalyzed}  Record: ${recordStr(stats.record)}  Mistakes: ${stats.mistakeCount}`)
  lines.push('')
  lines.push('Mistake types:')
  for (const t of TYPES) {
    if (stats.byType[t].count) lines.push(`  ${t}: ${stats.byType[t].count} (avg ${stats.byType[t].avgCpLoss}cp)`)
  }
  lines.push('')
  lines.push('Top suggestions:')
  if (!suggestions.length) lines.push('  None — no high-priority issues found.')
  suggestions.forEach((s, i) => {
    lines.push(`  ${i + 1}. ${s.title}`)
    lines.push(`     → ${s.drill}`)
  })
  return lines.join('\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- render`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/report/render.ts src/report/render.test.ts
git commit -m "feat: markdown and terminal report rendering"
```

---

### Task 12: CLI wiring + orchestration

**Files:**
- Create: `src/cli.ts`, `src/orchestrate.ts`, `src/orchestrate.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `src/orchestrate.ts`: `defaultSince(nowISO: string): string` (12 months before now, `YYYY-MM`); `run(opts: { user; since; depth; last?; root?; nowISO; evaluate; fetchFn? }): Promise<{ markdown: string; terminal: string }>` — fetches games, parses, analyzes with cache, aggregates, coaches, renders. The `evaluate` and `fetchFn` are injected so this is testable without network or the real engine.
  - `src/cli.ts`: parses flags with `node:util` `parseArgs`, boots a real `Engine`, calls `run`, prints terminal output, writes markdown if `--out` given, then `engine.quit()`.

- [ ] **Step 1: Write the failing test** in `src/orchestrate.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSince, run } from './orchestrate.js'

describe('defaultSince', () => {
  it('returns 12 months before now as YYYY-MM', () => {
    expect(defaultSince('2026-06-18T00:00:00Z')).toBe('2025-06')
  })
})

describe('run', () => {
  it('produces a report end-to-end with injected fetch and evaluator', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cc-run-'))
    const pgn = `[White "bob"]\n[Black "alice"]\n[Result "1-0"]\n[ECO "C50"]\n[Opening "Italian"]\n\n1. e4 e5 2. Nf3 Nc6 1-0`
    const fetchFn = async (url: string) => {
      if (url.endsWith('/archives')) {
        return new Response(JSON.stringify({ archives: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({
        games: [{ url: 'https://chess.com/game/1', end_time: 1_750_000_000,
          white: { username: 'bob' }, black: { username: 'alice' }, pgn }],
      }), { status: 200 })
    }
    const evaluate = async (fen: string) =>
      ({ eval: { cp: fen.includes(' w ') ? 20 : -20, mate: null }, bestUci: 'e2e4' })

    const out = await run({
      user: 'bob', since: '2026-06', depth: 8, root,
      nowISO: '2026-06-18T00:00:00Z', evaluate: evaluate as any, fetchFn: fetchFn as any,
    })
    expect(out.markdown).toContain('# chess-coach report for bob')
    expect(out.terminal).toContain('bob')
    expect(out.terminal).toContain('Games: 1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- orchestrate`
Expected: FAIL — cannot find module `./orchestrate.js`.

- [ ] **Step 3: Write `src/orchestrate.ts`**

```ts
import { fetchGamesSince } from './api/chesscom.js'
import { parseGame } from './pgn/parse.js'
import { analyzeGame, type Evaluator } from './analyze/game.js'
import { readCached, writeCached } from './cache/store.js'
import { aggregate } from './report/aggregate.js'
import { coach } from './report/coach.js'
import { renderMarkdown, renderTerminal } from './report/render.js'
import type { GameAnalysis } from './types.js'

export function defaultSince(nowISO: string): string {
  const d = new Date(nowISO)
  d.setUTCMonth(d.getUTCMonth() - 12)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function run(opts: {
  user: string
  since: string
  depth: number
  last?: number
  root?: string
  nowISO: string
  evaluate: Evaluator
  fetchFn?: typeof fetch
}): Promise<{ markdown: string; terminal: string }> {
  const raw = await fetchGamesSince(opts.user, opts.since, opts.nowISO, opts.fetchFn ?? fetch)
  let parsed = raw.map((r) => parseGame(r, opts.user)).filter((g): g is NonNullable<typeof g> => g !== null)
  parsed.sort((a, b) => a.playedAt.localeCompare(b.playedAt))
  if (opts.last && opts.last > 0) parsed = parsed.slice(-opts.last)

  const analyses: GameAnalysis[] = []
  for (let i = 0; i < parsed.length; i++) {
    const g = parsed[i]
    let analysis = await readCached(opts.user, g.gameId, opts.depth, opts.root)
    if (!analysis) {
      analysis = await analyzeGame(g, opts.depth, opts.evaluate)
      await writeCached(analysis, opts.user, opts.root)
    }
    analyses.push(analysis)
    if (process.stderr.isTTY) {
      process.stderr.write(`\ranalyzed ${i + 1}/${parsed.length} games`)
    }
  }
  if (process.stderr.isTTY) process.stderr.write('\n')

  const stats = aggregate(analyses)
  const suggestions = coach(stats)
  const meta = { user: opts.user, since: opts.since, depth: opts.depth }
  return {
    markdown: renderMarkdown(stats, suggestions, meta),
    terminal: renderTerminal(stats, suggestions, meta),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- orchestrate`
Expected: PASS.

- [ ] **Step 5: Write `src/cli.ts`** (no unit test — thin I/O shell; verified by manual run in Step 7)

```ts
import { parseArgs } from 'node:util'
import { writeFile } from 'node:fs/promises'
import { Engine } from './engine/stockfish.js'
import { run, defaultSince } from './orchestrate.js'

async function main() {
  const { values } = parseArgs({
    options: {
      user: { type: 'string' },
      since: { type: 'string' },
      last: { type: 'string' },
      depth: { type: 'string', default: '15' },
      out: { type: 'string' },
    },
  })

  if (!values.user) {
    console.error('Usage: chess-coach --user <name> [--since YYYY-MM] [--last N] [--depth 15] [--out report.md]')
    process.exit(2)
  }

  const nowISO = new Date().toISOString()
  const since = values.since ?? defaultSince(nowISO)
  const depth = Number(values.depth ?? '15')
  const last = values.last ? Number(values.last) : undefined

  const engine = await Engine.create()
  try {
    const out = await run({
      user: values.user, since, depth, last, nowISO,
      evaluate: (fen, d) => engine.evaluate(fen, d),
    })
    console.log(out.terminal)
    if (values.out) {
      await writeFile(values.out, out.markdown, 'utf8')
      console.log(`\nFull report written to ${values.out}`)
    }
  } finally {
    engine.quit()
  }
}

main().catch((err) => {
  console.error(String(err?.message ?? err))
  process.exit(1)
})
```

- [ ] **Step 6: Build to verify CLI compiles**

Run: `npm run build`
Expected: `tsc` completes with no errors; `dist/cli.js` exists.

- [ ] **Step 7: Manual smoke test against the real API + engine**

Run: `npm run dev -- --user hikaru --last 2 --depth 10`
Expected: prints a terminal report with `Games: 2`, a record line, mistake types, and suggestions. (Uses the real engine; takes a minute or two.)

- [ ] **Step 8: Commit**

```bash
git add src/cli.ts src/orchestrate.ts src/orchestrate.test.ts
git commit -m "feat: CLI orchestration end-to-end"
```

---

## Self-Review Notes (addressed)

- **Spec coverage:** API fetch (T2), PGN+clocks (T3), engine (T4), severity (T1/T7), type classification (T6), phase (T5), caching incremental + depth key (T8), aggregation incl. blunders/phase/type/openings (T9), coaching ranked top 3–5 with examples (T10), markdown+terminal with `--out` opt-in and analysis links (T11), CLI flags + orchestration + progress (T12). Time-pressure is parsed (`clockSeconds` in T3, carried to `MoveAnalysis`) but intentionally not surfaced — matches the spec's v2 deferral.
- **Concurrency:** spec mentions a small WASM worker pool; MVP runs games sequentially with a progress indicator and full caching (the spec's primary mitigation). A worker pool is a safe later optimization that does not change interfaces. Flagged here rather than silently dropped.
- **Type consistency:** `Evaluator` shape is identical in T4 (`Engine.evaluate`), T7, and T12. `Stats`/`Suggestion`/`BlunderRef` names match across T9–T12.
- **Placeholders:** none — every code/step is concrete. Two "Note" callouts (T3 clock fallback, T4 WASM entrypoint) are explicit adaptation instructions for environment variance, with the test as the fixed contract, not deferred work.
