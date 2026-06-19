import { createServer } from 'node:http'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createHandler } from './handler.js'

async function main() {
  const { values } = parseArgs({ options: { port: { type: 'string', default: '5173' } } })
  const port = Number(values.port)

  // web/dist sits two levels up from src/server/
  const here = dirname(fileURLToPath(import.meta.url))
  const staticDir = join(here, '..', '..', 'web', 'dist')

  const handler = createHandler({ staticDir })
  const server = createServer(handler)
  server.listen(port, '127.0.0.1', () => {
    console.log(`kibitz on http://127.0.0.1:${port} (analysis runs in browser)`)
  })
  const shutdown = () => { server.close(() => process.exit(0)) }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => { console.error(String((err as Error)?.message ?? err)); process.exit(1) })
