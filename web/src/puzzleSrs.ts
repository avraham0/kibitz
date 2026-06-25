import type { BlunderRef, MistakeType } from './api-types.js'

// Spaced-repetition for puzzles. A Leitner-style box per puzzle: a correct solve
// promotes it to a longer interval; a reveal/fail resets it to "due now". Persisted
// to localStorage so failed puzzles resurface in later sessions.
export type SrsRecord = { box: number; due: number; wrongCount: number } // due = epoch ms
export type SrsStore = Record<string, SrsRecord>

const DAY = 86_400_000
const INTERVALS = [0, DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY] // box → wait before due again
const MAX_BOX = INTERVALS.length - 1
const STORAGE_KEY = 'kibitz:puzzleSrs'

export function puzzleKey(b: Pick<BlunderRef, 'url' | 'ply'>): string {
  return `${b.url}#${b.ply}`
}

export function isDue(store: SrsStore, key: string, now: number): boolean {
  const r = store[key]
  return !r || r.due <= now
}

// Return a NEW store with the puzzle's box/schedule updated.
export function recordResult(store: SrsStore, key: string, correct: boolean, now: number): SrsStore {
  const prev = store[key]
  const prevBox = prev?.box ?? 0
  const box = correct ? Math.min(MAX_BOX, prevBox + 1) : 0
  const wrongCount = correct ? (prev?.wrongCount ?? 0) : (prev?.wrongCount ?? 0) + 1
  return { ...store, [key]: { box, due: now + INTERVALS[box], wrongCount } }
}

// Most-overdue first; ties broken by most wrong (hardest) first.
export function orderByDue(blunders: BlunderRef[], store: SrsStore, now: number): BlunderRef[] {
  void now
  return [...blunders].sort((a, b) => {
    const dueDiff = (store[puzzleKey(a)]?.due ?? 0) - (store[puzzleKey(b)]?.due ?? 0)
    if (dueDiff !== 0) return dueDiff
    return (store[puzzleKey(b)]?.wrongCount ?? 0) - (store[puzzleKey(a)]?.wrongCount ?? 0)
  })
}

// Rough 0..1 difficulty of a puzzle for calibration. Higher = harder to find.
// Subtle, positional, quiet mistakes are hard; a hung queen with a huge swing is easy.
const TYPE_DIFFICULTY: Record<MistakeType, number> = {
  hung_piece: 0.2, bad_trade: 0.4, fork: 0.4, back_rank: 0.45, missed_tactic: 0.5,
  pin: 0.5, skewer: 0.55, discovered_attack: 0.55, trapped_piece: 0.55,
  king_safety: 0.6, positional: 0.75, lost_position: 0.5,
}
export function estimateDifficulty(b: Pick<BlunderRef, 'type' | 'cpLoss'>, store: SrsStore, key: string): number {
  let d = TYPE_DIFFICULTY[b.type] ?? 0.5
  // Bigger swings are more obvious → easier to spot.
  if (b.cpLoss >= 800) d -= 0.12
  else if (b.cpLoss >= 300) d -= 0.05
  else if (b.cpLoss < 150) d += 0.1
  // If this user has failed it before, it's hard for them specifically.
  d += Math.min(0.2, 0.08 * (store[key]?.wrongCount ?? 0))
  return Math.max(0, Math.min(1, d))
}

const TRIVIAL = 0.3 // skip dead-easy puzzles to the back — comfort only protects your level

// Calibrated order: spaced-repetition due puzzles first (as always), but within each
// group ramp from approachable to hard ("desirable difficulty") and push trivial ones
// to the end, instead of opening cold on the single hardest puzzle.
export function orderByCalibrated(blunders: BlunderRef[], store: SrsStore, now: number): BlunderRef[] {
  const diff = (b: BlunderRef) => estimateDifficulty(b, store, puzzleKey(b))
  return [...blunders].sort((a, b) => {
    const aDue = isDue(store, puzzleKey(a), now)
    const bDue = isDue(store, puzzleKey(b), now)
    if (aDue !== bDue) return aDue ? -1 : 1 // due first
    const da = diff(a), db = diff(b)
    const aTriv = da < TRIVIAL, bTriv = db < TRIVIAL
    if (aTriv !== bTriv) return aTriv ? 1 : -1 // trivial puzzles last
    return da - db // otherwise easier → harder, a gentle ramp
  })
}

export function dueCount(blunders: BlunderRef[], store: SrsStore, now: number): number {
  return blunders.filter((b) => isDue(store, puzzleKey(b), now)).length
}

export function loadSrs(): SrsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SrsStore) : {}
  } catch {
    return {}
  }
}

export function saveSrs(store: SrsStore): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)) } catch { /* quota / unavailable */ }
}
