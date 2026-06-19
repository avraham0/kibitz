import os from 'node:os'
import { Engine } from './stockfish.js'
import { NativeEngine, nativeBinPath } from './native.js'
import type { Evaluator } from '../analyze/game.js'
import type { Eval } from '../types.js'

// Either backend exposes the same surface.
interface UciEngine {
  evaluate(fen: string, depth: number): Promise<{ eval: Eval; bestUci: string; pv: string[] }>
  quit(): void
}

// Default parallel-engine count: scale to the machine but cap low — each engine
// costs a core and tens of MB of RAM, and a laptop thrashes past ~4.
export function autoConcurrency(): number {
  const cores = os.cpus()?.length ?? 1
  return Math.min(Math.max(1, cores - 1), 4)
}

// A pool of N Stockfish engines. Each engine serializes its own searches, so the
// pool's `evaluators` array gives `analyze()` N independent evaluators to run N
// games concurrently. Prefers a native Stockfish binary (much faster); falls back
// to the bundled WASM build when none is installed.
export class EnginePool {
  private readonly engines: UciEngine[]
  readonly evaluators: Evaluator[]
  readonly backend: 'native' | 'wasm'

  private constructor(engines: UciEngine[], backend: 'native' | 'wasm') {
    this.engines = engines
    this.backend = backend
    this.evaluators = engines.map((e) => (fen: string, depth: number) => e.evaluate(fen, depth))
  }

  static async create(n: number): Promise<EnginePool> {
    const count = Math.max(1, Math.floor(n))

    // Try native first — boot the first engine to probe availability, then the rest.
    const native: UciEngine[] = []
    try {
      const bin = nativeBinPath()
      native.push(await NativeEngine.create(bin))
      for (let i = 1; i < count; i++) native.push(await NativeEngine.create(bin))
      return new EnginePool(native, 'native')
    } catch {
      for (const e of native) { try { e.quit() } catch { /* ignore */ } }
    }

    // WASM fallback. Boot sequentially — booting is fast (~150ms each) and avoids
    // any WASM module init races from parallel construction.
    const wasm: UciEngine[] = []
    for (let i = 0; i < count; i++) wasm.push(await Engine.create())
    return new EnginePool(wasm, 'wasm')
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
