import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts'
import type { Stats } from '../api-types.js'
import { COACHABLE_TYPES } from '../api-types.js'
import { AXIS, GRID, TOOLTIP, COLORS } from './chartTheme.js'

export function MistakeTypesChart({ stats }: { stats: Stats }) {
  const data = COACHABLE_TYPES
    .map((t) => ({ type: t, missed: stats.byType[t].missed, allowed: stats.byType[t].allowed }))
    .filter((d) => d.missed + d.allowed > 0)
  return (
    <section>
      <h2>Mistake types</h2>
      <BarChart layout="vertical" width={520} height={Math.max(160, 44 + data.length * 32)} data={data} margin={{ left: 30, right: 12 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={AXIS.tick} stroke={AXIS.stroke} />
        <YAxis type="category" dataKey="type" width={130} tick={AXIS.tick} stroke={AXIS.stroke} />
        <Tooltip {...TOOLTIP} />
        <Legend wrapperStyle={{ color: '#9aa3b2' }} />
        <Bar dataKey="allowed" name="allowed" stackId="a" fill={COLORS.allowed} />
        <Bar dataKey="missed" name="missed" stackId="a" fill={COLORS.missed} radius={[0, 4, 4, 0]} />
      </BarChart>
    </section>
  )
}
