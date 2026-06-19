import type { Stats } from '../api-types.js'
import { accuracyColor } from '../accuracyColor.js'

// Winning-position conversion + a White/Black breakdown. Both read straight from
// the aggregate stats.
export function Splits({ stats }: { stats: Stats }) {
  const { conversion: c, byColor } = stats
  const convPct = c.winningGames ? Math.round((c.converted / c.winningGames) * 100) : null
  const colors = ['white', 'black'] as const
  return (
    <section>
      <h2>Conversion & color</h2>
      <p style={{ marginTop: 0 }}>
        {c.winningGames > 0 ? (
          <>Converted <strong>{c.converted} / {c.winningGames}</strong> winning positions (<strong>{convPct}%</strong>) — games where you reached ≥ +3 and went on to win.</>
        ) : (
          <span style={{ color: 'var(--muted)' }}>No clearly winning positions reached in these games.</span>
        )}
      </p>
      <table>
        <thead>
          <tr><th>color</th><th>games</th><th>win%</th><th>accuracy</th><th>mistakes/game</th></tr>
        </thead>
        <tbody>
          {colors.map((col) => {
            const b = byColor[col]
            return (
              <tr key={col}>
                <td>{col}</td>
                <td>{b.games}</td>
                <td>{b.winPct}%</td>
                <td style={{ color: accuracyColor(b.accuracy), fontWeight: 600 }}>{b.accuracy}%</td>
                <td>{b.games ? Math.round((b.mistakes / b.games) * 10) / 10 : 0}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
