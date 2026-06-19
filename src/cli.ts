import { parseArgs } from 'node:util'
import { writeFile } from 'node:fs/promises'
import { run, defaultSince } from './orchestrate.js'

async function main() {
  // Capture the real fetch BEFORE dynamically loading the engine, which
  // clobbers globalThis.fetch with a non-function at module-evaluation time.
  const realFetch = globalThis.fetch.bind(globalThis)

  const { values } = parseArgs({
    options: {
      user: { type: 'string' },
      since: { type: 'string' },
      last: { type: 'string' },
      depth: { type: 'string', default: '18' },
      out: { type: 'string' },
      concurrency: { type: 'string' },
      variations: { type: 'boolean' },
      'time-control': { type: 'string' },
    },
  })

  if (!values.user) {
    console.error('Usage: kibitz --user <name> [--since YYYY-MM] [--last N] [--depth 15] [--concurrency N] [--variations] [--time-control blitz] [--out report.md]')
    process.exit(2)
  }

  const nowISO = new Date().toISOString()
  const since = values.since ?? defaultSince(nowISO)
  const depth = Number(values.depth ?? '15')
  const last = values.last ? Number(values.last) : undefined

  // Dynamic import AFTER capturing realFetch — this is where fetch gets clobbered.
  const { EnginePool, autoConcurrency } = await import('./engine/pool.js')
  const concurrency = values.concurrency ? Number(values.concurrency) : autoConcurrency()
  const pool = await EnginePool.create(concurrency)
  try {
    const out = await run({
      user: values.user, since, depth, last, nowISO,
      evaluate: pool.evaluators[0],
      evaluators: pool.evaluators,
      variations: values.variations === true,
      timeControl: values['time-control'],
      fetchFn: realFetch,
    })
    console.log(out.terminal)
    if (values.out) {
      await writeFile(values.out, out.markdown, 'utf8')
      console.log(`\nFull report written to ${values.out}`)
    }
  } finally {
    pool.quit()
  }
}

main().catch((err) => {
  console.error(String(err?.message ?? err))
  process.exit(1)
})
