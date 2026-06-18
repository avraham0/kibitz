import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import type { Stats } from '../api-types.js'
import { COACHABLE_TYPES } from '../api-types.js'

export function MistakeTypesChart({ stats }: { stats: Stats }) {
  const data = COACHABLE_TYPES
    .map((t) => ({ type: t, missed: stats.byType[t].missed, allowed: stats.byType[t].allowed }))
    .filter((d) => d.missed + d.allowed > 0)
  return (
    <section>
      <h2>Mistake types</h2>
      <BarChart width={480} height={240} data={data}>
        <XAxis dataKey="type" angle={-30} textAnchor="end" height={70} interval={0} fontSize={10} />
        <YAxis allowDecimals={false} />
        <Tooltip /><Legend />
        <Bar dataKey="allowed" stackId="a" fill="#c66" />
        <Bar dataKey="missed" stackId="a" fill="#69c" />
      </BarChart>
    </section>
  )
}
