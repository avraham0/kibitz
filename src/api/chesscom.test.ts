import { describe, it, expect, vi } from 'vitest'
import { monthsSince, fetchGamesSince } from './chesscom.js'

describe('monthsSince', () => {
  it('lists YYYY/MM from start through now inclusive', () => {
    expect(monthsSince('2025-11', '2026-01-15T00:00:00Z')).toEqual([
      '2025/11', '2025/12', '2026/01',
    ])
  })
  it('handles a single month', () => {
    expect(monthsSince('2026-01', '2026-01-15T00:00:00Z')).toEqual(['2026/01'])
  })
})

describe('fetchGamesSince', () => {
  it('only fetches archives within the window and concatenates games', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.endsWith('2026/01')) {
        return new Response(JSON.stringify({ games: [{ url: 'g1' }] }), { status: 200 })
      }
      return new Response(JSON.stringify({ games: [] }), { status: 200 })
    })
    const games = await fetchGamesSince('bob', '2026-01', '2026-01-10T00:00:00Z', fetchFn as any)
    expect(games).toEqual([{ url: 'g1' }])
    expect(fetchFn).toHaveBeenCalledWith('https://api.chess.com/pub/player/bob/games/2026/01')
  })

  it('throws a clear error on 404', async () => {
    const fetchFn = vi.fn(async () => new Response('', { status: 404 }))
    await expect(
      fetchGamesSince('nobody', '2026-01', '2026-01-10T00:00:00Z', fetchFn as any),
    ).rejects.toThrow('Unknown chess.com user: nobody')
  })

  it('percent-encodes a username containing a slash in the request URL', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ games: [] }), { status: 200 }))
    await fetchGamesSince('a/b', '2026-01', '2026-01-10T00:00:00Z', fetchFn as any)
    const calledUrl: string = fetchFn.mock.calls[0][0]
    expect(calledUrl).toContain('a%2Fb')
    expect(calledUrl).not.toMatch(/\/a\/b\//)
  })
})
