import { createServer } from 'node:http'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createHandler } from './handler.js'
import { analyze } from '../orchestrate.js'

async function main() {
  // Capture real fetch BEFORE the engine module loads (it clobbers globalThis.fetch).
  const realFetch = globalThis.fetch.bind(globalThis)

  const { values } = parseArgs({ options: { port: { type: 'string', default: '5173' }, concurrency: { type: 'string' } } })
  const port = Number(values.port)

  const { EnginePool, autoConcurrency } = await import('../engine/pool.js')
  const concurrency = values.concurrency ? Number(values.concurrency) : autoConcurrency()
  const pool = await EnginePool.create(concurrency)

  // web/dist sits two levels up from src/server/
  const here = dirname(fileURLToPath(import.meta.url))
  const staticDir = join(here, '..', '..', 'web', 'dist')

  const handler = createHandler({
    staticDir,
    nowISO: () => new Date().toISOString(),
    analyze: (opts, onProgress) => analyze(
      { ...opts, evaluate: pool.evaluators[0], evaluators: pool.evaluators, fetchFn: realFetch },
      onProgress,
    ),
  })

  const server = createServer(handler)
  server.listen(port, '127.0.0.1', () => {
    console.log(`kibitz web UI on http://127.0.0.1:${port} (engines: ${pool.size} ${pool.backend})`)
  })
  const shutdown = () => { pool.quit(); server.close(() => process.exit(0)) }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => { console.error(String((err as Error)?.message ?? err)); process.exit(1) })
