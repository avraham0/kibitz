import type { GameSummary } from '../api-types.js'
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { AXIS, GRID } from './chartTheme.js'

export function ClockAccuracyChart({ games }: { games: GameSummary[] }) {
  const buckets: Record<number, { total: number; bad: number }> = {}
  for (const g of games) {
    for (const m of g.moves) {
      if (!m.isPlayerMove || m.clockSeconds == null) continue
      const b = Math.floor(Math.min(m.clockSeconds, 120) / 5) * 5
      if (!buckets[b]) buckets[b] = { total: 0, bad: 0 }
      buckets[b].total++
      if (m.severity !== 'ok') buckets[b].bad++
    }
  }
  const data = Object.entries(buckets)
    .map(([b, { total, bad }]) => ({ clock: Number(b), mistakePct: Math.round((bad / total) * 100), moves: total }))
    .sort((a, b) => a.clock - b.clock)
    .filter((d) => d.moves >= 3)

  if (data.length < 4) return null
  return (
    <section>
      <h2>Clock vs mistake rate</h2>
      <p style={{ marginTop: 0, fontSize: 12, color: 'var(--muted)' }}>Mistake % by time remaining on clock (5-second buckets, ≥3 moves each)</p>
      <ScatterChart width={460} height={200} data={data}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="clock" name="Clock (s)" tick={AXIS.tick} stroke={AXIS.stroke} label={{ value: 'clock (s)', position: 'insideBottom', offset: -2, style: { fontSize: 11, fill: '#6b7280' } }} />
        <YAxis dataKey="mistakePct" name="Mistake %" tick={AXIS.tick} stroke={AXIS.stroke} unit="%" />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v: number, n: string) => [n === 'mistakePct' ? `${v}%` : v, n === 'mistakePct' ? 'mistake rate' : 'moves']} />
        <Scatter data={data} fill="#e0b15a" isAnimationActive={false} />
      </ScatterChart>
    </section>
  )
}
