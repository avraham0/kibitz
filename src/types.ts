export type Color = 'white' | 'black'

export type Eval = { cp: number | null; mate: number | null }

export type Severity = 'ok' | 'inaccuracy' | 'mistake' | 'blunder'

export type MistakeType =
  | 'hung_piece' | 'missed_tactic' | 'bad_trade' | 'king_safety'
  | 'positional' | 'lost_position'
  | 'fork' | 'pin' | 'skewer' | 'discovered_attack' | 'trapped_piece' | 'back_rank'

export type Motif =
  | 'fork' | 'pin' | 'skewer' | 'discovered_attack' | 'trapped_piece' | 'back_rank'

export const MOTIFS: Motif[] = [
  'back_rank', 'fork', 'discovered_attack', 'skewer', 'pin', 'trapped_piece',
]

export type Phase = 'opening' | 'middlegame' | 'endgame'

export type PieceSymbol = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'

export const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 0,
}

export function cpLossToSeverity(cpLoss: number): Severity {
  if (cpLoss >= 300) return 'blunder'
  if (cpLoss >= 100) return 'mistake'
  if (cpLoss >= 50) return 'inaccuracy'
  return 'ok'
}

// One half-move parsed from a PGN, before any engine analysis.
export type RawMove = { san: string; fenBefore: string; clockSeconds: number | null }

// A single game parsed from chess.com, before engine analysis.
export type RawGame = {
  gameId: string
  url: string
  playedAt: string // ISO
  color: Color
  result: 'win' | 'loss' | 'draw'
  eco: string
  openingName: string
  moves: RawMove[] // only the player's-and-opponent's full move list
}

export type MoveAnalysis = {
  ply: number
  fenBefore: string
  san: string
  bestSan: string
  evalBefore: Eval
  evalAfterPlayed: Eval
  cpLoss: number
  severity: Severity
  type: MistakeType
  missed: boolean
  phase: Phase
  clockSeconds: number | null
  isPlayerMove: boolean // true if this move was made by the analyzed player
}

export type GameAnalysis = {
  gameId: string
  url: string
  playedAt: string
  color: Color
  result: 'win' | 'loss' | 'draw'
  eco: string
  openingName: string
  depth: number
  moves: MoveAnalysis[]
}
