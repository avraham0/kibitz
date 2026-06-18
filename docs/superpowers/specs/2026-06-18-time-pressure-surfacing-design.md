# Time-Pressure Surfacing — Design

**Date:** 2026-06-18
**Status:** Approved pending spec review
**Builds on:** the chess-coach CLI (`2026-06-18-chess-coach-cli-design.md`)

## Purpose

Clock data (`%clk`) is already parsed by the PGN parser and carried on every
`MoveAnalysis.clockSeconds`, but it is never surfaced. This feature correlates the
player's mistakes with how much time was on their clock, so the report can show whether
mistakes cluster in time pressure and coach accordingly ("X% of your blunders come with
under 30s left → manage your clock"). This is the spec's deferred v2 item #5.

## Scope

**In scope:**
- Aggregate player moves (that have clock data) into clock-remaining buckets and tally
  moves / mistakes / blunders / avg cpLoss per bucket.
- A coaching rule that fires when blunders cluster at low clock.
- A "Time pressure" report section (markdown table + condensed terminal lines), omitted
  cleanly when no clock data exists.
- Honest data accounting: report how many games had usable clock data.

**Out of scope:**
- Time-control normalization (no reliable time-control parse; buckets are absolute
  seconds). Documented as a limitation.
- Per-game time-trouble flags / time graphs.
- Any change to engine, parser, cache, or per-move analysis — `clockSeconds` already
  flows through. This is purely the report layer (aggregate → coach → render).

## Definitions

- A move's clock value is `MoveAnalysis.clockSeconds` (seconds remaining after the move,
  parsed from `%clk`; `null` when absent). Used as the proxy for time pressure at that move.
- A **mistake** is a player move (`isPlayerMove === true`) with `severity !== 'ok'` and
  `type !== 'lost_position'` — identical to the existing mistake definition in aggregate.
- A **blunder** is such a move with `severity === 'blunder'`.
- Buckets, by `clockSeconds`: `<10s` (0–9), `10-30s` (10–29), `30-60s` (30–59),
  `60s+` (≥60). These exact labels are used as keys and rendered verbatim.

## Aggregation (`src/report/aggregate.ts`)

Add to `Stats`:

```ts
type TimeBucket = '<10s' | '10-30s' | '30-60s' | '60s+'

// in Stats:
byTimeBucket: Record<TimeBucket, {
  moves: number       // total player moves WITH clock data in this bucket (denominator)
  mistakes: number    // player mistakes in this bucket
  blunders: number    // player blunders in this bucket
  avgCpLoss: number   // avg cpLoss over the mistakes in this bucket (0 if none)
}>
gamesWithClock: number   // games where >=1 player move had clockSeconds != null
```

`gamesAnalyzed` already exists. Computation, in the existing move loop (no extra pass):
- For each game, track whether any player move had clock data; increment
  `gamesWithClock` once per such game.
- For each **player move with `clockSeconds != null`**: pick its bucket; increment that
  bucket's `moves`. If it is a mistake (per the definition above), increment `mistakes`,
  add to the cpLoss sum; if a blunder, increment `blunders`.
- `lost_position` moves are excluded from `mistakes`/`blunders` (consistent with the rest
  of aggregate), but DO count toward `moves` only if they are genuine player moves with
  clock — to keep `moves` a true denominator of decisions made. (Rationale: the blunder
  *rate* should be blunders ÷ all decisions at that clock level.) Implementation note: the
  existing loop `continue`s on `lost_position` before mistake counting; the time-bucket
  `moves` tally must happen BEFORE that `continue` (and before the `severity==='ok'`
  skip), so every clocked player move is counted in `moves`.
- `avgCpLoss` per bucket = `round(sum / mistakes)` or 0 when `mistakes === 0`.

Bucket helper: `clockBucket(sec: number): TimeBucket` — `sec < 10 → '<10s'`,
`sec < 30 → '10-30s'`, `sec < 60 → '30-60s'`, else `'60s+'`.

## Coaching (`src/report/coach.ts`)

Add one rule (a pure function over `Stats`, consistent with existing rules):

- Let `clockedBlunders = sum of byTimeBucket[b].blunders` over all buckets.
- Let `lowClockBlunders = byTimeBucket['<10s'].blunders + byTimeBucket['10-30s'].blunders`.
- Fire when `clockedBlunders >= 3` AND `lowClockBlunders / clockedBlunders >= 0.4`.
- Suggestion:
  - title: `Time pressure is costing you`
  - why: `${pct}% of your blunders (${lowClockBlunders} of ${clockedBlunders}) come with under 30 seconds left.`
  - drill: `Manage your clock: decide on candidate moves faster in the opening/middlegame so you keep time for critical positions; practice with increment.`
  - impact: `lowClockBlunders * 100` (ranks it among the existing impact-sorted suggestions).
  - examples: up to 3 from `topBlunders` (reuse `examplesFor(stats.topBlunders)`).

This rule does not change Rules 1–3. The top-5 cap and impact sort are unchanged.

## Rendering (`src/report/render.ts`)

Add a "Time pressure" section after the mistake-types table (before openings).

- If `gamesWithClock === 0`: render a single line — `## Time pressure\n\n_No clock data
  in these games._ — and add nothing else.
- Otherwise:
  - A line: `Clock data: ${gamesWithClock} of ${gamesAnalyzed} games`.
  - A table over the four buckets in order `<10s, 10-30s, 30-60s, 60s+`:
    `| Clock | Moves | Mistakes | Blunders | Blunder rate | Avg cpLoss |`
    where blunder rate = `moves ? round(blunders / moves * 100) + '%' : '—'`.
    Skip a bucket row only if `moves === 0`.
- Terminal (`renderTerminal`): when `gamesWithClock > 0`, a compact block:
  `Time pressure (clock data: X/Y games):` then one line per non-empty bucket:
  `  <10s: 12 moves, 5 blunders (42%)`. When `gamesWithClock === 0`, omit the block.

All other sections, the already-lost line, and the coaching section are unchanged.

## Testing

- `aggregate.ts`:
  - synthetic moves across buckets (with `clockSeconds`) → assert per-bucket
    `moves/mistakes/blunders/avgCpLoss`, including that opponent moves and clock-less
    moves are excluded from buckets, and that `moves` counts a clocked `lost_position`
    move (denominator) while it is excluded from `mistakes`.
  - `gamesWithClock` counts a game once when any player move has clock; a fully
    clock-less game does not increment it.
- `coach.ts`:
  - a stats fixture with ≥3 clocked blunders, ≥40% under 30s → a "Time pressure"
    suggestion whose `why` cites the count and percent.
  - below-threshold (e.g. 2 blunders, or <40% low-clock) → no time-pressure suggestion.
- `render.ts`:
  - with clock data → "Time pressure" header, the `Clock data: N of M games` line, and a
    bucket row with a blunder-rate cell.
  - `gamesWithClock === 0` → the `_No clock data..._` line and NO bucket table.

## Limitations

- Buckets are absolute seconds; a 30s reading means different urgency in bullet vs rapid.
  Without a parsed time control this is a documented approximation.
- `clockSeconds` is the clock *after* the move (the parser's value); it approximates the
  time the player had to decide. Good enough for bucketing; not exact.
