import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import type { Stats } from '../api-types.js'
import { TIME_BUCKETS } from '../api-types.js'
import { AXIS, GRID, TOOLTIP, COLORS } from './chartTheme.js'

export function TimePressureChart({ stats }: { stats: Stats }) {
  if (stats.gamesWithClock === 0) {
    return <section><h2>Time pressure</h2><p>No clock data in these games.</p></section>
  }
  const data = TIME_BUCKETS
    .map((b) => ({ bucket: b, ...stats.byTimeBucket[b], rate: stats.byTimeBucket[b].moves ? Math.round((stats.byTimeBucket[b].blunders / stats.byTimeBucket[b].moves) * 100) : 0 }))
    .filter((d) => d.moves > 0)
  return (
    <section>
      <h2>Time pressure</h2>
      <p>Clock data: {stats.gamesWithClock} of {stats.gamesAnalyzed} games</p>
      <div style={{ width: '100%', maxWidth: 480, height: 240 }}><ResponsiveContainer><BarChart data={data}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="bucket" tick={AXIS.tick} stroke={AXIS.stroke} />
        <YAxis allowDecimals={false} unit="%" tick={AXIS.tick} stroke={AXIS.stroke} />
        <Tooltip {...TOOLTIP} />
        <Bar dataKey="rate" name="blunder rate %" fill={COLORS.allowed} radius={[4, 4, 0, 0]} />
      </BarChart></ResponsiveContainer></div>
    </section>
  )
}
