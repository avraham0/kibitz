import { Chess } from 'chess.js'
import type { RawGame, RawMove, Color } from '../types.js'

type FetchFn = typeof fetch

// lichess "speed" → the bullet|blitz|rapid|daily buckets the rest of the app uses.
const SPEED_TO_TC: Record<string, string> = {
  ultraBullet: 'bullet', bullet: 'bullet', blitz: 'blitz',
  rapid: 'rapid', classical: 'rapid', correspondence: 'daily',
}

// YYYY-MM → epoch ms at the start of that month (UTC), for lichess's `since` param.
function monthStartMs(sinceYYYYMM: string | undefined): number | undefined {
  if (!sinceYYYYMM) return undefined
  const [y, m] = sinceYYYYMM.split('-').map(Number)
  if (!y || !m) return undefined
  return Date.UTC(y, m - 1, 1)
}

// Convert one lichess game (ndjson row) into the internal RawGame shape.
export function parseLichessGame(g: any, user: string): RawGame | null {
  if (!g || g.variant !== 'standard' || typeof g.moves !== 'string') return null
  const u = user.toLowerCase()
  const wName = (g.players?.white?.user?.name ?? '').toLowerCase()
  const bName = (g.players?.black?.user?.name ?? '').toLowerCase()
  let color: Color
  if (wName === u) color = 'white'
  else if (bName === u) color = 'black'
  else return null

  let result: 'win' | 'loss' | 'draw' = 'draw'
  if (g.winner === 'white') result = color === 'white' ? 'win' : 'loss'
  else if (g.winner === 'black') result = color === 'black' ? 'win' : 'loss'

  // Replay SAN to recover the position before each move (the engine needs fenBefore).
  const sans = g.moves.trim() ? g.moves.trim().split(/\s+/) : []
  const chess = new Chess()
  const moves: RawMove[] = []
  for (const san of sans) {
    const before = chess.fen()
    let mv
    try { mv = chess.move(san) } catch { break }
    if (!mv) break
    moves.push({ san: mv.san, fenBefore: before, clockSeconds: null })
  }
  if (moves.length === 0) return null

  const wElo = typeof g.players?.white?.rating === 'number' ? g.players.white.rating : null
  const bElo = typeof g.players?.black?.rating === 'number' ? g.players.black.rating : null

  return {
    gameId: g.id,
    url: `https://lichess.org/${g.id}`,
    playedAt: new Date(g.createdAt ?? 0).toISOString(),
    color,
    result,
    eco: g.opening?.eco ?? 'Unknown',
    openingName: g.opening?.name ?? 'Unknown',
    playerRating: color === 'white' ? wElo : bElo,
    opponentRating: color === 'white' ? bElo : wElo,
    timeControl: SPEED_TO_TC[g.speed] ?? g.speed,
    moves,
  }
}

// Fetch a user's games from lichess as parsed RawGames, newest first. lichess returns
// ndjson and supports `max` + `since`, so (unlike chess.com) one request gets exactly
// the recent games we want.
export async function fetchLichessGames(
  user: string,
  since: string | undefined,
  fetchFn: FetchFn = fetch,
  max?: number,
): Promise<RawGame[]> {
  const params = new URLSearchParams({ opening: 'true', moves: 'true', sort: 'dateDesc' })
  const sinceMs = monthStartMs(since)
  if (sinceMs) params.set('since', String(sinceMs))
  if (max && max > 0) params.set('max', String(max))
  const res = await fetchFn(`https://lichess.org/api/games/user/${encodeURIComponent(user)}?${params.toString()}`, {
    headers: { Accept: 'application/x-ndjson' },
  })
  if (res.status === 404) throw new Error(`Unknown lichess user: ${user}`)
  if (!res.ok) throw new Error(`lichess request failed (${res.status})`)
  const text = await res.text()
  const out: RawGame[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const parsed = parseLichessGame(JSON.parse(trimmed), user)
      if (parsed) out.push(parsed)
    } catch { /* skip malformed row */ }
  }
  return out
}
