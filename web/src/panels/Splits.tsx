import { useState } from 'react'
import type { Stats, GameSummary, OpponentBand } from '../api-types.js'
import { accuracyColor } from '../accuracyColor.js'

const BAND_LABEL: Record<OpponentBand, string> = {
  stronger: 'vs stronger (+50)', similar: 'vs similar (±50)', weaker: 'vs weaker (−50)',
}

// Winning-position conversion (with a drill-down of the games you let slip),
// a White/Black breakdown, and an opponent-strength split.
export function Splits({ stats, games = [], onOpenGame }: { stats: Stats; games?: GameSummary[]; onOpenGame?: (id: string, ply?: number) => void }) {
  const { conversion: c, byColor, byOpponent } = stats
  const [showBlown, setShowBlown] = useState(false)
  const convPct = c.winningGames ? Math.round((c.converted / c.winningGames) * 100) : null
  const blown = games.filter((g) => g.wasWinning && g.result !== 'win')
  const colors = ['white', 'black'] as const
  const bands = ['stronger', 'similar', 'weaker'] as const
  const hasOpp = bands.some((b) => byOpponent[b].games > 0)

  return (
    <section>
      <h2>Conversion, color & opponents</h2>

      <p style={{ marginTop: 0 }}>
        {c.winningGames > 0 ? (
          <>
            Converted <strong>{c.converted} / {c.winningGames}</strong> winning positions (<strong>{convPct}%</strong>).{' '}
            {blown.length > 0 && (
              <button type="button" onClick={() => setShowBlown((v) => !v)}>
                {showBlown ? 'hide' : `show ${blown.length} you let slip`}
              </button>
            )}
          </>
        ) : (
          <span style={{ color: 'var(--muted)' }}>No clearly winning positions reached in these games.</span>
        )}
      </p>

      {showBlown && blown.length > 0 && (
        <table>
          <thead><tr><th>date</th><th>color</th><th>result</th><th>accuracy</th><th></th></tr></thead>
          <tbody>
            {blown.map((g, i) => (
              <tr key={i}>
                <td>{g.playedAt.slice(0, 10)}</td>
                <td>{g.color}</td>
                <td>{g.result}</td>
                <td style={{ color: accuracyColor(g.accuracy), fontWeight: 600 }}>{g.accuracy}%</td>
                <td>{onOpenGame && <button type="button" onClick={() => onOpenGame(g.gameId, g.turningPointIdx ?? undefined)}>review ›</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ marginBottom: 4 }}>By color</h3>
      <table>
        <thead><tr><th>color</th><th>games</th><th>win%</th><th>accuracy</th><th>mistakes/game</th></tr></thead>
        <tbody>
          {colors.map((col) => {
            const b = byColor[col]
            return (
              <tr key={col}>
                <td>{col}</td><td>{b.games}</td><td>{b.winPct}%</td>
                <td style={{ color: accuracyColor(b.accuracy), fontWeight: 600 }}>{b.accuracy}%</td>
                <td>{b.games ? Math.round((b.mistakes / b.games) * 10) / 10 : 0}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h3 style={{ marginBottom: 4 }}>By opponent strength</h3>
      {hasOpp ? (
        <table>
          <thead><tr><th>opponent</th><th>games</th><th>win%</th><th>accuracy</th><th>mistakes/game</th></tr></thead>
          <tbody>
            {bands.filter((b) => byOpponent[b].games > 0).map((b) => {
              const o = byOpponent[b]
              return (
                <tr key={b}>
                  <td>{BAND_LABEL[b]}</td><td>{o.games}</td>
                  <td>{o.games ? Math.round((o.wins / o.games) * 100) : 0}%</td>
                  <td style={{ color: accuracyColor(o.accuracy), fontWeight: 600 }}>{o.accuracy}%</td>
                  <td>{o.games ? Math.round((o.mistakes / o.games) * 10) / 10 : 0}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <p style={{ color: 'var(--muted)' }}>No opponent ratings in these games.</p>
      )}
    </section>
  )
}
