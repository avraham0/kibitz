import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cachePath, readCached, writeCached } from './store.js'
import type { GameAnalysis } from '../types.js'

let root: string
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'cc-')) })

const sample: GameAnalysis = {
  gameId: 'https://chess.com/game/live/42', url: 'https://chess.com/game/live/42',
  playedAt: '2026-01-01T00:00:00.000Z', color: 'white', result: 'win',
  eco: 'C50', openingName: 'Italian', depth: 15, moves: [],
}

describe('cache store', () => {
  it('builds a depth-keyed sanitized path', () => {
    const p = cachePath('bob', 'https://chess.com/game/live/42', 15, root)
    expect(p).toBe(join(root, 'bob', 'https___chess_com_game_live_42-d15-v2.json'))
  })

  it('sanitizes path-traversal characters in user', () => {
    const p = cachePath('../evil', 'game42', 15, root)
    expect(p).not.toContain('..')
    expect(p.startsWith(root)).toBe(true)
    expect(p).toContain('___evil')
  })

  it('returns null on miss, then round-trips after write', async () => {
    expect(await readCached('bob', sample.gameId, 15, root)).toBeNull()
    await writeCached(sample, 'bob', root)
    const got = await readCached('bob', sample.gameId, 15, root)
    expect(got?.gameId).toBe(sample.gameId)
    expect(got?.depth).toBe(15)
  })

  it('misses when depth differs', async () => {
    await writeCached(sample, 'bob', root)
    expect(await readCached('bob', sample.gameId, 12, root)).toBeNull()
  })
})
