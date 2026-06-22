// Entry point for the standalone Mac binary (Node SEA build).
// Uses embedded web assets and native Stockfish only (no WASM fallback).
import { createServer } from 'node:http'
import { parseArgs } from 'node:util'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createHandler } from './handler.js'
import { analyze } from '../orchestrate.js'
import { NativeEngine, nativeBinPath } from '../engine/native.js'
import { ASSETS } from './embedded-assets.gen.js'

const virtualFS = new Map<string, Buffer>()
for (const [path, b64] of Object.entries(ASSETS)) {
  virtualFS.set(path, Buffer.from(b64, 'base64'))
}

async function main() {
  const realFetch = globalThis.fetch.bind(globalThis)

  const { values } = parseArgs({
    options: {
      port: { type: 'string', default: '5173' },
      concurrency: { type: 'string' },
    },
  })
  const port = Number(values.port)

  const cores = (await import('node:os')).default.cpus()?.length ?? 1
  const concurrency = values.concurrency
    ? Number(values.concurrency)
    : Math.min(Math.max(1, cores - 1), 4)

  const bin = nativeBinPath()
  const engines: NativeEngine[] = []
  try {
    for (let i = 0; i < concurrency; i++) {
      engines.push(await NativeEngine.create(bin))
    }
  } catch {
    console.error(
      '\nError: Stockfish not found on PATH.\n' +
      'Install it with:  brew install stockfish\n' +
      'Then re-run kibitz.\n',
    )
    process.exit(1)
  }

  const evaluators = engines.map((e) => {
    const fn = (fen: string, depth: number) => e.evaluate(fen, depth)
    fn.newGame = () => e.newGame()
    return fn
  })

  const bookPath = join(homedir(), '.kibitz', 'book.bin')

  const handler = createHandler({
    staticDir: '',
    nowISO: () => new Date().toISOString(),
    virtualFS,
    analyze: (opts, onProgress) =>
      analyze(
        { ...opts, evaluate: evaluators[0], evaluators, fetchFn: realFetch, bookPath },
        onProgress,
      ),
  })

  const server = createServer(handler)
  server.listen(port, '127.0.0.1', () => {
    console.log(`\nkibitz running at http://127.0.0.1:${port}`)
    console.log('Open that URL in your browser, then press Ctrl+C to stop.\n')
    if (engines.length) {
      console.log(`Engine: native Stockfish (${engines.length} parallel)`)
    }
  })

  const shutdown = () => {
    engines.forEach((e) => { try { e.quit() } catch { /* ignore */ } })
    server.close(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error(String((err as Error)?.message ?? err))
  process.exit(1)
})
