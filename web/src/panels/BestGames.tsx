import type { GameSummary } from '../api-types.js'
import { accuracyColor } from '../accuracyColor.js'

export function BestGames({ games, onOpenGame }: { games: GameSummary[]; onOpenGame?: (id: string) => void }) {
  const top = [...games]
    .filter((g) => g.result === 'win')
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 5)
  if (top.length < 3) return null
  return (
    <section>
      <h2>Best games</h2>
      <p style={{ marginTop: 0, fontSize: 12, color: 'var(--muted)' }}>Your highest-accuracy wins — study what you did right.</p>
      <table>
        <thead><tr><th>Date</th><th>Color</th><th>Opening</th><th>Accuracy</th><th></th></tr></thead>
        <tbody>
          {top.map((g) => (
            <tr key={g.gameId}>
              <td>{g.playedAt.slice(0, 10)}</td>
              <td>{g.color}</td>
              <td>{g.openingName}</td>
              <td style={{ color: accuracyColor(g.accuracy), fontWeight: 600 }}>{g.accuracy}%</td>
              <td>
                {onOpenGame && <button type="button" onClick={() => onOpenGame(g.gameId)}>review ›</button>}
                {g.url && <a style={{ marginLeft: 8 }} href={g.url} target="_blank" rel="noreferrer">chess.com ↗</a>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
