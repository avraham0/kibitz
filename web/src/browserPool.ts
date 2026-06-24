// A pool of Stockfish-WASM Web Workers for client-side analysis. Mirrors the
// server's EnginePool: each worker is an independent single-threaded engine, and the
// pipeline pulls the next game onto whichever engine is free, so up to `size` games
// analyze in parallel across the user's CPU cores. No cross-origin isolation needed.
import type { Evaluator } from '../../src/analyze/game.js'
import type { Eval } from '../../src/types.js'

type EvalResult = { eval: Eval; bestUci: string; pv: string[] }

class Engine {
  private worker: Worker
  private ready: Promise<void>
  private onLine: ((line: string) => void) | null = null

  constructor() {
    this.worker = new Worker(`${import.meta.env.BASE_URL}stockfish.js`)
    this.worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data)
      this.onLine?.(line)
    }
    this.ready = this.handshake()
  }

  private waitFor(until: (line: string) => boolean): Promise<void> {
    return new Promise((resolve) => {
      this.onLine = (line) => { if (until(line)) { this.onLine = null; resolve() } }
    })
  }

  private async handshake(): Promise<void> {
    this.worker.postMessage('uci')
    await this.waitFor((l) => l === 'uciok')
    this.worker.postMessage('isready')
    await this.waitFor((l) => l === 'readyok')
  }

  newGame(): void { this.worker.postMessage('ucinewgame') }

  async evaluate(fen: string, depth: number): Promise<EvalResult> {
    await this.ready
    return new Promise<EvalResult>((resolve) => {
      // UCI `score` is from the side-to-move's POV — same convention the server's
      // NativeEngine returns, which is what analyzeGame/cpFromMoverPov expect.
      let cp: number | null = null
      let mate: number | null = null
      let pv: string[] = []
      this.onLine = (line) => {
        if (line.startsWith('info')) {
          const s = line.match(/score (cp|mate) (-?\d+)/)
          if (s) { if (s[1] === 'cp') { cp = Number(s[2]); mate = null } else { mate = Number(s[2]); cp = null } }
          const p = line.match(/ pv (.+)$/)
          if (p) pv = p[1].trim().split(/\s+/)
        } else if (line.startsWith('bestmove')) {
          this.onLine = null
          const bm = line.split(/\s+/)[1]
          resolve({ eval: { cp, mate }, bestUci: pv[0] ?? (bm && bm !== '(none)' ? bm : '0000'), pv })
        }
      }
      this.worker.postMessage(`position fen ${fen}`)
      this.worker.postMessage(`go depth ${depth}`)
    })
  }

  quit(): void {
    try { this.worker.postMessage('quit') } catch { /* ignore */ }
    this.worker.terminate()
  }
}

export type BrowserPool = { evaluators: Evaluator[]; quit: () => void; size: number }

export function createBrowserPool(size?: number): BrowserPool {
  const n = Math.max(1, size ?? Math.min(8, navigator.hardwareConcurrency || 4))
  const engines = Array.from({ length: n }, () => new Engine())
  const evaluators: Evaluator[] = engines.map((eng) => {
    const fn = ((fen: string, depth: number) => eng.evaluate(fen, depth)) as Evaluator
    fn.newGame = () => eng.newGame()
    return fn
  })
  return { evaluators, quit: () => engines.forEach((e) => e.quit()), size: n }
}

// Reuse one warm pool across analyses — spawning 8 workers and instantiating the 7 MB
// WASM each costs ~1s, so we keep them alive between runs instead of tearing down.
let shared: BrowserPool | null = null
export function getBrowserPool(): BrowserPool {
  if (!shared) shared = createBrowserPool()
  return shared
}
