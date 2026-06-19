// Synthesized move sounds — no audio assets, no licensing, works offline.
// A short, fixed-pitch noise knock with a little low body = a wooden "clunk".
// Every normal move sounds the same; captures are lower and heavier.

export type MoveSound = 'move' | 'capture'

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
  return san.includes('x') ? 'capture' : 'move'
}

// band/body are FIXED frequencies (no pitch glide — that sounded like a laser).
// The knock is mostly band-passed noise; a brief low sine adds wooden weight.
const PARAMS: Record<MoveSound, { band: number; body: number; vol: number }> = {
  move: { band: 850, body: 160, vol: 0.5 },
  capture: { band: 600, body: 110, vol: 0.66 },
}

export function playMoveSound(kind: MoveSound): void {
  const ac = audio()
  if (!ac) return
  if (ac.state === 'suspended') void ac.resume() // unlock after the user's first gesture
  const t = ac.currentTime
  const p = PARAMS[kind]

  const master = ac.createGain()
  master.gain.value = p.vol
  master.connect(ac.destination)

  // Knock: a short noise burst with a fast percussive decay, band-passed (low Q,
  // so it's broad/woody rather than a ringing tin tone) and low-passed for warmth.
  const dur = 0.05
  const n = Math.floor(ac.sampleRate * dur)
  const buf = ac.createBuffer(1, n, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < n; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5)
  }
  const noise = ac.createBufferSource()
  noise.buffer = buf
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'; bp.frequency.value = p.band; bp.Q.value = 1
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'; lp.frequency.value = 2000
  noise.connect(bp); bp.connect(lp); lp.connect(master)
  noise.start(t); noise.stop(t + dur)

  // Body: a brief, constant-pitch low sine for weight under the knock.
  const osc = ac.createOscillator()
  osc.type = 'sine'; osc.frequency.value = p.body
  const bodyGain = ac.createGain()
  bodyGain.gain.setValueAtTime(0.0001, t)
  bodyGain.gain.exponentialRampToValueAtTime(0.4, t + 0.004)
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055)
  osc.connect(bodyGain); bodyGain.connect(master)
  osc.start(t); osc.stop(t + 0.07)
}
