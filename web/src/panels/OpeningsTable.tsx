import { useState, Fragment } from 'react'
import type { OpeningStat, GameSummary } from '../api-types.js'
import { accuracyColor } from '../accuracyColor.js'

function avgDepth(gs: GameSummary[]): string {
  const depths: number[] = []
  for (const g of gs) {
    const m = g.moves.find((mv) => mv.isPlayerMove && mv.phase === 'middlegame')
    if (m) depths.push(Math.ceil(m.ply / 2))
  }
  if (depths.length === 0) return '—'
  return `move ${Math.round(depths.reduce((a, b) => a + b, 0) / depths.length)}`
}

function trend(gs: GameSummary[]): string {
  if (gs.length < 4) return '—'
  const sorted = [...gs].sort((a, b) => a.playedAt.localeCompare(b.playedAt))
  const mid = Math.floor(sorted.length / 2)
  const earlier = sorted.slice(0, mid)
  const recent = sorted.slice(mid)
  const winPct = (arr: GameSummary[]) => Math.round((arr.filter((g) => g.result === 'win').length / arr.length) * 100)
  const diff = winPct(recent) - winPct(earlier)
  if (diff >= 10) return '↑'
  if (diff <= -10) return '↓'
  return '—'
}

// Games belonging to one opening row. In family mode `o.name` is the family
// (matches g.family); in variations mode it's the full line (matches g.openingName).
function gamesIn(games: GameSummary[], name: string): GameSummary[] {
  return games.filter((g) => g.family === name || g.openingName === name)
}

// Recurring mistakes + game list for the games in one opening.
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
              <td>
                <span style={{ color: accuracyColor(g.accuracy), fontWeight: 600 }}>{g.accuracy}%</span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}> (≈{g.accuracyStrict}%)</span>
              </td>
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
        <thead><tr><th></th><th>Opening</th><th>Games</th><th>Win %</th><th>Avg mistakes</th><th>Avg depth</th><th>Trend</th></tr></thead>
        <tbody>
          {openings.map((o, i) => {
            const expanded = open === i
            return (
              <Fragment key={i}>
                <tr style={{ cursor: 'pointer' }} onClick={() => setOpen(expanded ? null : i)}>
                  <td>{expanded ? '▾' : '▸'}</td>
                  <td>{o.name}</td><td>{o.games}</td><td>{o.winPct}</td><td>{o.avgMistakes}</td>
                  <td>{avgDepth(gamesIn(games, o.name))}</td>
                  <td>{trend(gamesIn(games, o.name))}</td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={7}><OpeningDetail games={gamesIn(games, o.name)} onOpenGame={onOpenGame} /></td>
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
