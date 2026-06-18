import type { Stats } from '../api-types.js'

export function SummaryCard({ stats }: { stats: Stats }) {
  const r = stats.record
  return (
    <section>
      <h2>Summary</h2>
      <p>
        Record: {r.wins}W-{r.losses}L-{r.draws}D · Games: {stats.gamesAnalyzed} · Mistakes: {stats.mistakeCount}
        {' '}· In already-lost positions (excluded): {stats.lostPositionMoves}
      </p>
    </section>
  )
}
