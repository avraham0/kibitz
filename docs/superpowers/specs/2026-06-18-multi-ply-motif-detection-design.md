# Multi-ply Motif Detection — Design

**Date:** 2026-06-18
**Status:** Approved pending spec review
**Builds on:** the chess-coach CLI (`docs/superpowers/specs/2026-06-18-chess-coach-cli-design.md`)

## Purpose

Today's mistake classifier is 1-ply: it inspects only the position immediately
after the played move, so it can name `hung_piece`, `bad_trade`, and `king_safety`
but lumps every multi-move tactic (forks, pins, discovered attacks, etc.) into the
`positional` catch-all. On real data that catch-all is ~75% of mistakes.

This feature reads the tactic out of the engine's **principal variation (PV)** — the
refutation line the engine already computes — and assigns a named tactical motif. The
names are used two ways: (1) re-bucket mistakes out of `positional` into the right
motif, and (2) drive motif-level coaching ("forks are your most common mistake — 3 you
missed, 2 you allowed").

## Scope

**In scope:**
- Engine wrapper returns the PV (no new searches).
- A motif detector for 6 motifs: `fork`, `pin`, `skewer`, `discovered_attack`,
  `trapped_piece`, `back_rank`.
- A `missed` direction flag (you missed the tactic vs you allowed it).
- Integration into per-move classification, aggregation, coaching, and rendering.

**Out of scope (deferred):**
- Motifs beyond the core 6 (overload/removing-the-defender, decoy, deflection,
  mating nets that aren't back-rank).
- `multipv` (multiple PVs per position) — a single PV per evaluated position suffices.
- Re-searching positions specifically for tactics (Approach 2 from brainstorming).
- LLM coaching.

## Approach (chosen)

PV replay + geometric detectors. The engine, while evaluating a position, emits
`info … score … pv <uci moves>`. We capture that PV and replay it on a board; at each
move made by the side that benefits from the tactic, run the 6 detectors against the
resulting position. The first detector to match (by priority) names the motif. This
reuses engine work already done, names the *actual* refutation, and keeps each detector
a small, independently testable pure function.

Rejected: a dedicated per-mistake tactic search (too much extra compute, can disagree
with the engine's own line) and static-pattern-only detection (cannot see multi-move
setups — the exact gap we are closing).

## Data Model Changes (`src/types.ts`)

```ts
// Six new members appended to the existing MistakeType union:
export type MistakeType =
  | 'hung_piece' | 'missed_tactic' | 'bad_trade' | 'king_safety'
  | 'positional' | 'lost_position'
  | 'fork' | 'pin' | 'skewer' | 'discovered_attack' | 'trapped_piece' | 'back_rank'

// The six detectable multi-ply motifs (a strict subset, for the detector module):
export type Motif =
  | 'fork' | 'pin' | 'skewer' | 'discovered_attack' | 'trapped_piece' | 'back_rank'

export const MOTIFS: Motif[] = [
  'back_rank', 'fork', 'discovered_attack', 'skewer', 'pin', 'trapped_piece',
] // listed in detection-priority order
```

`MoveAnalysis` gains one field:

```ts
missed: boolean // true: the tactic was in the player's own best line and not played;
                // false: the player allowed it (opponent executed it). Only meaningful
                // when type is a motif or 'missed_tactic'; false otherwise.
```

`Eval`/engine output: `evaluate()` returns an added `pv: string[]` (UCI moves).

## Engine Change (`src/engine/stockfish.ts`)

`evaluate(fen, depth)` returns `{ eval: Eval; bestUci: string; pv: string[] }`.
- Parse the PV from the **last** `info` line that contains a ` pv ` token (deepest
  search line). The PV is the whitespace-separated UCI moves after the `pv` token.
- `bestUci` stays `pv[0]` when a PV is present (consistent with the `bestmove` line);
  fall back to the `bestmove` line if no PV line was seen.
- Empty/absent PV → `pv: []` (callers tolerate this; motif detection is skipped).

## Motif Detector (`src/analyze/motifs.ts`)

A new, self-contained module. Public interface:

```ts
type MotifHit = { motif: Motif; ply: number } // ply = index into pv where it fires

// Replays `pv` from `startFen` and returns the first motif detected, or null.
// The "beneficiary" is the side to move at startFen (the side executing the tactic):
// for a refutation PV that is the opponent; for a missed-best-line PV it is the player.
function detectMotif(startFen: string, pv: string[]): MotifHit | null
```

`detectMotif` walks up to **8 plies** of the PV. It applies the beneficiary's move,
then runs detectors in `MOTIFS` priority order against the (startFen, move, resulting
position, and short look-ahead within the PV). First match wins and returns its ply.

Each detector is a pure function with this shape and uses `chess.js` 1.4.0
(`attackers(square,color)`, `moves({verbose})`, `get`, `board`, `isCheck`,
`isCheckmate`) plus `PIECE_VALUE`:

```ts
type Detector = (ctx: {
  fenBefore: string   // position before the beneficiary's move
  move: VerboseMove   // the beneficiary's move just applied
  fenAfter: string    // position after the move (opponent to move)
  pv: string[]        // full line, for short look-ahead
  index: number       // index of `move` within pv
}) => boolean
```

### Detector heuristics

- **back_rank:** `move` gives checkmate (`isCheckmate()` on `fenAfter`) and the mated
  king is on its back rank (rank 1 for white, rank 8 for black) with its escape squares
  blocked by its own pieces. (Also fires on a forced mate-in-1/2 within the PV on the
  back rank.)
- **fork (double attack):** after `move`, the moved piece attacks ≥2 enemy pieces that
  are each either higher-valued than the attacker or undefended (one may be the king →
  check + win); confirm that within the next 2 PV plies the beneficiary captures one of
  them and comes out ahead in material.
- **discovered_attack:** the moved piece's *origin* square vacates a line such that a
  friendly slider (R/B/Q) behind it now attacks an enemy king (discovered check) or an
  enemy piece ≥ a minor; the attacking piece is not the moved piece. Confirm material
  win or check in the line.
- **skewer:** `move` attacks a valuable enemy piece (or checks the king) along a slider
  line; in the next PV ply that piece moves and the beneficiary captures the (lesser)
  piece that was behind it on the same line.
- **pin:** after `move`, an enemy piece is attacked by a slider along a line where a
  more valuable enemy piece (or the king → absolute pin) sits behind it on the same
  line; and the line shows the pinned piece is then won or cannot escape.
- **trapped_piece:** an enemy piece captured later in the PV had, at the moment it was
  first attacked, no legal move to a safe square (every destination is attacked / still
  loses it), and it was not defended enough to hold — i.e. it was trapped, not a simple
  one-move hang (which `hung_piece` already covers).

Detectors are deliberately heuristic; ambiguous cases simply return false and the
mistake falls back to 1-ply classification. Priority order resolves multi-match
positions (a back-rank mate that is also technically a fork is reported as back_rank).

## Classification Integration (`src/analyze/game.ts`)

For each analyzed move, after computing `evalBefore`, `evalAfterPlayed`, `cpLoss`, and
`severity`, and after the existing `lost_position` guard (`bestCp <= -500`):

1. If `severity === 'ok'` or `lost_position`: no motif work; `missed = false`.
2. Decide direction and which PV explains the mistake:
   - **missed** case: `maxHangingGain(fenBefore) >= 200 && playedUci !== bestUci`
     (the existing missed-tactic condition) → analyze the **fenBefore PV** (the line the
     player should have played); `missed = true`.
   - **allowed** case otherwise → analyze the **fenAfter PV** (the opponent's
     refutation); `missed = false`.
3. `hit = detectMotif(chosenStartFen, chosenPV)`.
4. If `hit`: `type = hit.motif`.
   Else if missed case: `type = 'missed_tactic'`.
   Else: `type = classifyMistake({ fenBefore, san, bestUci })` (today's 1-ply result).

`analyzeGame` therefore needs both PVs, which means it captures `pv` from both the
`fenBefore` and `fenAfter` evaluations it already performs. No new engine calls.

## Aggregation (`src/report/aggregate.ts`)

- `byType` spans the expanded `MistakeType` (motifs included), unchanged in shape:
  `{ count, avgCpLoss }` per type. `lost_position` remains excluded (as today).
- Each motif/type entry additionally tracks the missed/allowed split. Extend the
  per-type value to `{ count, avgCpLoss, missed, allowed }` where `missed + allowed ===
  count` and `missed` counts moves with `missed === true`.
- `topBlunders` unchanged except each `BlunderRef` already carries `type`, which may now
  be a motif.

## Coaching (`src/report/coach.ts`)

- Rule 1 (a type ≥30% of mistakes) now fires on specific motifs and includes the
  direction split in the message, e.g. *"Forks are your most common mistake (34%) — 4
  you missed, 3 you allowed."* with a motif-specific drill.
- Add `TYPE_DRILL`/`TYPE_LABEL` entries for the 6 motifs (e.g. fork → "scan for knight
  and queen double-attacks on every move, for both sides"; back_rank → "make luft / keep
  a back-rank defender"). Existing rules (phase, opening) unchanged.

## Rendering (`src/report/render.ts`)

- The mistake-types table lists motif rows and adds a "missed / allowed" column pair
  (or a `missed`-of-`count` cell). Terminal summary shows the motif breakdown.
- Top-blunders table's `Type` column now shows motifs.

## Testing

- `motifs.ts`: table-driven — one crafted (startFen, pv) per motif → expected
  `MotifHit.motif`, plus a no-motif line → null. These are the core correctness tests.
- `stockfish.ts`: extend the real-engine test to assert `pv.length >= 1` and that
  `pv[0]` matches the `bestUci`/`bestmove`.
- `game.ts`: with an injected evaluator returning crafted PVs, assert (a) an allowed
  fork → `type === 'fork'`, `missed === false`; (b) a missed fork (winning line at
  fenBefore) → `type === 'fork'`, `missed === true`; (c) a non-tactical drop with empty
  PV → falls back to `positional`/`hung_piece` as before, `missed === false`.
- `aggregate.ts`: synthetic moves → assert motif counts and the missed/allowed split.
- `coach.ts`: a dominant motif → suggestion text includes the motif label and split.
- `render.ts`: motif rows and the missed/allowed column render.

## Performance & Limitations

- **No new engine calls.** The PV is captured from `info` lines already produced;
  detection runs only on flagged mistakes and is pure board logic. Cost is negligible
  relative to the engine search.
- **PV-depth dependent.** At low `--depth`, the PV is shorter and may not show the
  tactic resolving; some motifs will be missed and fall back to `positional`. Higher
  depth improves recall. This is acceptable and documented.
- **Heuristic.** Detectors will have some false positives/negatives; the priority order
  and the "confirm material is won within the line" checks limit false positives.
  Anything undetected still lands in `positional` — now a much smaller, honest bucket.

## Milestones

1. Engine returns `pv`; extend the engine test.
2. `motifs.ts` with the 6 detectors + table-driven tests.
3. Wire `detectMotif` into `game.ts` (type + `missed`), with crafted-PV tests.
4. Aggregation missed/allowed split.
5. Coaching motif messages + drills.
6. Rendering updates.
