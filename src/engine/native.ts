import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface, type Interface } from 'node:readline'
import type { Eval } from '../types.js'

type Listener = (line: string) => void

// A native Stockfish binary driven over UCI (stdin/stdout). ~5–10× faster than the
// WASM build. Same evaluate()/quit() surface as the WASM Engine, so the pool can use
// either interchangeably. Single-threaded per process (Threads=1) + ucinewgame before
// each search keeps results deterministic across the parallel pool.
export class NativeEngine {
  private proc: ChildProcess
  private rl: Interface
  private listeners: Listener[] = []

  private constructor(proc: ChildProcess) {
    this.proc = proc
    this.proc.stdin?.on('error', () => { /* ignore broken pipe on a dead process */ })
    this.rl = createInterface({ input: proc.stdout! })
    this.rl.on('line', (line) => { for (const l of this.listeners) l(line) })
  }

  static create(binPath: string, timeoutMs = 4000): Promise<NativeEngine> {
    return new Promise((resolve, reject) => {
      let proc: ChildProcess
      try {
        proc = spawn(binPath, [], { stdio: ['pipe', 'pipe', 'ignore'] })
      } catch (err) { reject(err); return }
      proc.once('error', reject) // e.g. ENOENT when the binary isn't installed
      const engine = new NativeEngine(proc)
      const timer = setTimeout(() => reject(new Error('stockfish init timed out')), timeoutMs)
      engine._send('uci', (l) => l === 'uciok')
        .then(() => { proc.stdin!.write('setoption name Hash value 256\n') })
        .then(() => engine._send('isready', (l) => l === 'readyok'))
        .then(() => { clearTimeout(timer); proc.off('error', reject); resolve(engine) })
        .catch(reject)
    })
  }

  private _send(cmd: string, until: (line: string) => boolean): Promise<string[]> {
    return new Promise((resolve) => {
      const collected: string[] = []
      const listener: Listener = (line) => {
        collected.push(line)
        if (until(line)) { this.listeners = this.listeners.filter((x) => x !== listener); resolve(collected) }
      }
      this.listeners.push(listener)
      this.proc.stdin!.write(cmd + '\n')
    })
  }

  newGame(): void {
    this.proc.stdin!.write('ucinewgame\n')
  }

  async evaluate(fen: string, depth: number): Promise<{ eval: Eval; bestUci: string; pv: string[] }> {
    this.proc.stdin!.write(`position fen ${fen}\n`)
    const lines = await this._send(`go depth ${depth}`, (l) => l.startsWith('bestmove'))
    let cp: number | null = null
    let mate: number | null = null
    let pv: string[] = []
    for (const line of lines) {
      const mateM = line.match(/\bscore mate (-?\d+)/)
      const cpM = line.match(/\bscore cp (-?\d+)/)
      if (mateM) { mate = Number(mateM[1]); cp = null }
      else if (cpM) { cp = Number(cpM[1]); mate = null }
      const pvM = line.match(/ pv (.+)$/)
      if (pvM) pv = pvM[1].trim().split(/\s+/)
    }
    const bestLine = lines.find((l) => l.startsWith('bestmove')) ?? 'bestmove 0000'
    const bestUci = pv[0] ?? (bestLine.split(/\s+/)[1] ?? '0000')
    return { eval: { cp, mate }, bestUci, pv }
  }

  quit(): void {
    try { this.proc.stdin?.write('quit\n') } catch { /* ignore */ }
    try { this.proc.kill() } catch { /* ignore */ }
    try { this.rl.close() } catch { /* ignore */ }
  }
}

// Where to find a native Stockfish: explicit override, else `stockfish` on PATH.
export function nativeBinPath(): string {
  return process.env.STOCKFISH_PATH || 'stockfish'
}
