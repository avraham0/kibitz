import { readFile } from 'node:fs/promises'
import { join, extname, normalize, resolve, sep } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { monthsSince } from '../api/chesscom.js'

type Deps = { staticDir: string }

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
}

const CHESS_COM = 'https://api.chess.com/pub/player'

export function createHandler(deps: Deps) {
  return function handler(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname === '/api/games') {
      void handleGames(url, res)
      return
    }
    void handleStatic(deps.staticDir, url.pathname, res)
  }
}

// Proxy chess.com game archives to avoid CORS. Fetches all months since `since`
// and returns the raw game objects as a JSON array.
async function handleGames(url: URL, res: ServerResponse): Promise<void> {
  const user = url.searchParams.get('user')
  const since = url.searchParams.get('since')
  const nowISO = url.searchParams.get('nowISO') ?? new Date().toISOString()
  if (!user || !since) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Missing user or since' }))
    return
  }
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  try {
    const months = monthsSince(since, nowISO)
    const all: unknown[] = []
    for (const ym of months) {
      const r = await fetch(`${CHESS_COM}/${encodeURIComponent(user)}/games/${ym}`)
      if (r.status === 404) throw new Error(`Unknown chess.com user: ${user}`)
      if (!r.ok) continue
      const data = await r.json() as { games?: unknown[] }
      all.push(...(data.games ?? []))
    }
    res.end(JSON.stringify(all))
  } catch (err) {
    res.end(JSON.stringify({ error: String((err as Error)?.message ?? err) }))
  }
}

async function handleStatic(staticDir: string, pathname: string, res: ServerResponse): Promise<void> {
  const rel = pathname === '/' ? 'index.html' : normalize(pathname).replace(/^(\.\.[/\\])+/, '').replace(/^\//, '')
  const requested = resolve(staticDir, rel)
  const root = resolve(staticDir)
  const safeRequested = (requested === root || requested.startsWith(root + sep)) ? requested : null
  const tryPaths = [safeRequested, join(staticDir, 'index.html')].filter((p): p is string => p !== null)
  for (const p of tryPaths) {
    try {
      const buf = await readFile(p)
      res.writeHead(200, { 'Content-Type': CONTENT_TYPES[extname(p)] ?? 'application/octet-stream' })
      res.end(buf)
      return
    } catch { /* try next */ }
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('Web UI not built yet. Run: cd web && npm install && npm run build')
}
