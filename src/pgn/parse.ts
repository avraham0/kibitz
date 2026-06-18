import { Chess } from 'chess.js'
import type { RawGame, RawMove, Color } from '../types.js'

function clockToSeconds(comment: string | undefined): number | null {
  if (!comment) return null
  const m = comment.match(/\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/)
  if (!m) return null
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Math.floor(Number(m[3]))
}

/**
 * Extract per-ply clock comments from PGN movetext.
 *
 * chess.js 1.x does not expose `.comment` on verbose history entries, so we
 * parse the clocks directly from the raw PGN string.  The approach:
 *   1. Strip the header section (everything up to the first blank line).
 *   2. Remove move numbers (e.g. "1." / "12...").
 *   3. Walk the remaining tokens: when we see a move token (no braces) we
 *      record the index; the very next `{...}` token (if any) is its clock
 *      comment.
 */
function extractClocks(pgn: string): (string | null)[] {
  // Normalize Windows CRLF to LF so the header/movetext boundary is found
  // reliably regardless of the line-ending style used by the source API.
  const normalized = pgn.replace(/\r\n/g, '\n')
  // Strip PGN headers — they end at the first blank line
  const movetextStart = normalized.indexOf('\n\n')
  const movetext = movetextStart >= 0 ? normalized.slice(movetextStart) : normalized

  // Tokenise: pull out {...} comment blocks and bare words
  const tokens: string[] = []
  const re = /\{[^}]*\}|[^\s{}]+/g
  let match: RegExpExecArray | null
  while ((match = re.exec(movetext)) !== null) {
    tokens.push(match[0])
  }

  // Walk tokens: non-comment tokens that are not move-numbers or result
  // markers are SAN moves; their clock is the immediately following comment.
  const moveNumberRe = /^\d+\.+$/
  const resultRe = /^(1-0|0-1|1\/2-1\/2|\*)$/
  const clocks: (string | null)[] = []

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.startsWith('{')) continue          // comment — handled as look-ahead
    if (moveNumberRe.test(t)) continue       // move number
    if (resultRe.test(t)) continue           // result token

    // This is a SAN move — look ahead for a clock comment
    const next = tokens[i + 1]
    if (next && next.startsWith('{')) {
      clocks.push(next.slice(1, -1)) // strip surrounding { }
    } else {
      clocks.push(null)
    }
  }

  return clocks
}

export function parseGame(raw: any, user: string): RawGame | null {
  const chess = new Chess()
  try {
    chess.loadPgn(raw.pgn)
  } catch {
    return null
  }

  const u = user.toLowerCase()
  const whiteName = (raw.white?.username ?? '').toLowerCase()
  const blackName = (raw.black?.username ?? '').toLowerCase()
  let color: Color
  if (whiteName === u) color = 'white'
  else if (blackName === u) color = 'black'
  else return null

  const header = chess.header()
  const resultStr = header.Result ?? '*'
  let result: 'win' | 'loss' | 'draw' = 'draw'
  if (resultStr === '1-0') result = color === 'white' ? 'win' : 'loss'
  else if (resultStr === '0-1') result = color === 'black' ? 'win' : 'loss'

  // chess.js 1.x verbose history includes `before` (FEN before the move)
  // but does NOT include `.comment`.  We fall back to parsing clocks from
  // the raw PGN movetext.
  const verbose = chess.history({ verbose: true }) as any[]
  const clocks = extractClocks(raw.pgn)

  const moves: RawMove[] = verbose.map((mv, i) => ({
    san: mv.san,
    fenBefore: mv.before as string,
    clockSeconds: clockToSeconds(clocks[i] ?? undefined),
  }))

  return {
    gameId: raw.url,
    url: raw.url,
    playedAt: new Date((raw.end_time ?? 0) * 1000).toISOString(),
    color,
    result,
    eco: header.ECO ?? 'Unknown',
    openingName: (() => {
      if (header.Opening && header.Opening.trim()) return header.Opening.trim()
      if (header.ECOUrl) {
        const m = header.ECOUrl.match(/\/openings\/([^/?#]+)/)
        if (m) return m[1].replace(/-/g, ' ')
      }
      return 'Unknown'
    })(),
    moves,
  }
}
