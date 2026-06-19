import type { BlunderRef } from './api-types.js'

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
