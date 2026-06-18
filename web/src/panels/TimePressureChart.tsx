import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import type { Stats } from '../api-types.js'
import { TIME_BUCKETS } from '../api-types.js'

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
      <BarChart width={480} height={240} data={data}>
        <XAxis dataKey="bucket" tick={{ fill: '#bbb' }} stroke="#555" /><YAxis allowDecimals={false} unit="%" tick={{ fill: '#bbb' }} stroke="#555" /><Tooltip />
        <Bar dataKey="rate" name="blunder rate %" fill="#c66" />
      </BarChart>
    </section>
  )
}
