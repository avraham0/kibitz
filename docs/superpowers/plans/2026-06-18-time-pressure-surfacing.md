# Time-Pressure Surfacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the already-stored per-move clock data — group the player's mistakes by clock-remaining bucket, add a time-trouble coaching rule, and render a "Time pressure" report section.

**Architecture:** Report-layer only. `clockSeconds` already flows onto every `MoveAnalysis`. Task 1 aggregates clocked player moves into time buckets (`aggregate.ts`); Task 2 adds a coaching rule (`coach.ts`); Task 3 renders the section (`render.ts`). No engine/parser/game/cache changes.

**Tech Stack:** TypeScript (ESM `nodenext`, strict), `vitest`.

## Global Constraints

- ESM `nodenext`: relative imports use the `.js` extension; `strict: true`; `npm run build` (tsc) stays clean.
- Bucket labels are EXACT keys/render strings: `'<10s'`, `'10-30s'`, `'30-60s'`, `'60s+'`.
- `clockBucket(sec)`: `sec < 10 → '<10s'`, `sec < 30 → '10-30s'`, `sec < 60 → '30-60s'`, else `'60s+'`.
- A **mistake** = player move (`isPlayerMove`) with `severity !== 'ok'` and `type !== 'lost_position'` (existing definition).
- A **blunder** = such a move with `severity === 'blunder'`.
- Time-bucket `moves` (the denominator) counts EVERY player move with `clockSeconds != null`, INCLUDING `lost_position` moves and `severity==='ok'` moves — they are still decisions made at that clock level. `mistakes`/`blunders`/`avgCpLoss` count only mistakes.
- Moves with `clockSeconds == null` and opponent moves are never bucketed.
- `gamesWithClock` increments once per game that has ≥1 player move with clock data.
- Coach rule fires iff `clockedBlunders >= 3` AND `lowClockBlunders / clockedBlunders >= 0.4` (lowClock = `<10s` + `10-30s` blunders).
- Git identity is local to this repo — commit plainly; never pass `-c user.email`/`-c user.name`.

---

### Task 1: Aggregate clock data into time buckets

**Files:**
- Modify: `src/report/aggregate.ts`
- Modify: `src/report/aggregate.test.ts`

**Interfaces:**
- Consumes: `MoveAnalysis.clockSeconds` (already present, `number | null`).
- Produces:
  - `export type TimeBucket = '<10s' | '10-30s' | '30-60s' | '60s+'`
  - `export const TIME_BUCKETS: TimeBucket[]` (the four labels in order)
  - `Stats.byTimeBucket: Record<TimeBucket, { moves: number; mistakes: number; blunders: number; avgCpLoss: number }>`
  - `Stats.gamesWithClock: number`

- [ ] **Step 1: Write the failing tests** — append to `src/report/aggregate.test.ts`. (If the file's `mv(...)` helper does not already default `clockSeconds`, add `clockSeconds: null` to its default object so synthetic moves are valid `MoveAnalysis`; existing assertions are unaffected.)

```ts
describe('aggregate — time buckets', () => {
  it('buckets clocked player moves; excludes opponent and clockless moves', () => {
    const g = game({
      moves: [
        mv({ isPlayerMove: true, clockSeconds: 5, severity: 'blunder', cpLoss: 400, type: 'hung_piece' }),
        mv({ isPlayerMove: true, clockSeconds: 20, severity: 'mistake', cpLoss: 100, type: 'positional' }),
        mv({ isPlayerMove: true, clockSeconds: 120, severity: 'ok', cpLoss: 0, type: 'positional' }),
        mv({ isPlayerMove: true, clockSeconds: 8, severity: 'blunder', cpLoss: 600, type: 'lost_position' }),
        mv({ isPlayerMove: false, clockSeconds: 5, severity: 'blunder', cpLoss: 900, type: 'fork' }),
        mv({ isPlayerMove: true, clockSeconds: null, severity: 'blunder', cpLoss: 300, type: 'fork' }),
      ],
    })
    const s = aggregate([g])
    // <10s: clock 5 (mistake/blunder) + clock 8 (lost_position → denominator only)
    expect(s.byTimeBucket['<10s'].moves).toBe(2)
    expect(s.byTimeBucket['<10s'].mistakes).toBe(1)
    expect(s.byTimeBucket['<10s'].blunders).toBe(1)
    expect(s.byTimeBucket['<10s'].avgCpLoss).toBe(400)
    // 10-30s: the cp100 mistake
    expect(s.byTimeBucket['10-30s'].moves).toBe(1)
    expect(s.byTimeBucket['10-30s'].mistakes).toBe(1)
    // 60s+: the ok move is a decision but not a mistake
    expect(s.byTimeBucket['60s+'].moves).toBe(1)
    expect(s.byTimeBucket['60s+'].mistakes).toBe(0)
    expect(s.gamesWithClock).toBe(1)
  })

  it('does not count a game without any clock data', () => {
    const g = game({ moves: [mv({ isPlayerMove: true, clockSeconds: null, severity: 'blunder', cpLoss: 300, type: 'fork' })] })
    expect(aggregate([g]).gamesWithClock).toBe(0)
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npm test -- aggregate`
Expected: FAIL — `byTimeBucket`/`gamesWithClock` undefined.

- [ ] **Step 3: Edit `src/report/aggregate.ts`.**

After the `OpeningStat` type (top of file), add the bucket type + list:

```ts
export type TimeBucket = '<10s' | '10-30s' | '30-60s' | '60s+'
export const TIME_BUCKETS: TimeBucket[] = ['<10s', '10-30s', '30-60s', '60s+']

function clockBucket(sec: number): TimeBucket {
  if (sec < 10) return '<10s'
  if (sec < 30) return '10-30s'
  if (sec < 60) return '30-60s'
  return '60s+'
}
```

Extend the `Stats` type with two fields (add after `lostPositionMoves`):

```ts
  lostPositionMoves: number
  byTimeBucket: Record<TimeBucket, { moves: number; mistakes: number; blunders: number; avgCpLoss: number }>
  gamesWithClock: number
```

In `aggregate`, add the accumulator and a clock counter beside the existing ones (after `let lostPositionMoves = 0`):

```ts
  const timeAcc: Record<TimeBucket, { moves: number; mistakes: number; blunders: number; sum: number }> =
    Object.fromEntries(TIME_BUCKETS.map((b) => [b, { moves: 0, mistakes: 0, blunders: 0, sum: 0 }])) as Record<TimeBucket, { moves: number; mistakes: number; blunders: number; sum: number }>
  let gamesWithClock = 0
```

Inside the `for (const g of games)` loop, add a per-game flag at the top of the loop body (right after the `record` update is fine; place it before the moves loop):

```ts
    let gameHadClock = false
```

Replace the moves loop body so the time-bucket tally happens BEFORE the `lost_position`/`ok` `continue`s:

```ts
    for (const m of g.moves) {
      if (!m.isPlayerMove) continue
      if (m.clockSeconds != null) {
        gameHadClock = true
        const tb = clockBucket(m.clockSeconds)
        timeAcc[tb].moves++
        if (m.type !== 'lost_position' && m.severity !== 'ok') {
          timeAcc[tb].mistakes++
          timeAcc[tb].sum += m.cpLoss
          if (m.severity === 'blunder') timeAcc[tb].blunders++
        }
      }
      if (m.type === 'lost_position') {
        lostPositionMoves++
        continue
      }
      if (m.severity === 'ok') continue
      mistakeCount++
      o.mistakes++
      byPhase[m.phase]++
      typeAcc[m.type].count++
      typeAcc[m.type].sum += m.cpLoss
      if (m.missed) typeAcc[m.type].missed++
      else typeAcc[m.type].allowed++
      if (m.severity === 'blunder') {
        blunders.push({
          url: g.url, ply: m.ply, san: m.san, bestSan: m.bestSan,
          fenBefore: m.fenBefore, cpLoss: m.cpLoss, type: m.type,
        })
      }
    }
    if (gameHadClock) gamesWithClock++
    openingMap.set(key, o)
```

Build `byTimeBucket` near where `byType` is built:

```ts
  const byTimeBucket = Object.fromEntries(
    TIME_BUCKETS.map((b) => [b, {
      moves: timeAcc[b].moves,
      mistakes: timeAcc[b].mistakes,
      blunders: timeAcc[b].blunders,
      avgCpLoss: timeAcc[b].mistakes ? Math.round(timeAcc[b].sum / timeAcc[b].mistakes) : 0,
    }]),
  ) as Stats['byTimeBucket']
```

Add both to the returned object:

```ts
  return {
    gamesAnalyzed: games.length,
    record, mistakeCount, byPhase, byType, openings, topBlunders, lostPositionMoves,
    byTimeBucket, gamesWithClock,
  }
```

- [ ] **Step 4: Run to confirm it passes**

Run: `npm test -- aggregate`
Expected: PASS. Then `npm run build` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/report/aggregate.ts src/report/aggregate.test.ts
git commit -m "feat: aggregate mistakes into clock-remaining time buckets"
```

---

### Task 2: Time-trouble coaching rule

**Files:**
- Modify: `src/report/coach.ts`
- Modify: `src/report/coach.test.ts`

**Interfaces:**
- Consumes: `Stats.byTimeBucket`, `TimeBucket`, `TIME_BUCKETS` (Task 1); existing `examplesFor`, `Suggestion`.
- Produces: an additional suggestion `'Time pressure is costing you'` when the threshold is met.

- [ ] **Step 1: Write the failing tests** — add to `src/report/coach.test.ts`. (Update the test's `base` stats fixture to include `byTimeBucket` with all four buckets zeroed and `gamesWithClock: 0`, so `base` is a valid `Stats`.)

```ts
  it('coaches on time pressure when blunders cluster under 30s', () => {
    const s: Stats = {
      ...base,
      byTimeBucket: {
        '<10s': { moves: 10, mistakes: 4, blunders: 3, avgCpLoss: 400 },
        '10-30s': { moves: 10, mistakes: 2, blunders: 1, avgCpLoss: 200 },
        '30-60s': { moves: 10, mistakes: 1, blunders: 1, avgCpLoss: 150 },
        '60s+': { moves: 20, mistakes: 1, blunders: 0, avgCpLoss: 100 },
      },
    }
    // clockedBlunders = 5, lowClock = 4 → 80% ≥ 40%, ≥3 → fires
    const tp = coach(s).find((x) => x.title === 'Time pressure is costing you')
    expect(tp).toBeTruthy()
    expect(tp!.why).toMatch(/80%/)
    expect(tp!.why).toMatch(/4 of 5/)
  })

  it('does not coach time pressure below threshold', () => {
    const s: Stats = {
      ...base,
      byTimeBucket: {
        '<10s': { moves: 5, mistakes: 1, blunders: 1, avgCpLoss: 400 },
        '10-30s': { moves: 5, mistakes: 0, blunders: 0, avgCpLoss: 0 },
        '30-60s': { moves: 5, mistakes: 1, blunders: 1, avgCpLoss: 150 },
        '60s+': { moves: 5, mistakes: 1, blunders: 1, avgCpLoss: 100 },
      },
    }
    // clockedBlunders = 3, lowClock = 1 → 33% < 40% → no fire
    expect(coach(s).find((x) => x.title === 'Time pressure is costing you')).toBeFalsy()
  })
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npm test -- coach`
Expected: FAIL — no time-pressure suggestion (and/or `base` Stats shape errors until updated).

- [ ] **Step 3: Edit `src/report/coach.ts`.**

Add `TimeBucket` to the import from `./aggregate.js` (it currently imports `Stats`, `BlunderRef`):

```ts
import type { Stats, BlunderRef, TimeBucket } from './aggregate.js'
```

Insert Rule 4 after the Rule 3 (losing openings) loop and BEFORE the final `return out.sort(...)`:

```ts
  // Rule 4: time pressure.
  const buckets = Object.keys(stats.byTimeBucket) as TimeBucket[]
  const clockedBlunders = buckets.reduce((sum, b) => sum + stats.byTimeBucket[b].blunders, 0)
  const lowClockBlunders = stats.byTimeBucket['<10s'].blunders + stats.byTimeBucket['10-30s'].blunders
  if (clockedBlunders >= 3 && lowClockBlunders / clockedBlunders >= 0.4) {
    const pct = Math.round((lowClockBlunders / clockedBlunders) * 100)
    out.push({
      title: 'Time pressure is costing you',
      why: `${pct}% of your blunders (${lowClockBlunders} of ${clockedBlunders}) come with under 30 seconds left.`,
      drill: 'Manage your clock: decide on candidate moves faster in the opening and middlegame so you keep time for critical positions; practice with increment.',
      impact: lowClockBlunders * 100,
      examples: examplesFor(stats.topBlunders),
    })
  }
```

Note: Rule 4 runs even though the function early-returns `[]` when `stats.mistakeCount === 0` — that early return is fine (no mistakes ⇒ no blunders ⇒ rule wouldn't fire anyway).

- [ ] **Step 4: Run to confirm it passes**

Run: `npm test -- coach`
Expected: PASS. Then `npm run build` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/report/coach.ts src/report/coach.test.ts
git commit -m "feat: time-trouble coaching rule"
```

---

### Task 3: Render the Time pressure section

**Files:**
- Modify: `src/report/render.ts`
- Modify: `src/report/render.test.ts`

**Interfaces:**
- Consumes: `Stats.byTimeBucket`, `Stats.gamesWithClock`, `TimeBucket`, `TIME_BUCKETS`.
- Produces: a "Time pressure" markdown section and a terminal block.

- [ ] **Step 1: Write the failing tests** — add to `src/report/render.test.ts`. (Update the test's `stats` fixture to include `byTimeBucket` with all four buckets zeroed and `gamesWithClock: 0` so it is a valid `Stats`.)

```ts
  it('renders the time-pressure table when clock data exists', () => {
    const s: Stats = {
      ...stats,
      gamesWithClock: 3,
      byTimeBucket: {
        '<10s': { moves: 8, mistakes: 4, blunders: 3, avgCpLoss: 400 },
        '10-30s': { moves: 10, mistakes: 2, blunders: 1, avgCpLoss: 200 },
        '30-60s': { moves: 0, mistakes: 0, blunders: 0, avgCpLoss: 0 },
        '60s+': { moves: 20, mistakes: 1, blunders: 0, avgCpLoss: 100 },
      },
    }
    const md = renderMarkdown(s, [], { user: 'bob', since: '2025-06', depth: 15 })
    expect(md).toContain('## Time pressure')
    expect(md).toContain('Clock data: 3 of')
    expect(md).toContain('<10s')
    expect(md).toContain('38%') // 3/8 blunder rate rounds to 38%
    expect(md).not.toContain('| 30-60s |') // zero-move bucket skipped
  })

  it('omits the time-pressure table when there is no clock data', () => {
    const s: Stats = { ...stats, gamesWithClock: 0 }
    const md = renderMarkdown(s, [], { user: 'bob', since: '2025-06', depth: 15 })
    expect(md).toContain('No clock data in these games')
    expect(md).not.toContain('| Clock |')
  })
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npm test -- render`
Expected: FAIL — no time-pressure section (and/or fixture shape errors until updated).

- [ ] **Step 3: Edit `src/report/render.ts`.**

Add `TimeBucket`/`TIME_BUCKETS` to the import from `./aggregate.js` (currently `import type { Stats } from './aggregate.js'`):

```ts
import type { Stats, TimeBucket } from './aggregate.js'
import { TIME_BUCKETS } from './aggregate.js'
```

In `renderMarkdown`, insert the Time pressure section AFTER the "Mistake types" block (after its trailing `lines.push('')`) and BEFORE the "## Openings" block:

```ts
  lines.push('## Time pressure')
  if (stats.gamesWithClock === 0) {
    lines.push('')
    lines.push('_No clock data in these games._')
  } else {
    lines.push(`Clock data: ${stats.gamesWithClock} of ${stats.gamesAnalyzed} games`)
    lines.push('')
    lines.push('| Clock | Moves | Mistakes | Blunders | Blunder rate | Avg cpLoss |')
    lines.push('|---|---|---|---|---|---|')
    for (const b of TIME_BUCKETS) {
      const e = stats.byTimeBucket[b]
      if (e.moves === 0) continue
      const rate = `${Math.round((e.blunders / e.moves) * 100)}%`
      lines.push(`| ${b} | ${e.moves} | ${e.mistakes} | ${e.blunders} | ${rate} | ${e.avgCpLoss} |`)
    }
  }
  lines.push('')
```

In `renderTerminal`, insert a block AFTER the "Mistake types" loop (after its trailing `lines.push('')`) and BEFORE `lines.push('Top suggestions:')`:

```ts
  if (stats.gamesWithClock > 0) {
    lines.push(`Time pressure (clock data: ${stats.gamesWithClock}/${stats.gamesAnalyzed} games):`)
    for (const b of TIME_BUCKETS) {
      const e = stats.byTimeBucket[b]
      if (!e.moves) continue
      const rate = Math.round((e.blunders / e.moves) * 100)
      lines.push(`  ${b}: ${e.moves} moves, ${e.blunders} blunders (${rate}%)`)
    }
    lines.push('')
  }
```

- [ ] **Step 4: Run to confirm it passes**

Run: `npm test -- render`
Expected: PASS. Then full `npm test` and `npm run build` — both clean.

- [ ] **Step 5: Commit**

```bash
git add src/report/render.ts src/report/render.test.ts
git commit -m "feat: render time-pressure section in report and terminal"
```

---

## Self-Review Notes (addressed)

- **Spec coverage:** byTimeBucket + gamesWithClock (T1), coach rule with the 40%/≥3 thresholds (T2), markdown table + terminal block + no-clock-data omission (T3). The "lost_position counts toward `moves` but not mistakes" rule is implemented by tallying buckets before the `lost_position`/`ok` `continue`s (T1 Step 3) and tested (T1 Step 1, the clock-8 lost_position move → `moves` 2 / `mistakes` 1).
- **Type consistency:** `TimeBucket`/`TIME_BUCKETS` defined in aggregate (T1) and imported by coach (T2) and render (T3); `byTimeBucket` value shape `{moves,mistakes,blunders,avgCpLoss}` identical across all three; `gamesWithClock`/`gamesAnalyzed` used consistently.
- **Placeholders:** none — every step has complete code.
- **No out-of-scope changes:** engine, parser, game, cache untouched; `clockSeconds` is consumed as-is.
- **Fixtures:** each test task updates its file's shared fixture (`base`/`stats`/`mv` default) to include the new `Stats` fields so existing tests keep compiling — called out in each Step 1.
