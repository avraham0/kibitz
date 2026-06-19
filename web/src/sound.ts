// Move sounds use the real lichess "standard" sound set (AGPL, bundled under
// web/public/sounds/). Same simple API as before: every normal move plays the
// move clunk; captures play the capture sound.

export type MoveSound = 'move' | 'capture'

export const SOUND_KEY = 'chess-coach:sound'
export function soundEnabled(): boolean {
  try { return localStorage.getItem(SOUND_KEY) !== '0' } catch { return true }
}

export function soundForSan(san: string): MoveSound {
  return san.includes('x') ? 'capture' : 'move'
}

const SRC: Record<MoveSound, string> = {
  move: '/sounds/Move.mp3',
  capture: '/sounds/Capture.mp3',
}

// One preloaded element per sound. Guarded so it no-ops in non-browser (test) envs.
const cache: Partial<Record<MoveSound, HTMLAudioElement>> = {}
function element(kind: MoveSound): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null
  if (!cache[kind]) {
    const a = new Audio(SRC[kind])
    a.preload = 'auto'
    a.volume = 0.7
    cache[kind] = a
  }
  return cache[kind] ?? null
}

export function playMoveSound(kind: MoveSound): void {
  if (typeof Audio === 'undefined') return
  try {
    // Stop any sound still playing so a lingering capture can't bleed into the
    // next (regular) move — when stepping, only the current move should sound.
    for (const e of Object.values(cache)) { e.pause(); e.currentTime = 0 }
    const a = element(kind)
    if (!a) return
    a.currentTime = 0
    const r = a.play() // may be a Promise (browser) or undefined (jsdom)
    if (r && typeof r.catch === 'function') r.catch(() => { /* autoplay blocked until first gesture */ })
  } catch { /* audio unavailable */ }
}
