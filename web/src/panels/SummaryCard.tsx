import type { Stats } from '../api-types.js'

export function SummaryCard({ stats }: { stats: Stats }) {
  const r = stats.record
  const tiles = [
    { label: 'Accuracy', value: `${stats.accuracy}%` },
    { label: 'Record', value: `${r.wins}W-${r.losses}L-${r.draws}D` },
    { label: 'Games', value: String(stats.gamesAnalyzed) },
    { label: 'Mistakes', value: String(stats.mistakeCount) },
    { label: 'Lost-pos (excluded)', value: String(stats.lostPositionMoves) },
  ]
  return (
    <section>
      <h2>Summary</h2>
      <div className="stats">
        {tiles.map((t) => (
          <div className="stat" key={t.label}>
            <div className="stat-value">{t.value}</div>
            <div className="stat-label">{t.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
