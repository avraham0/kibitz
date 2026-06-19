import type { Eval } from '../../../src/types.js'

export type Evaluator = (fen: string, depth: number) => Promise<{ eval: Eval; bestUci: string; pv: string[] }>

// Wraps the Stockfish no-Worker WASM, which when loaded as a classic Worker
// receives UCI commands via worker.postMessage(string) and emits UCI output
// via worker.onmessage / worker.addEventListener('message', ...).
export class BrowserEngine {
  private worker: Worker
  private lines: string[] = []
  private until: ((line: string) => boolean) | null = null
  private resolve: ((lines: string[]) => void) | null = null

  private constructor(worker: Worker) {
    this.worker = worker
    worker.addEventListener('message', (e: MessageEvent) => {
      const line: string = typeof e.data === 'string' ? e.data : String(e.data ?? '')
      if (!line) return
      if (this.until) {
        this.lines.push(line)
        if (this.until(line)) {
          const r = this.resolve!
          const collected = this.lines
          this.resolve = null; this.until = null; this.lines = []
          r(collected)
        }
      }
    })
  }

  private send(cmd: string, until: (l: string) => boolean): Promise<string[]> {
    return new Promise((res) => {
      this.resolve = res; this.until = until; this.lines = []
      this.worker.postMessage(cmd)
    })
  }

  static async create(): Promise<BrowserEngine> {
    const worker = new Worker('/stockfish.js')
    const engine = new BrowserEngine(worker)
    await engine.send('uci', (l) => l === 'uciok')
    await engine.send('isready', (l) => l === 'readyok')
    return engine
  }

  async evaluate(fen: string, depth: number): Promise<{ eval: Eval; bestUci: string; pv: string[] }> {
    this.worker.postMessage('ucinewgame')
    this.worker.postMessage(`position fen ${fen}`)
    const lines = await this.send(`go depth ${depth}`, (l) => l.startsWith('bestmove'))
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

  get evaluator(): Evaluator {
    return (fen, depth) => this.evaluate(fen, depth)
  }

  quit(): void { try { this.worker.terminate() } catch { /* ignore */ } }
}
