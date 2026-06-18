import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { Eval } from '../types.js'

// The stockfish npm package (v16) ships a WASM build with multiple variants.
// The entrypoint (src/stockfish-nnue-16-single.js) exports a nested factory:
//   sf = require(...)   // sf is the outer factory function
//   mod = sf()(config)  // sf() returns inner factory; calling it with config
//                       // begins async WASM init; mod.ready resolves to eng
// Communication:
//   eng.addMessageListener(fn)  — subscribe to UCI output lines
//   eng.queue.put(cmd)          — send a UCI command
// We use the single-threaded variant to avoid Worker path issues in Node.
// @ts-ignore - no bundled types
const _require = createRequire(import.meta.url)
const _stockfishDir = path.dirname(
  fileURLToPath(new URL('../../node_modules/stockfish/src/stockfish-nnue-16-single.js', import.meta.url))
)
const _wasmPath = path.join(_stockfishDir, 'stockfish-nnue-16-single.wasm')
// @ts-ignore - no bundled types
const StockfishOuter = _require(
  path.join(_stockfishDir, 'stockfish-nnue-16-single.js')
) as (config?: object) => (config?: object) => { ready: Promise<StockfishEngine> }

interface StockfishEngine {
  addMessageListener(fn: (line: string) => void): void
  removeMessageListener(fn: (line: string) => void): void
  queue: { put(cmd: string): void }
  terminate(): void
}

type Listener = (line: string) => void

export class Engine {
  private sf: StockfishEngine
  private listeners: Listener[] = []
  private dispatcher: (line: string) => void

  private constructor(sf: StockfishEngine) {
    this.sf = sf
    this.dispatcher = (line: string) => {
      for (const l of this.listeners) l(line)
    }
    this.sf.addMessageListener(this.dispatcher)
  }

  static async create(): Promise<Engine> {
    const mod: { locateFile?: (f: string) => string; ready?: Promise<StockfishEngine> } = {
      locateFile: (f: string) => (f.endsWith('.wasm') ? _wasmPath : f),
    }
    // @ts-ignore - dynamic typing from untyped package
    const result = StockfishOuter()(mod)
    const sf = await ((result && result.ready) ? result.ready : (mod as any).ready)
    if (!sf) throw new Error('Stockfish failed to initialize (no ready module)')
    const engine = new Engine(sf)
    await engine._send('uci', (l) => l === 'uciok')
    await engine._send('isready', (l) => l === 'readyok')
    return engine
  }

  private _send(cmd: string, until: (line: string) => boolean): Promise<string[]> {
    return new Promise((resolve) => {
      const collected: string[] = []
      const listener: Listener = (line) => {
        collected.push(line)
        if (until(line)) {
          this.listeners = this.listeners.filter((x) => x !== listener)
          resolve(collected)
        }
      }
      this.listeners.push(listener)
      this.sf.queue.put(cmd)
    })
  }

  async evaluate(fen: string, depth: number): Promise<{ eval: Eval; bestUci: string; pv: string[] }> {
    this.sf.queue.put(`position fen ${fen}`)
    const lines = await this._send(`go depth ${depth}`, (l) => l.startsWith('bestmove'))
    let cp: number | null = null
    let mate: number | null = null
    let pv: string[] = []
    for (const line of lines) {
      const mateM = line.match(/\bscore mate (-?\d+)/)
      const cpM = line.match(/\bscore cp (-?\d+)/)
      if (mateM) {
        mate = Number(mateM[1])
        cp = null
      } else if (cpM) {
        cp = Number(cpM[1])
        mate = null
      }
      const pvM = line.match(/ pv (.+)$/)
      if (pvM) pv = pvM[1].trim().split(/\s+/)
    }
    const bestLine = lines.find((l) => l.startsWith('bestmove')) ?? 'bestmove 0000'
    const bestUci = pv[0] ?? (bestLine.split(/\s+/)[1] ?? '0000')
    return { eval: { cp, mate }, bestUci, pv }
  }

  quit(): void {
    try {
      this.sf.removeMessageListener(this.dispatcher)
    } catch {
      /* ignore */
    }
    try {
      this.sf.queue.put('quit')
    } catch {
      /* ignore */
    }
    try {
      this.sf.terminate()
    } catch {
      /* ignore */
    }
  }
}
