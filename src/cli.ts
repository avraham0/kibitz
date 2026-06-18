import { parseArgs } from 'node:util'
import { writeFile } from 'node:fs/promises'
import { Engine } from './engine/stockfish.js'
import { run, defaultSince } from './orchestrate.js'

async function main() {
  const { values } = parseArgs({
    options: {
      user: { type: 'string' },
      since: { type: 'string' },
      last: { type: 'string' },
      depth: { type: 'string', default: '15' },
      out: { type: 'string' },
    },
  })

  if (!values.user) {
    console.error('Usage: chess-coach --user <name> [--since YYYY-MM] [--last N] [--depth 15] [--out report.md]')
    process.exit(2)
  }

  const nowISO = new Date().toISOString()
  const since = values.since ?? defaultSince(nowISO)
  const depth = Number(values.depth ?? '15')
  const last = values.last ? Number(values.last) : undefined

  const engine = await Engine.create()
  try {
    const out = await run({
      user: values.user, since, depth, last, nowISO,
      evaluate: (fen, d) => engine.evaluate(fen, d),
    })
    console.log(out.terminal)
    if (values.out) {
      await writeFile(values.out, out.markdown, 'utf8')
      console.log(`\nFull report written to ${values.out}`)
    }
  } finally {
    engine.quit()
  }
}

main().catch((err) => {
  console.error(String(err?.message ?? err))
  process.exit(1)
})
