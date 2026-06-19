import { describe, it, expect } from 'vitest'
import { recordResult, isDue, orderByDue, dueCount, puzzleKey, type SrsStore } from './puzzleSrs.js'
import type { BlunderRef } from './api-types.js'

const b = (url: string, ply: number): BlunderRef => ({
  url, ply, san: 'x', bestSan: 'y', fenBefore: 'f', cpLoss: 300, type: 'fork', missed: false, openingName: '', movesAfter: [],
})
const NOW = 1_000_000_000_000

describe('puzzleSrs', () => {
  it('treats unseen puzzles as due', () => {
    expect(isDue({}, puzzleKey(b('u', 1)), NOW)).toBe(true)
  })

  it('schedules a correct solve into the future and resets on failure', () => {
    const k = puzzleKey(b('u', 1))
    const afterCorrect = recordResult({}, k, true, NOW)
    expect(isDue(afterCorrect, k, NOW)).toBe(false) // box 1 → ~1 day out
    const afterFail = recordResult(afterCorrect, k, false, NOW)
    expect(afterFail[k].box).toBe(0)
    expect(isDue(afterFail, k, NOW)).toBe(true)
  })

  it('orders scheduled puzzles after due ones and counts due', () => {
    const items = [b('a', 1), b('b', 1), b('c', 1)]
    const store: SrsStore = recordResult({}, puzzleKey(items[0]), true, NOW) // a scheduled
    expect(dueCount(items, store, NOW)).toBe(2) // b, c still due
    const ordered = orderByDue(items, store, NOW)
    expect(ordered[ordered.length - 1].url).toBe('a') // scheduled sinks to the back
  })
})
