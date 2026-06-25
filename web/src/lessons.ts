import type { CoachableType } from './api-types.js'

// Title-case names for mistake types (UI display).
export const TYPE_NAME: Record<CoachableType, string> = {
  hung_piece: 'Hung pieces',
  missed_tactic: 'Missed tactics',
  bad_trade: 'Bad trades',
  king_safety: 'King safety',
  positional: 'Positional slips',
  fork: 'Forks',
  pin: 'Pins',
  skewer: 'Skewers',
  discovered_attack: 'Discovered attacks',
  trapped_piece: 'Trapped pieces',
  back_rank: 'Back-rank tactics',
}

// One reusable principle per mistake type — the "mental tool" an adult improver
// carries into real games (compression over content). Shown after a puzzle is
// solved/revealed and in the recurring-mistakes profile.
export const LESSON: Record<CoachableType, string> = {
  hung_piece: "Blunder-check every move: is the piece I'm moving — or one I leave behind — hanging?",
  missed_tactic: 'Scan forcing moves first, every move: checks, captures, threats.',
  bad_trade: 'Before trading, compare piece activity, not just material — keep your active pieces.',
  king_safety: "Castle early and keep the pawn shield; don't open lines toward your own king.",
  positional: 'Improve your worst-placed piece and fight for the key squares.',
  fork: 'Watch squares that hit two pieces at once — especially knight forks near your king and queen.',
  pin: "Don't line up your king or queen behind a piece — it can't move freely once pinned.",
  skewer: 'Keep your king and queen off the open lines an enemy bishop, rook, or queen controls.',
  discovered_attack: 'Beware enemy pieces parked behind their own — moving the front one can spring an attack.',
  trapped_piece: 'Before advancing a piece, make sure it has a safe square to retreat to.',
  back_rank: 'Give your king luft — an escape square — so the back rank is not a mating net.',
}
