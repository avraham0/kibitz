import { describe, it, expect } from 'vitest'
import { parseGame } from './parse.js'

const PGN = `[Event "Live Chess"]
[White "alice"]
[Black "bob"]
[Result "0-1"]
[ECO "C50"]
[Opening "Italian Game"]

1. e4 {[%clk 0:03:00]} e5 {[%clk 0:02:58]} 2. Nf3 {[%clk 0:02:55]} Nc6 {[%clk 0:02:50]} 0-1`

const raw = {
  url: 'https://www.chess.com/game/live/123',
  end_time: 1_700_000_000,
  white: { username: 'alice' },
  black: { username: 'bob' },
  pgn: PGN,
}

describe('parseGame', () => {
  it('parses color, result, opening, and moves from the player POV', () => {
    const g = parseGame(raw, 'BOB')! // case-insensitive
    expect(g.color).toBe('black')
    expect(g.result).toBe('win') // bob is black, black won
    expect(g.eco).toBe('C50')
    expect(g.openingName).toBe('Italian Game')
    expect(g.gameId).toBe('https://www.chess.com/game/live/123')
    expect(g.moves.length).toBe(4)
    expect(g.moves[0].san).toBe('e4')
    expect(g.moves[0].fenBefore).toContain('rnbqkbnr/pppppppp')
    expect(g.moves[0].clockSeconds).toBe(180)
    expect(g.moves[1].clockSeconds).toBe(178)
  })

  it('derives opening name from ECOUrl when Opening header is absent', () => {
    const pgnNoOpening = `[Event "Live Chess"]
[White "alice"]
[Black "bob"]
[Result "0-1"]
[ECO "C50"]
[ECOUrl "https://www.chess.com/openings/Italian-Game-Giuoco-Piano"]

1. e4 e5 2. Nf3 Nc6 0-1`
    const rawNoOpening = {
      url: 'https://www.chess.com/game/live/456',
      end_time: 1_700_000_000,
      white: { username: 'alice' },
      black: { username: 'bob' },
      pgn: pgnNoOpening,
    }
    const g = parseGame(rawNoOpening, 'bob')!
    expect(g.openingName).toBe('Italian Game Giuoco Piano')
  })

  it('prefers Opening header over ECOUrl when both are present', () => {
    const pgnBoth = `[Event "Live Chess"]
[White "alice"]
[Black "bob"]
[Result "0-1"]
[ECO "C50"]
[Opening "Italian Game"]
[ECOUrl "https://www.chess.com/openings/Italian-Game-Giuoco-Piano"]

1. e4 e5 2. Nf3 Nc6 0-1`
    const rawBoth = {
      url: 'https://www.chess.com/game/live/789',
      end_time: 1_700_000_000,
      white: { username: 'alice' },
      black: { username: 'bob' },
      pgn: pgnBoth,
    }
    const g = parseGame(rawBoth, 'bob')!
    expect(g.openingName).toBe('Italian Game')
  })

  it('returns null on malformed pgn', () => {
    expect(parseGame({ ...raw, pgn: 'not a real pgn @@@' }, 'bob')).toBeNull()
  })

  it('parses clocks correctly when PGN uses CRLF line endings', () => {
    const crlfPgn = PGN.replace(/\n/g, '\r\n')
    const crlfRaw = { ...raw, pgn: crlfPgn }
    const g = parseGame(crlfRaw, 'alice')!
    expect(g).not.toBeNull()
    expect(g.moves.length).toBe(4)
    expect(g.moves[0].clockSeconds).toBe(180)
    expect(g.moves[1].clockSeconds).toBe(178)
  })
})
