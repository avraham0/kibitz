export type MistakeType =
  | 'hung_piece' | 'missed_tactic' | 'bad_trade' | 'king_safety' | 'positional' | 'lost_position'
  | 'fork' | 'pin' | 'skewer' | 'discovered_attack' | 'trapped_piece' | 'back_rank'
export type TimeBucket = '<10s' | '10-30s' | '30-60s' | '60s+'
export type CoachableType = Exclude<MistakeType, 'lost_position'>

export type BlunderRef = { url: string; ply: number; san: string; bestSan: string; fenBefore: string; cpLoss: number; type: MistakeType }
export type OpeningStat = { eco: string; name: string; games: number; wins: number; winPct: number; avgMistakes: number }
export type Phase = 'opening' | 'middlegame' | 'endgame'
export type Color = 'white' | 'black'

export type Stats = {
  gamesAnalyzed: number
  record: { wins: number; losses: number; draws: number }
  mistakeCount: number
  byPhase: Record<Phase, number>
  byType: Record<CoachableType, { count: number; avgCpLoss: number; missed: number; allowed: number }>
  openings: OpeningStat[]
  topBlunders: BlunderRef[]
  lostPositionMoves: number
  byTimeBucket: Record<TimeBucket, { moves: number; mistakes: number; blunders: number; avgCpLoss: number }>
  gamesWithClock: number
  accuracy: number
  accuracyStrict: number
  accuracyByPhase: Record<Phase, number>
  conversion: { winningGames: number; converted: number }
  byColor: Record<Color, { games: number; wins: number; winPct: number; accuracy: number; mistakes: number }>
}
export type Suggestion = { title: string; why: string; drill: string; impact: number; examples: { url: string; fenBefore: string; san: string; bestSan: string }[] }
export type Severity = 'ok' | 'inaccuracy' | 'mistake' | 'blunder'
export type GameMove = {
  ply: number; san: string; bestSan: string; evalCp: number; cpLoss: number
  isPlayerMove: boolean; severity: Severity; type: MistakeType; fenBefore: string
  phase: Phase; clockSeconds: number | null
}
export type GameSummary = {
  gameId: string; url: string; playedAt: string; color: 'white' | 'black'
  result: 'win' | 'loss' | 'draw'; eco: string; openingName: string
  accuracy: number; accuracyStrict: number
  moves: GameMove[]
}
export type AnalyzeResult = { stats: Stats; suggestions: Suggestion[]; meta: { user: string; since: string; depth: number }; games: GameSummary[] }

export const TIME_BUCKETS: TimeBucket[] = ['<10s', '10-30s', '30-60s', '60s+']
export const COACHABLE_TYPES: CoachableType[] = [
  'hung_piece', 'missed_tactic', 'bad_trade', 'king_safety', 'positional',
  'fork', 'pin', 'skewer', 'discovered_attack', 'trapped_piece', 'back_rank',
]
