import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import type { GameSummary } from '../api-types.js'
import { AXIS, GRID, TOOLTIP, COLORS } from './chartTheme.js'
import { linearTrend } from './trendLine.js'

export function ProgressChart({ games }: { games: GameSummary[] }) {
  const byMonth = new Map<string, { sum: number; n: number }>()
  for (const g of games) {
    const month = g.playedAt.slice(0, 7)
    const e = byMonth.get(month) ?? { sum: 0, n: 0 }
    e.sum += g.accuracy
    e.n++
    byMonth.set(month, e)
  }
  const rows = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, e]) => ({ month, accuracy: Math.round(e.sum / e.n), games: e.n }))

  if (rows.length < 2) return null

  const trend = linearTrend(rows.map((r) => r.accuracy))
  const data = rows.map((r, i) => ({ ...r, trend: Math.round(trend[i] * 10) / 10 }))

  return (
    <section>
      <h2>Accuracy over time</h2>
      <p style={{ marginTop: 0, fontSize: 12, color: 'var(--muted)' }}>Monthly average accuracy. Dashed = trend.</p>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tick={AXIS.tick} stroke={AXIS.stroke} />
            <YAxis domain={[0, 100]} tick={AXIS.tick} stroke={AXIS.stroke} unit="%" />
            <Tooltip {...TOOLTIP} formatter={((v: number, name: string) => [`${v}%`, name === 'trend' ? 'trend' : 'accuracy']) as any} />
            <Line type="monotone" dataKey="accuracy" name="accuracy" stroke={COLORS.line} strokeWidth={2} dot isAnimationActive={false} />
            <Line type="monotone" dataKey="trend" name="trend" stroke={COLORS.line} strokeWidth={1.5} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
