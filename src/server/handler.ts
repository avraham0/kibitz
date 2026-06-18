import { readFile } from 'node:fs/promises'
import { join, extname, normalize, resolve, sep } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { writeSse } from './sse.js'
import { defaultSince, type AnalyzeResult } from '../orchestrate.js'

type AnalyzeFn = (
  opts: { user: string; since: string; depth: number; last?: number; nowISO: string },
  onProgress: (done: number, total: number) => void,
) => Promise<AnalyzeResult>

type Deps = { analyze: AnalyzeFn; staticDir: string; nowISO: () => string }

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.map': 'application/json; charset=utf-8',
}

let busy = false

export function createHandler(deps: Deps) {
  return function handler(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname === '/api/analyze') {
      void handleAnalyze(deps, url, res)
      return
    }
    void handleStatic(deps.staticDir, url.pathname, res)
  }
}

async function handleAnalyze(deps: Deps, url: URL, res: ServerResponse): Promise<void> {
  const user = url.searchParams.get('user')
  if (!user) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: 'Missing required "user" parameter' }))
    return
  }
  if (busy) {
    res.writeHead(409, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: 'An analysis is already running' }))
    return
  }
  busy = true
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  const write = (c: string) => res.write(c)
  try {
    const nowISO = deps.nowISO()
    const since = url.searchParams.get('since') ?? defaultSince(nowISO)
    const depth = Number(url.searchParams.get('depth') ?? '15')
    const lastParam = url.searchParams.get('last')
    const last = lastParam ? Number(lastParam) : undefined
    const result = await deps.analyze(
      { user, since, depth, last, nowISO },
      (done, total) => writeSse(write, 'progress', { done, total }),
    )
    writeSse(write, 'result', result)
  } catch (err) {
    writeSse(write, 'error', { message: String((err as Error)?.message ?? err) })
  } finally {
    busy = false
    res.end()
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
