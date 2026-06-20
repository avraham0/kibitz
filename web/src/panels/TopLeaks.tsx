import type { Stats } from '../api-types.js'
import { topLeaks } from '../topLeaks.js'

// A ranked, plain-language diagnosis of recurring mistakes — synthesized from the
// aggregate stats, no model required.
export function TopLeaks({ stats }: { stats: Stats }) {
  const leaks = topLeaks(stats)
  if (leaks.length === 0) return null
  return (
    <section>
      <h2>Top leaks</h2>
      <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {leaks.map((l, i) => (
          <li key={i}>
            <strong>{l.title}</strong>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{l.detail}</div>
          </li>
        ))}
      </ol>
    </section>
  )
}
