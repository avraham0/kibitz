import { createServer } from 'node:http'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { createHandler } from './handler.js'
import { analyze } from '../orchestrate.js'

async function main() {
  // Capture real fetch BEFORE the engine module loads (it clobbers globalThis.fetch).
  const realFetch = globalThis.fetch.bind(globalThis)

  const { values } = parseArgs({ options: { port: { type: 'string', default: '5173' }, host: { type: 'string', default: '127.0.0.1' }, concurrency: { type: 'string' } } })
  const port = Number(values.port)
  const host = values.host as string

  const { EnginePool, autoConcurrency } = await import('../engine/pool.js')
  const concurrency = values.concurrency ? Number(values.concurrency) : autoConcurrency()
  const pool = await EnginePool.create(concurrency)

  // web/dist sits two levels up from src/server/
  const here = dirname(fileURLToPath(import.meta.url))
  const staticDir = join(here, '..', '..', 'web', 'dist')

  // Probe candidate book paths in order; use the first that exists.
  // ~/.kibitz/book.bin is the user-managed location; web/public/book.bin is
  // present in dev after extracting the Cerebellum book there.
  const { existsSync } = await import('node:fs')
  const bookCandidates = [
    join(homedir(), '.kibitz', 'book.bin'),
    join(here, '..', '..', 'web', 'public', 'book.bin'),
  ]
  const defaultBookPath = bookCandidates.find(existsSync) ?? bookCandidates[0]

  const handler = createHandler({
    staticDir,
    nowISO: () => new Date().toISOString(),
    analyze: (opts, onProgress) => analyze(
      { ...opts, evaluate: pool.evaluators[0], evaluators: pool.evaluators, fetchFn: realFetch, bookPath: defaultBookPath },
      onProgress,
    ),
  })

  const server = createServer(handler)
  server.listen(port, host, () => {
    console.log(`kibitz web UI on http://${host}:${port} (engines: ${pool.size} ${pool.backend})`)
  })
  const shutdown = () => { pool.quit(); server.close(() => process.exit(0)) }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => { console.error(String((err as Error)?.message ?? err)); process.exit(1) })
