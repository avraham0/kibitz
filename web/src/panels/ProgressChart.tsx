import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'
import type { GameSummary } from '../api-types.js'

// Average accuracy per calendar month across the analyzed games — a "are you
// improving?" trend. Needs ≥2 months of data to be meaningful, else it's hidden.
export function ProgressChart({ games }: { games: GameSummary[] }) {
  const byMonth = new Map<string, { sum: number; n: number }>()
  for (const g of games) {
    const month = g.playedAt.slice(0, 7) // YYYY-MM
    const e = byMonth.get(month) ?? { sum: 0, n: 0 }
    e.sum += g.accuracy
    e.n++
    byMonth.set(month, e)
  }
  const data = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, e]) => ({ month, accuracy: Math.round(e.sum / e.n), games: e.n }))

  if (data.length < 2) return null

  return (
    <section>
      <h2>Progress over time</h2>
      <LineChart width={480} height={240} data={data}>
        <XAxis dataKey="month" tick={{ fill: '#bbb' }} stroke="#555" />
        <YAxis domain={[0, 100]} tick={{ fill: '#bbb' }} stroke="#555" unit="%" />
        <Tooltip />
        <Line type="monotone" dataKey="accuracy" name="accuracy %" stroke="#9c6" isAnimationActive={false} />
      </LineChart>
    </section>
  )
}
