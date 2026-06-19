// Synthesized move sounds — no audio assets, no licensing, works offline.
// A short noise burst through a low-pass filter approximates a wooden "knock";
// pitch/volume vary by move kind so captures and checks read differently.

export type MoveSound = 'move' | 'capture' | 'check' | 'castle'

export const SOUND_KEY = 'chess-coach:sound'
export function soundEnabled(): boolean {
  try { return localStorage.getItem(SOUND_KEY) !== '0' } catch { return true }
}

let ctx: AudioContext | null = null
function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    try { ctx = new Ctor() } catch { return null }
  }
  return ctx
}

export function soundForSan(san: string): MoveSound {
  if (/[+#]/.test(san)) return 'check'
  if (san.startsWith('O-O')) return 'castle'
  if (san.includes('x')) return 'capture'
  return 'move'
}

const PARAMS: Record<MoveSound, { freq: number; vol: number }> = {
  move: { freq: 900, vol: 0.45 },
  capture: { freq: 480, vol: 0.7 },
  check: { freq: 1500, vol: 0.6 },
  castle: { freq: 700, vol: 0.5 },
}

export function playMoveSound(kind: MoveSound): void {
  const ac = audio()
  if (!ac) return
  if (ac.state === 'suspended') void ac.resume() // unlock after the user's first gesture
  const now = ac.currentTime
  const dur = 0.09
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2) // decaying noise
  }
  const src = ac.createBufferSource()
  src.buffer = buf
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = PARAMS[kind].freq
  const gain = ac.createGain()
  gain.gain.setValueAtTime(PARAMS[kind].vol, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur)
  src.connect(lp); lp.connect(gain); gain.connect(ac.destination)
  src.start(now); src.stop(now + dur)
}
