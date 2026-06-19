import type { GameSummary } from '../api-types.js'

export function EndgameStats({ games }: { games: GameSummary[] }) {
  type Band = 'ahead' | 'equal' | 'behind'
  const agg: Record<Band, { games: number; wins: number }> = {
    ahead: { games: 0, wins: 0 },
    equal: { games: 0, wins: 0 },
    behind: { games: 0, wins: 0 },
  }
  for (const g of games) {
    const firstEndgame = g.moves.find((m) => m.isPlayerMove && m.phase === 'endgame')
    if (!firstEndgame) continue
    const playerPov = g.color === 'white' ? firstEndgame.evalCp : -firstEndgame.evalCp
    const band: Band = playerPov > 100 ? 'ahead' : playerPov < -100 ? 'behind' : 'equal'
    agg[band].games++
    if (g.result === 'win') agg[band].wins++
  }
  const total = agg.ahead.games + agg.equal.games + agg.behind.games
  if (total === 0) return null
  const rows: { label: string; band: Band; color: string }[] = [
    { label: 'Ahead (>+1)', band: 'ahead', color: '#7bc47f' },
    { label: 'Equal', band: 'equal', color: 'var(--muted)' },
    { label: 'Behind (<−1)', band: 'behind', color: 'rgb(224,121,107)' },
  ]
  return (
    <section>
      <h2>Endgame conversion</h2>
      <p style={{ marginTop: 0, fontSize: 12, color: 'var(--muted)' }}>{total} games reached the endgame</p>
      <table>
        <thead><tr><th>Entry</th><th>Games</th><th>Win %</th></tr></thead>
        <tbody>
          {rows.map(({ label, band, color }) => {
            const { games: n, wins } = agg[band]
            if (n === 0) return null
            const pct = Math.round((wins / n) * 100)
            return (
              <tr key={band}>
                <td style={{ color }}>{label}</td>
                <td>{n}</td>
                <td style={{ fontWeight: 600 }}>{pct}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
