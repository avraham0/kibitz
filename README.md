# Kibitz — chess game review

Analyze your chess.com games with Stockfish and turn your mistakes into a coaching
dashboard: ranked weaknesses, blunder puzzles, opening drills, and stats — all in the
browser.

## Prerequisites

- **Node.js 20+** and npm
- **Stockfish** (optional but recommended). A WASM engine is bundled and used
  automatically, but a native binary is ~5–10× faster:
  ```
  brew install stockfish        # macOS
  ```
  Kibitz uses a native `stockfish` on your `PATH` if present, otherwise falls back to
  the bundled WASM build. Override the path with `STOCKFISH_PATH=/path/to/stockfish`.

## Run the web app (recommended)

From the repo root:

```bash
# 1. Install dependencies (root + web)
npm install
cd web && npm install && cd ..

# 2. Build the web UI (outputs to web/dist, which the server serves)
cd web && npm run build && cd ..

# 3. (recommended) install a native Stockfish for much faster analysis
brew install stockfish

# 4. Start the server
npm run serve

# …or run more engines in parallel on a multi-core machine:
npm run serve -- --concurrency 8
```

Then open **http://127.0.0.1:5173** and enter a chess.com username.

Options (note the `--` that passes flags through to the script):

```bash
npm run serve -- --port 5173 --concurrency 8 --host 127.0.0.1
```

- `--port` — port to listen on (default `5173`)
- `--concurrency` — number of parallel Stockfish engines (default: scales to your
  machine, capped low). Raise it on a fast multi-core machine to analyze faster.
- `--host` — bind address (default `127.0.0.1`; use `0.0.0.0` to expose on your network)

> Rebuild the web UI (`cd web && npm run build`) after changing anything under `web/`.

## Command-line report

Generate a terminal/Markdown report without the web UI:

```bash
npm run dev -- --user <chesscom-username> [options]
```

Options:

- `--user <name>` — chess.com username (required)
- `--since YYYY-MM` — analyze games since this month (default: recent window)
- `--last N` — only the most recent N games in the window
- `--depth N` — Stockfish search depth (default `18`)
- `--concurrency N` — parallel engines
- `--time-control <bullet|blitz|rapid|daily>` — filter by time control
- `--variations` — keep each specific opening line separate instead of grouping by family
- `--out report.md` — also write the full Markdown report to a file

Example:

```bash
npm run dev -- --user hikaru --last 50 --time-control blitz --out hikaru.md
```

## Run with Docker

No Node or Stockfish install needed — the image bundles both.

```bash
docker build -t kibitz .
docker run -p 5173:5173 kibitz
```

Open **http://localhost:5173**.

To hand the image to someone else:

```bash
docker save kibitz | gzip > kibitz.tar.gz
# they run:
docker load < kibitz.tar.gz
docker run -p 5173:5173 kibitz
```

## Standalone macOS binary

Build a single self-contained executable (embeds the web UI):

```bash
npm run build:mac      # produces ./kibitz-mac
./kibitz-mac           # then open http://127.0.0.1:5173
```

Requires a native Stockfish at runtime (`brew install stockfish`). If macOS Gatekeeper
blocks it: `xattr -d com.apple.quarantine kibitz-mac`.

## Opening book (optional)

Drop a Polyglot opening book at `~/.kibitz/book.bin` (or `web/public/book.bin`) to enrich
opening analysis. It's optional — everything works without it.

## Tests

```bash
npm test               # server tests
cd web && npm test     # web tests
```
