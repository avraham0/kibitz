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

// A piece placement is a low "thunk" (a quickly-damped pitch that glides down)
// with a soft, brief noise click for the attack. Low body frequencies and a
// gentle low-pass on the click keep it wooden rather than tinny/metallic.
const PARAMS: Record<MoveSound, { body: number; decay: number; click: number; vol: number }> = {
  move: { body: 210, decay: 0.13, click: 0.08, vol: 0.5 },
  capture: { body: 150, decay: 0.16, click: 0.16, vol: 0.7 },
  check: { body: 300, decay: 0.12, click: 0.10, vol: 0.6 },
  castle: { body: 190, decay: 0.14, click: 0.08, vol: 0.5 },
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

  // Body: a triangle "thunk" that glides down in pitch and decays fast.
  const osc = ac.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(p.body * 1.6, t)
  osc.frequency.exponentialRampToValueAtTime(p.body, t + 0.03)
  const bodyGain = ac.createGain()
  bodyGain.gain.setValueAtTime(0.0001, t)
  bodyGain.gain.exponentialRampToValueAtTime(1, t + 0.004) // fast attack, no click discontinuity
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + p.decay)
  osc.connect(bodyGain); bodyGain.connect(master)
  osc.start(t); osc.stop(t + p.decay + 0.02)

  // Click transient: a very short, low-passed noise burst for the attack snap.
  const dur = 0.018
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2)
  }
  const noise = ac.createBufferSource()
  noise.buffer = buf
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 2600
  const clickGain = ac.createGain()
  clickGain.gain.value = p.click
  noise.connect(lp); lp.connect(clickGain); clickGain.connect(master)
  noise.start(t); noise.stop(t + dur)
}
