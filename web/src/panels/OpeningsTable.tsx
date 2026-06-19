import { useState, Fragment } from 'react'
import type { OpeningStat, GameSummary } from '../api-types.js'
import { accuracyColor } from '../accuracyColor.js'

// Recurring mistakes + game list for the games in one opening (grouped by ECO).
function OpeningDetail({ games, onOpenGame }: { games: GameSummary[]; onOpenGame?: (id: string) => void }) {
  const tally: Record<string, number> = {}
  for (const g of games) {
    for (const m of g.moves) {
      if (m.isPlayerMove && m.severity !== 'ok') tally[m.type] = (tally[m.type] ?? 0) + 1
    }
  }
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 5)
  return (
    <div style={{ padding: '4px 0 8px' }}>
      <div style={{ marginBottom: 6, fontSize: 13 }}>
        {top.length
          ? <>Common mistakes: {top.map(([t, n]) => `${t} (${n})`).join(' · ')}</>
          : <span style={{ color: 'var(--muted)' }}>No mistakes recorded in this opening.</span>}
      </div>
      <table>
        <thead><tr><th>date</th><th>color</th><th>result</th><th>accuracy</th><th></th></tr></thead>
        <tbody>
          {games.map((g, i) => (
            <tr key={i}>
              <td>{g.playedAt.slice(0, 10)}</td>
              <td>{g.color}</td>
              <td>{g.result}</td>
              <td style={{ color: accuracyColor(g.accuracy), fontWeight: 600 }}>{g.accuracy}%</td>
              <td>{onOpenGame && <button type="button" onClick={() => onOpenGame(g.gameId)}>review ›</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function OpeningsTable({ openings, games = [], onOpenGame }: { openings: OpeningStat[]; games?: GameSummary[]; onOpenGame?: (id: string) => void }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section>
      <h2>Openings</h2>
      <p style={{ marginTop: 0, fontSize: 12, color: 'var(--muted)' }}>Click a row to see its games and recurring mistakes.</p>
      <table>
        <thead><tr><th></th><th>ECO</th><th>Opening</th><th>Games</th><th>Win %</th><th>Avg mistakes</th></tr></thead>
        <tbody>
          {openings.map((o, i) => {
            const expanded = open === i
            return (
              <Fragment key={i}>
                <tr style={{ cursor: 'pointer' }} onClick={() => setOpen(expanded ? null : i)}>
                  <td>{expanded ? '▾' : '▸'}</td>
                  <td>{o.eco}</td><td>{o.name}</td><td>{o.games}</td><td>{o.winPct}</td><td>{o.avgMistakes}</td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={6}><OpeningDetail games={games.filter((g) => g.eco === o.eco)} onOpenGame={onOpenGame} /></td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
