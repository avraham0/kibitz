import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHandler } from './handler.js'
import type { AnalyzeResult } from '../orchestrate.js'

// minimal mock req/res
function mockReq(url: string) { return { url, method: 'GET' } as any }
function mockRes() {
  const chunks: string[] = []
  let statusCode = 200
  const headers: Record<string, string> = {}
  let resolveEnd: () => void
  const ended = new Promise<void>((r) => { resolveEnd = r })
  return {
    chunks, get body() { return chunks.join('') }, get statusCode() { return statusCode },
    setHeader: (k: string, v: string) => { headers[k] = v }, get headers() { return headers },
    writeHead: (s: number, h?: Record<string, string>) => { statusCode = s; Object.assign(headers, h ?? {}) },
    write: (c: string) => { chunks.push(c); return true },
    end: (c?: string) => { if (c) chunks.push(c); resolveEnd() },
    on: () => {}, // res.on('close', …) — no-op in the mock
    ended,
  } as any
}

const sample: AnalyzeResult = {
  stats: { gamesAnalyzed: 1 } as any, suggestions: [], meta: { user: 'bob', since: '2025-06', depth: 15 }, games: [],
}

describe('createHandler — /api/analyze', () => {
  it('streams progress then result', async () => {
    const analyze = async (_opts: any, onProgress: any) => { onProgress(1, 1); return sample }
    const handler = createHandler({ analyze, staticDir: '/nonexistent', nowISO: () => '2026-06-18T00:00:00Z' })
    const res = mockRes()
    handler(mockReq('/api/analyze?user=bob&depth=8'), res)
    await res.ended
    expect(res.headers['Content-Type']).toContain('text/event-stream')
    expect(res.body).toContain('event: progress')
    expect(res.body).toContain('"done":1')
    expect(res.body).toContain('event: result')
    expect(res.body).toContain('"user":"bob"')
  })

  it('returns 400 when user is missing', async () => {
    const analyze = async () => sample
    const handler = createHandler({ analyze, staticDir: '/nonexistent', nowISO: () => '2026-06-18T00:00:00Z' })
    const res = mockRes()
    handler(mockReq('/api/analyze?depth=8'), res)
    await res.ended
    expect(res.statusCode).toBe(400)
  })

  it('returns 409 when an analysis is already running', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    const analyze = async (_o: any, onP: any) => { await gate; onP(1, 1); return sample }
    const handler = createHandler({ analyze, staticDir: '/nonexistent', nowISO: () => '2026-06-18T00:00:00Z' })
    const res1 = mockRes(); handler(mockReq('/api/analyze?user=a'), res1) // starts, holds busy
    const res2 = mockRes(); handler(mockReq('/api/analyze?user=b'), res2) // busy → 409
    await res2.ended
    expect(res2.statusCode).toBe(409)
    release(); await res1.ended // release lock so other tests aren't affected
  })
})

describe('createHandler — static', () => {
  it('serves index.html for / and a build-missing note when absent', async () => {
    const handler = createHandler({ analyze: async () => sample, staticDir: '/nonexistent', nowISO: () => '' })
    const res = mockRes()
    handler(mockReq('/'), res)
    await res.ended
    expect(res.body.toLowerCase()).toContain('build')
  })

  it('serves an existing index.html', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cc-static-'))
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>cc</title>')
    const handler = createHandler({ analyze: async () => sample, staticDir: dir, nowISO: () => '' })
    const res = mockRes()
    handler(mockReq('/'), res)
    await res.ended
    expect(res.body).toContain('<title>cc</title>')
  })
})
