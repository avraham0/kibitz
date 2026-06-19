import type { Stats } from '../api-types.js'

export function OpeningRecommendations({ stats }: { stats: Stats }) {
  const totalGames = stats.record.wins + stats.record.losses + stats.record.draws
  const overallWinPct = totalGames ? Math.round((stats.record.wins / totalGames) * 100) : 50

  const flagged = stats.openings
    .filter((o) => o.games >= 3 && o.winPct <= overallWinPct - 15)
    .sort((a, b) => (a.winPct - overallWinPct) - (b.winPct - overallWinPct))
    .slice(0, 3)

  if (flagged.length === 0) return null
  return (
    <section>
      <h2>Opening recommendations</h2>
      <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {flagged.map((o) => (
          <li key={o.eco} style={{ fontSize: 14 }}>
            <strong>{o.name}</strong> ({o.eco}) — {o.winPct}% win rate vs your {overallWinPct}% average
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>
              {o.games} games · {o.avgMistakes} mistakes/game avg · consider a repertoire change or focused study
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
