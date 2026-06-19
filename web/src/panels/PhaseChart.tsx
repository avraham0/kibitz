import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import type { Stats } from '../api-types.js'
import { AXIS, GRID, TOOLTIP, COLORS } from './chartTheme.js'

export function PhaseChart({ stats }: { stats: Stats }) {
  const data = (['opening', 'middlegame', 'endgame'] as const).map((p) => ({ phase: p, mistakes: stats.byPhase[p] }))
  return (
    <section>
      <h2>Mistakes by phase</h2>
      <BarChart width={480} height={240} data={data}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="phase" tick={AXIS.tick} stroke={AXIS.stroke} />
        <YAxis allowDecimals={false} tick={AXIS.tick} stroke={AXIS.stroke} />
        <Tooltip {...TOOLTIP} />
        <Bar dataKey="mistakes" fill={COLORS.bar} radius={[4, 4, 0, 0]} />
      </BarChart>
    </section>
  )
}
