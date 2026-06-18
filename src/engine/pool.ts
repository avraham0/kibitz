import os from 'node:os'
import { Engine } from './stockfish.js'
import type { Evaluator } from '../analyze/game.js'

// Default parallel-engine count: scale to the machine but cap low — each engine
// costs a core and tens of MB of RAM, and a laptop thrashes past ~4.
export function autoConcurrency(): number {
  const cores = os.cpus()?.length ?? 1
  return Math.min(Math.max(1, cores - 1), 4)
}

// A pool of N Stockfish engines. Each engine serializes its own searches, so the
// pool's `evaluators` array gives `analyze()` N independent evaluators to run N
// games concurrently.
export class EnginePool {
  private readonly engines: Engine[]
  readonly evaluators: Evaluator[]

  private constructor(engines: Engine[]) {
    this.engines = engines
    this.evaluators = engines.map((e) => (fen: string, depth: number) => e.evaluate(fen, depth))
  }

  static async create(n: number): Promise<EnginePool> {
    const count = Math.max(1, Math.floor(n))
    // Boot sequentially — booting is fast (~150ms each) and avoids any WASM
    // module init races from parallel construction.
    const engines: Engine[] = []
    for (let i = 0; i < count; i++) engines.push(await Engine.create())
    return new EnginePool(engines)
  }

  get size(): number {
    return this.engines.length
  }

  quit(): void {
    for (const e of this.engines) {
      try { e.quit() } catch { /* ignore */ }
    }
  }
}
