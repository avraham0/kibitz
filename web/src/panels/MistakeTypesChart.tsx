import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from 'recharts'
import type { Stats, GameSummary, CoachableType } from '../api-types.js'
import { COACHABLE_TYPES } from '../api-types.js'
import { AXIS, GRID, TOOLTIP, COLORS } from './chartTheme.js'
import { accuracyColor } from '../accuracyColor.js'

export function MistakeTypesChart({ stats, games = [], onOpenGame }: { stats: Stats; games?: GameSummary[]; onOpenGame?: (id: string) => void }) {
  const [sel, setSel] = useState<CoachableType | null>(null)
  const data = COACHABLE_TYPES
    .map((t) => ({ type: t, missed: stats.byType[t].missed, allowed: stats.byType[t].allowed }))
    .filter((d) => d.missed + d.allowed > 0)

  // Games that contain at least one player mistake of the selected type.
  const gamesForType = sel
    ? games.filter((g) => g.moves.some((m) => m.isPlayerMove && m.severity !== 'ok' && m.type === sel))
    : []

  return (
    <section>
      <h2>Mistake types</h2>
      <p style={{ marginTop: 0, fontSize: 12, color: 'var(--muted)' }}>Click a type to see the games where it happened.</p>
      <ResponsiveContainer width="100%" height={Math.max(160, 44 + data.length * 32)}>
        <BarChart
          layout="vertical" data={data} margin={{ left: 30, right: 12 }}
          style={{ cursor: 'pointer' }}
          onClick={(s: any) => { if (s?.activeLabel) setSel(s.activeLabel as CoachableType) }}
        >
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={AXIS.tick} stroke={AXIS.stroke} />
          <YAxis type="category" dataKey="type" width={130} tick={AXIS.tick} stroke={AXIS.stroke} />
          <Tooltip {...TOOLTIP} />
          <Legend wrapperStyle={{ color: '#9aa3b2' }} />
          <Bar dataKey="allowed" name="allowed" stackId="a" fill={COLORS.allowed} />
          <Bar dataKey="missed" name="missed" stackId="a" fill={COLORS.missed} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {sel && (
        <div style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 6 }}>
            <strong>{sel}</strong> — {gamesForType.length} game{gamesForType.length === 1 ? '' : 's'}{' '}
            <button type="button" onClick={() => setSel(null)} style={{ marginLeft: 6 }}>clear</button>
          </div>
          {gamesForType.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No games with this mistake type in the current set.</p>
          ) : (
            <table>
              <thead><tr><th>date</th><th>color</th><th>result</th><th>accuracy</th><th>count</th><th></th></tr></thead>
              <tbody>
                {gamesForType.map((g, i) => {
                  const count = g.moves.filter((m) => m.isPlayerMove && m.severity !== 'ok' && m.type === sel).length
                  return (
                    <tr key={i}>
                      <td>{g.playedAt.slice(0, 10)}</td>
                      <td>{g.color}</td>
                      <td>{g.result}</td>
                      <td style={{ color: accuracyColor(g.accuracy), fontWeight: 600 }}>{g.accuracy}%</td>
                      <td>{count}</td>
                      <td>{onOpenGame && <button type="button" onClick={() => onOpenGame(g.gameId)}>review ›</button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  )
}
