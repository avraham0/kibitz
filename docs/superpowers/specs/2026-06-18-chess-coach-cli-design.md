# chess-coach CLI — Design

**Date:** 2026-06-18
**Status:** Approved (pending spec review)

## Purpose

A command-line tool that downloads a chess.com player's games, analyzes them with
Stockfish, identifies the player's most common mistakes, and produces prioritized,
actionable improvement suggestions.

Personal-use CLI. MVP focus: prove the analysis pipeline end-to-end and surface
high-signal coaching, without UI overhead.

## Scope

**In scope (MVP):**
- Fetch games from chess.com public API for the past 12 months and onward.
- Analyze each move with Stockfish (WASM), classifying mistakes by severity and type.
- Report: blunder list, phase breakdown, mistake-type breakdown, per-opening stats.
- Rule-based coaching: ranked top 3–5 fixes with concrete drills and example positions.
- On-disk caching so re-runs are incremental (only new games analyzed).

**Out of scope (deferred to v2+):**
- Time-pressure correlation (clock-vs-mistake analysis). Clock data is parsed and
  stored now, but not surfaced in reports yet.
- Web UI / board replay.
- LLM-generated coaching (the coach module is designed with a clean seam for this).

## Stack

- **Language:** TypeScript on Node 24. Run via `tsx` in dev; compiled with `tsc` for
  distribution.
- **Engine:** `stockfish` npm package (WASM). No system binary required.
- **Chess logic:** `chess.js` for move application, SAN/FEN handling, legality, and
  material counting.
- **HTTP:** native `fetch`.
- **Storage:** JSON files on disk. No database.

## Architecture

Each module has one clear purpose and a well-defined interface, testable in isolation.

| Module | Responsibility | Depends on |
|---|---|---|
| `src/api/chesscom.ts` | List archives, filter to date window, download PGNs | `fetch` |
| `src/pgn/parse.ts` | PGN → `Game` objects (moves, result, ECO/opening, color, clocks) | `chess.js` |
| `src/engine/stockfish.ts` | UCI-over-WASM wrapper: `evaluate(fen, depth) → Eval` | `stockfish` |
| `src/analyze/game.ts` | Per move: eval before/after → cploss → severity | engine, pgn |
| `src/analyze/classify.ts` | Tag mistake TYPE (hung piece, missed tactic, bad trade, king safety) | `chess.js` |
| `src/analyze/phase.ts` | Determine game phase (opening/middlegame/endgame) per move | `chess.js` |
| `src/cache/store.ts` | Read/write per-game analysis JSON; skip already-analyzed | `fs` |
| `src/report/aggregate.ts` | Roll up: blunders, phase %, type %, opening stats | — |
| `src/report/coach.ts` | Stats → ranked, actionable suggestions | — |
| `src/report/render.ts` | Markdown + terminal report | — |
| `src/cli.ts` | Flag parsing, orchestration, progress UI | all |

## Data Types (key shapes)

```ts
type Eval = { cp: number | null; mate: number | null };  // from side-to-move POV

type Severity = 'ok' | 'inaccuracy' | 'mistake' | 'blunder';

type MistakeType =
  | 'hung_piece' | 'missed_tactic' | 'bad_trade' | 'king_safety' | 'positional';

type Phase = 'opening' | 'middlegame' | 'endgame';

type MoveAnalysis = {
  ply: number;
  fenBefore: string;
  san: string;            // move played
  bestSan: string;        // engine best move
  evalBefore: Eval;
  evalAfterPlayed: Eval;
  cpLoss: number;         // >= 0, capped for mate swings
  severity: Severity;
  type: MistakeType;      // only meaningful when severity != 'ok'
  phase: Phase;
  clockSeconds: number | null;
};

type GameAnalysis = {
  gameId: string;         // chess.com game URL
  url: string;
  playedAt: string;       // ISO
  color: 'white' | 'black';
  result: 'win' | 'loss' | 'draw';
  eco: string;
  openingName: string;
  depth: number;          // depth used (part of cache key)
  moves: MoveAnalysis[];
};
```

## Mistake Classification

**Severity** — from centipawn loss = (eval of engine's best move) − (eval after the
move actually played), both from the moving side's POV:
- `inaccuracy`: 50–100 cp
- `mistake`: 100–300 cp
- `blunder`: 300+ cp
- Mate swings (gaining/losing a forced mate) map to a capped large cp value so they
  sort as blunders.

**Type** — heuristics applied to the position + move when severity is non-ok, in
priority order:
- `hung_piece`: after the played move, a friendly piece is en prise (attacked and
  insufficiently defended) and the engine's best reply wins that material.
- `missed_tactic`: the engine's best move wins ≥ ~2 pawns of material or forces mate,
  and the player did not play it.
- `bad_trade`: an exchange sequence on this move nets material loss versus an equal
  alternative.
- `king_safety`: the eval drop coincides with lost castling rights or a structurally
  opened king (pawn shield damage near the king).
- `positional`: fallback when no specific motif matches.

Each classifier is a pure function `(fenBefore, move, engineBest, evals) → boolean`,
checked in priority order; first match wins.

## Phase Detection

- `opening`: ply ≤ 24 (move 12) — book/development stage.
- `endgame`: total non-pawn material at/below a threshold (e.g. ≤ 6–7 pieces on board,
  or queens off with few minor/major pieces).
- `middlegame`: everything in between.

## Data Flow

```
cli parse flags
  → fetch archives for [since .. now]
  → download + parse PGNs
  → for each game:
        cache hit (same gameId + depth)? → load
        else → for each move: stockfish.evaluate(before) + evaluate(after)
                              → cpLoss → severity → classify type → phase
               → write cache
  → aggregate across games
  → coach: derive ranked suggestions
  → render markdown file + terminal summary
```

## CLI Interface

```
chess-coach --user <name> [--since YYYY-MM] [--last N] [--depth 15] [--out report.md]
```

- `--user` (required): chess.com username.
- `--since` (default: 12 months ago): start month for analysis window.
- `--last N`: cap to most recent N games (overrides `--since` window size).
- `--depth` (default 15): Stockfish search depth per position.
- `--out` (default `./chess-coach-report.md`): markdown output path.

## Caching

- Location: `~/.chess-coach/cache/<user>/<gameId>-d<depth>.json`.
- Key includes depth, so changing depth re-analyzes; same depth reuses.
- Incremental: a re-run analyzes only games not already cached.
- First run over a year is a long one-time batch. Mitigations: progress bar, and a
  small fixed pool of concurrent WASM engine workers (e.g. N = 2–4) to parallelize.

## Report Output

Markdown file + condensed terminal summary:
1. **Summary** — games analyzed, record, overall accuracy proxy.
2. **Top blunders** — move, position FEN, your move vs best, cpLoss, link to chess.com
   analysis board.
3. **Phase breakdown** — % of mistakes in opening / middlegame / endgame.
4. **Mistake-type breakdown** — % by type, with avg cpLoss per type.
5. **Per-opening stats** — games, win %, avg mistakes per opening (ECO + name).
6. **Coaching** — see below.

## Coaching (`report/coach.ts`)

Rule-based, deterministic. Each rule is a pure function `(stats) → Suggestion[]`.
Suggestions are ranked by **impact = frequency × avg cpLoss** and the top 3–5 shown.

Example rules:
- A mistake type exceeds ~30% of all mistakes → targeted habit/drill advice.
- A phase holds > 50% of mistakes → phase-specific study advice (e.g. endgame drills).
- An opening with ≥ N games has win % < ~40% → repertoire study/switch advice.
- A recurring tactical motif (e.g. missed forks) → motif-specific puzzle advice.
- (v2, when time data surfaced) blunder spike at low clock → time-management advice.

Each suggestion includes: the detected pattern, why it costs rating, a concrete drill,
and 2–3 example positions (FEN + chess.com analysis link) for replay.

This module is the clean seam for future LLM coaching: the same aggregated stats can be
fed to an LLM to generate richer prose without changing upstream modules.

## Error Handling

- Invalid username / 404 from chess.com → clear actionable message, exit non-zero.
- Rate limiting (429) → exponential backoff with retry.
- Engine timeout on a position → skip that move, log a warning, continue.
- Malformed PGN for a game → skip game, log, continue with the rest.

## Testing

- `classify.ts`: known FENs → expected `MistakeType` (table-driven).
- `phase.ts`: known positions → expected `Phase`.
- `pgn/parse.ts`: sample PGNs → expected `Game` fields (clocks, ECO, color, result).
- `aggregate.ts`: synthetic `GameAnalysis[]` → expected rollup math.
- `coach.ts`: synthetic stats → expected ranked suggestions.
- `engine/stockfish.ts`: a couple of known positions (e.g. mate-in-1, clearly winning)
  → sanity-checked eval sign/magnitude.

## Milestones

1. Engine wrapper + chess.com fetch + PGN parse (pipeline skeleton, no classification).
2. Per-move analysis + severity + caching.
3. Type classification + phase detection.
4. Aggregation + report rendering.
5. Coaching rules.
