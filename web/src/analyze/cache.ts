import type { GameAnalysis } from '../../../src/types.js'

const ANALYSIS_VERSION = 2
const PREFIX = 'kibitz:analysis:'

function key(user: string, gameId: string, depth: number): string {
  return `${PREFIX}${user}:${gameId}:d${depth}:v${ANALYSIS_VERSION}`
}

export function readCached(user: string, gameId: string, depth: number): GameAnalysis | null {
  try {
    const raw = localStorage.getItem(key(user, gameId, depth))
    return raw ? (JSON.parse(raw) as GameAnalysis) : null
  } catch { return null }
}

export function writeCached(analysis: GameAnalysis, user: string): void {
  try {
    localStorage.setItem(key(user, analysis.gameId, analysis.depth), JSON.stringify(analysis))
  } catch { /* quota exceeded — skip silently */ }
}
