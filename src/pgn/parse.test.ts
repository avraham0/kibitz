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
  white: { username: 'alice', rating: 1500 },
  black: { username: 'bob', rating: 1620 },
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
    expect(g.playerRating).toBe(1620) // bob (black)
    expect(g.opponentRating).toBe(1500)
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

  it('trims move-notation tails from ECOUrl-derived opening names', () => {
    const cases: Array<[string, string]> = [
      ['https://www.chess.com/openings/Italian-Game-Giuoco-Piano', 'Italian Game Giuoco Piano'],
      ['https://www.chess.com/openings/Philidor-Defense-3.Bc4', 'Philidor Defense'],
      ['https://www.chess.com/openings/Colle-System-3...e6-4.Bd3-b6', 'Colle System'],
      ['https://www.chess.com/openings/Kings-Fianchetto-Opening...2.Bg2-Nf6', 'Kings Fianchetto Opening'],
      ['https://www.chess.com/openings/Four-Knights-Game-Italian-Variation', 'Four Knights Game Italian Variation'],
    ]
    for (const [ecoUrl, expected] of cases) {
      const pgnEco = `[Event "Live Chess"]
[White "alice"]
[Black "bob"]
[Result "0-1"]
[ECO "C50"]
[ECOUrl "${ecoUrl}"]

1. e4 e5 2. Nf3 Nc6 0-1`
      const rawEco = {
        url: 'https://www.chess.com/game/live/trim-test',
        end_time: 1_700_000_000,
        white: { username: 'alice' },
        black: { username: 'bob' },
        pgn: pgnEco,
      }
      const g = parseGame(rawEco, 'bob')!
      expect(g.openingName, `ECOUrl: ${ecoUrl}`).toBe(expected)
    }
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
