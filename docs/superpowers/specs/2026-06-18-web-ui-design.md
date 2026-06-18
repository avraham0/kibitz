# Web UI — Design

**Date:** 2026-06-18
**Status:** Approved pending spec review
**Builds on:** the chess-coach CLI + motif + time-pressure features (all on `master`)

## Purpose

A local single-user web app: type a chess.com username (and options) into a page, watch
analysis progress live, then explore the results in an interactive dashboard — bar charts
for mistake types / phase / time pressure, an openings table, coaching cards, and a board
that replays each top blunder with the played move and the engine's best move drawn as
arrows. This is the spec's deferred v2 "Web UI" item, in the richer server-backed form.

## Scope

**In scope:**
- A Node HTTP server exposing an SSE analysis endpoint and serving the built frontend.
- A Vite + React + TypeScript frontend: input form, live progress, results dashboard
  with charts and an interactive board for blunder replay.
- Reuse of the entire existing analysis pipeline (fetch → parse → analyze → aggregate →
  coach), including the on-disk cache, with zero changes to its core logic. A small,
  justified refactor extracts the structured-data step so both the CLI and the server
  share it.

**Out of scope:**
- Multi-user / auth / deployment (local single-user only; binds to localhost).
- Persisting past analyses beyond the existing per-game analysis cache.
- LLM coaching (separate v2 item).
- Editing/annotating games; engine analysis of arbitrary positions from the UI.

## Architecture

Two cooperating pieces inside the existing repo:

```
chess-coach/
  src/                      # existing CLI + analysis (unchanged core)
    orchestrate.ts          # refactor: extract analyze() returning structured data
    server/
      server.ts             # node:http server: /api/analyze (SSE) + static assets
      analyze-stream.ts     # adapts analyze() onProgress → SSE events
      serve.ts              # entrypoint: capture real fetch, then start server
  web/                      # Vite + React frontend (its own package.json)
    index.html, src/*.tsx, vite.config.ts
    dist/                   # `vite build` output, served by server.ts in prod
```

**Why a separate `web/` package:** keeps the heavy frontend dev deps (Vite, React,
recharts, react-chessboard) out of the CLI's runtime dependency set. The backend stays
dependency-light (Node built-ins only).

**Dev vs prod:**
- Dev: run the Node API server and the Vite dev server; Vite proxies `/api` to the Node
  server (configured in `vite.config.ts`).
- Prod/normal use: `npm run build` in `web/` produces `web/dist`; the Node server serves
  those static files and the API on one port. A root script `serve` boots it.

## Backend

### Refactor: extract structured analysis (`src/orchestrate.ts`)

Add `analyze(opts, onProgress?)` returning the structured data; reimplement `run()` on
top of it (so the CLI is unchanged in behavior):

```ts
export type AnalyzeResult = {
  stats: Stats
  suggestions: Suggestion[]
  meta: { user: string; since: string; depth: number }
}
export async function analyze(
  opts: { user; since; depth; last?; root?; nowISO; evaluate; fetchFn? },
  onProgress?: (done: number, total: number) => void,
): Promise<AnalyzeResult>
// run() = analyze() + renderMarkdown/renderTerminal (existing return shape preserved)
```

`onProgress` is called once per game as the existing loop advances (the same point that
currently writes "analyzed N/M" to stderr).

### Server (`src/server/server.ts`)

A `node:http` server. Routes:

- `GET /api/analyze?user=<u>&last=<n>&depth=<d>&since=<YYYY-MM>` — **SSE stream**
  (`Content-Type: text/event-stream`). EventSource-compatible (GET, query params).
  - Validates params: `user` required (else `400`); `depth` default 15, `last` optional,
    `since` default = `defaultSince(nowISO)`.
  - Boots the engine, runs `analyze()` with an `onProgress` that writes
    `event: progress\ndata: {"done":N,"total":M}\n\n`.
  - On success: `event: result\ndata: <AnalyzeResult JSON>\n\n`, then closes.
  - On failure (e.g. unknown user): `event: error\ndata: {"message":"..."}\n\n`, then closes.
  - **Concurrency:** a module-level busy lock — if an analysis is already running, respond
    `409` with a small JSON body. (Single-user UI won't trigger this; the lock prevents
    accidental engine contention.)
  - Quits the engine in a `finally`.
- `GET /` and other paths — serve static files from `web/dist` (with a small content-type
  map; SPA fallback to `index.html` for unknown non-`/api` paths). If `web/dist` is
  missing, serve a one-line message telling the user to run the web build.

### Entrypoint (`src/server/serve.ts`)

Mirrors `cli.ts`'s fetch-safety: capture `const realFetch = globalThis.fetch.bind(globalThis)`
FIRST, then dynamically `import('../engine/stockfish.js')` (the WASM package clobbers
`globalThis.fetch` at load), pass `realFetch` into `analyze()`. Reads `--port` (default
`5173`), prints the URL. Added as a root `package.json` script: `"serve"`.

### SSE adapter (`src/server/analyze-stream.ts`)

A pure-ish helper `writeSse(res, event, data)` that formats one SSE message, plus the glue
that maps `analyze`'s `onProgress`/result/error to `writeSse` calls. Kept separate so the
event formatting is unit-testable without a socket.

## Frontend (`web/`)

Vite + React + TypeScript. Components (one responsibility each):

- `AnalyzeForm` — inputs: username (required), last N, depth (default 15), since
  (optional month). Submit triggers the stream. Disabled while running.
- `useAnalyzeStream` (hook) — opens an `EventSource` to `/api/analyze?…`; exposes
  `{ status: 'idle'|'running'|'done'|'error', progress: {done,total}|null, result, error }`.
  Parses `progress` / `result` / `error` events; closes the source on done/error.
- `ProgressBar` — shows `done/total` and a bar while `status==='running'`.
- `Dashboard` (shown when `result` present) composed of:
  - `SummaryCard` — record (W-L-D), games analyzed, total mistakes, moves-in-lost-positions.
  - `MistakeTypesChart` — recharts stacked bar per type, split missed vs allowed; only
    non-zero types.
  - `PhaseChart` — recharts bar: opening/middlegame/endgame counts.
  - `TimePressureChart` — recharts bar of blunder-rate per clock bucket; rendered only
    when `stats.gamesWithClock > 0`, else a "No clock data" note. Shows "Clock data: N of M".
  - `OpeningsTable` — ECO, opening, games, win%, avg mistakes.
  - `BlunderList` — for each `topBlunder`: a `react-chessboard` at `fenBefore` with two
    arrows (played move red, best move green) + a caption (`Played Nh7 · Best Rfd8 ·
    −NNN cp · <type>`) and a link to the chess.com analysis board. Arrows' from/to squares
    are derived in the browser via **chess.js** (added as a `web/` dep) from `fenBefore`
    + `san`/`bestSan`.
  - `CoachingCards` — one card per suggestion: title, why, drill, example links.

**Shared types:** the frontend imports the existing TS types (`Stats`, `Suggestion`,
`BlunderRef`, `TimeBucket`) as **type-only** imports from `../src/report/*` via a Vite
path alias (erased at build, no runtime coupling). If the cross-package type import proves
awkward under separate tsconfigs, fall back to a single `web/src/api-types.ts` that
re-declares the `AnalyzeResult` shape (documented duplication).

## Data Flow

```
AnalyzeForm submit
  → useAnalyzeStream opens EventSource GET /api/analyze?user&last&depth&since
  → server: 409 if busy; else boot engine, analyze() with onProgress
       → SSE: progress {done,total} × N  → ProgressBar updates
       → SSE: result {stats,suggestions,meta}  → Dashboard renders
       (or SSE: error {message} → error UI)
  → engine.quit() in finally; busy lock released
```

## Error Handling

- Unknown chess.com user / network error → `event: error` with a readable message;
  frontend shows it and re-enables the form.
- Concurrent request → `409`; frontend shows "an analysis is already running."
- Missing `web/dist` → server serves a clear "run the web build first" message.
- Engine boot failure → surfaced as an `error` event.

## Testing

- **Backend (vitest, no engine/network):**
  - `analyze()` extraction returns `{stats,suggestions,meta}` and calls `onProgress` once
    per game (injected `evaluate`/`fetchFn`, reuse existing fixtures).
  - `writeSse` formats `event:`/`data:`/blank-line framing exactly.
  - The `/api/analyze` handler, given an injected `analyze`, streams `progress` then
    `result` events; returns `400` on missing `user`; returns `409` when the busy lock is
    held. Use Node's `http` with a real loopback request, or call the handler with mock
    `req`/`res` capturing written chunks.
  - Static handler: returns `index.html` for `/`, correct content-type for an asset,
    SPA fallback for an unknown path, the build-missing message when `web/dist` absent.
- **Frontend (vitest + React Testing Library, jsdom):**
  - `useAnalyzeStream` against a mock `EventSource`: progress updates state; result
    populates; error sets error.
  - `Dashboard` renders all panels from a sample `AnalyzeResult`; `TimePressureChart`
    omitted when `gamesWithClock === 0`; `BlunderList` renders a board per blunder.
  - `AnalyzeForm` validates required username and disables while running.

## Implementation Decomposition

Large but cohesive. The implementation plan will split into two phases that each produce
working, testable software:
1. **Backend phase** — `analyze()` refactor, SSE server, entrypoint, backend tests
   (verifiable with `curl` against `/api/analyze` and the unit tests).
2. **Frontend phase** — Vite/React scaffold, hook, form, dashboard panels, board, charts,
   frontend tests; wired to the backend.

## Limitations / Notes

- SSE via `EventSource` is GET-only, so analysis parameters travel as query params — fine
  for the small, non-sensitive param set.
- One analysis at a time (busy lock); acceptable for a local single-user tool.
- The board arrows depend on `san`/`bestSan` parsing in the browser; if a SAN fails to
  parse for an exotic case, that blunder renders the board without arrows (graceful).
- Binds to localhost only; not hardened for exposure to a network.
