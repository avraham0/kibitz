import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHandler } from './handler.js'

function mockReq(url: string) { return { url, method: 'GET' } as any }
function mockRes() {
  const chunks: string[] = []
  let statusCode = 200
  const headers: Record<string, string> = {}
  let resolveEnd!: () => void
  const ended = new Promise<void>((r) => { resolveEnd = r })
  return {
    chunks, get body() { return chunks.join('') }, get statusCode() { return statusCode },
    get headers() { return headers },
    writeHead: (s: number, h?: Record<string, string>) => { statusCode = s; Object.assign(headers, h ?? {}) },
    write: (c: string) => { chunks.push(c); return true },
    end: (c?: string) => { if (c) chunks.push(c); resolveEnd() },
    on: () => {},
    ended,
  } as any
}

afterEach(() => vi.restoreAllMocks())

describe('createHandler — /api/games', () => {
  it('returns 400 when user is missing', async () => {
    const handler = createHandler({ staticDir: '/nonexistent' })
    const res = mockRes()
    handler(mockReq('/api/games?since=2025-01&nowISO=2026-01-01T00:00:00Z'), res)
    await res.ended
    expect(res.statusCode).toBe(400)
    expect(res.body).toContain('error')
  })

  it('proxies chess.com and returns games array', async () => {
    const fakeGames = [{ url: 'https://chess.com/game/1', pgn: 'e4' }]
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => ({ games: fakeGames }) } as any))
    const handler = createHandler({ staticDir: '/nonexistent' })
    const res = mockRes()
    handler(mockReq('/api/games?user=bob&since=2026-01&nowISO=2026-01-15T00:00:00Z'), res)
    await res.ended
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].url).toBe('https://chess.com/game/1')
  })
})

describe('createHandler — static', () => {
  it('serves a build-missing note when absent', async () => {
    const handler = createHandler({ staticDir: '/nonexistent' })
    const res = mockRes()
    handler(mockReq('/'), res)
    await res.ended
    expect(res.body.toLowerCase()).toContain('build')
  })

  it('serves an existing index.html', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cc-static-'))
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>cc</title>')
    const handler = createHandler({ staticDir: dir })
    const res = mockRes()
    handler(mockReq('/'), res)
    await res.ended
    expect(res.body).toContain('<title>cc</title>')
  })
})
