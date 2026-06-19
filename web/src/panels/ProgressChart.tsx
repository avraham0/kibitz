import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import type { GameSummary } from '../api-types.js'
import { AXIS, GRID, TOOLTIP, COLORS } from './chartTheme.js'

// Average accuracy per calendar month across the analyzed games — a "are you
// improving?" trend. Needs ≥2 months of data to be meaningful, else it's hidden.
export function ProgressChart({ games }: { games: GameSummary[] }) {
  const byMonth = new Map<string, { sum: number; n: number; rSum: number; rN: number }>()
  for (const g of games) {
    const month = g.playedAt.slice(0, 7) // YYYY-MM
    const e = byMonth.get(month) ?? { sum: 0, n: 0, rSum: 0, rN: 0 }
    e.sum += g.accuracy
    e.n++
    if (g.playerRating != null) { e.rSum += g.playerRating; e.rN++ }
    byMonth.set(month, e)
  }
  const data = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, e]) => ({ month, accuracy: Math.round(e.sum / e.n), games: e.n, rating: e.rN ? Math.round(e.rSum / e.rN) : null }))

  if (data.length < 2) return null
  const hasRating = data.some((d) => d.rating != null)

  return (
    <section>
      <h2>Progress over time</h2>
      <LineChart width={480} height={240} data={data}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tick={AXIS.tick} stroke={AXIS.stroke} />
        <YAxis yAxisId="left" domain={[0, 100]} tick={AXIS.tick} stroke={AXIS.stroke} unit="%" />
        {hasRating && <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} tick={AXIS.tick} stroke={AXIS.stroke} />}
        <Tooltip {...TOOLTIP} />
        <Line yAxisId="left" type="monotone" dataKey="accuracy" name="accuracy %" stroke={COLORS.line} strokeWidth={2} dot isAnimationActive={false} />
        {hasRating && <Line yAxisId="right" type="monotone" dataKey="rating" name="rating" stroke={COLORS.accent} strokeWidth={2} dot connectNulls isAnimationActive={false} />}
      </LineChart>
    </section>
  )
}
