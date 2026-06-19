import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import type { GameAnalysis } from '../types.js'

const DEFAULT_ROOT = join(homedir(), '.kibitz', 'cache')

function sanitize(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '_')
}

// Bump when the per-game analysis output shape or logic changes (so stale caches are
// re-analyzed instead of served). v2: two-pass depth + reordered mistake classification.
const ANALYSIS_VERSION = 2

export function cachePath(user: string, gameId: string, depth: number, root = DEFAULT_ROOT): string {
  return join(root, sanitize(user), `${sanitize(gameId)}-d${depth}-v${ANALYSIS_VERSION}.json`)
}

export async function readCached(
  user: string, gameId: string, depth: number, root = DEFAULT_ROOT,
): Promise<GameAnalysis | null> {
  try {
    const txt = await readFile(cachePath(user, gameId, depth, root), 'utf8')
    return JSON.parse(txt) as GameAnalysis
  } catch {
    return null
  }
}

export async function writeCached(
  analysis: GameAnalysis, user: string, root = DEFAULT_ROOT,
): Promise<void> {
  const p = cachePath(user, analysis.gameId, analysis.depth, root)
  await mkdir(dirname(p), { recursive: true })
  await writeFile(p, JSON.stringify(analysis), 'utf8')
}
