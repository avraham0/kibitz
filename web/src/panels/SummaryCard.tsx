import type { Stats } from '../api-types.js'
import { accuracyColor } from '../accuracyColor.js'

export function SummaryCard({ stats }: { stats: Stats }) {
  const r = stats.record
  const { winningGames, converted } = stats.conversion
  const missedWins = winningGames - converted
  const tiles: { label: string; value: string; color?: string; sub?: string }[] = [
    { label: 'Accuracy', value: `${stats.accuracy}%`, color: accuracyColor(stats.accuracy) },
    { label: 'Record', value: `${r.wins}W-${r.losses}L-${r.draws}D` },
    { label: 'Games', value: String(stats.gamesAnalyzed) },
    { label: 'Mistakes', value: String(stats.mistakeCount) },
    { label: 'Missed wins', value: winningGames ? `${missedWins} / ${winningGames}` : '—', color: missedWins > 0 ? 'rgb(224,121,107)' : undefined, sub: winningGames ? `converted ${converted}` : undefined },
  ]
  return (
    <section>
      <h2>Summary</h2>
      <div className="stats">
        {tiles.map((t) => (
          <div className="stat" key={t.label}>
            <div className="stat-value" style={t.color ? { color: t.color } : undefined}>{t.value}</div>
            {t.sub && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.sub}</div>}
            <div className="stat-label">{t.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
