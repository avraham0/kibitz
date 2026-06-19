import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts'
import type { Stats } from '../api-types.js'
import { AXIS, GRID, TOOLTIP, COLORS } from './chartTheme.js'

// Mistake count (bars, left axis) and accuracy (line, right axis) per game phase —
// shows not just where you err most but where your play is weakest.
export function PhaseChart({ stats }: { stats: Stats }) {
  const data = (['opening', 'middlegame', 'endgame'] as const).map((p) => ({
    phase: p, mistakes: stats.byPhase[p], accuracy: stats.accuracyByPhase[p],
  }))
  return (
    <section>
      <h2>By phase</h2>
      <ComposedChart width={480} height={240} data={data}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="phase" tick={AXIS.tick} stroke={AXIS.stroke} />
        <YAxis yAxisId="left" allowDecimals={false} tick={AXIS.tick} stroke={AXIS.stroke} />
        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tick={AXIS.tick} stroke={AXIS.stroke} />
        <Tooltip {...TOOLTIP} />
        <Legend wrapperStyle={{ color: '#9aa3b2' }} />
        <Bar yAxisId="left" dataKey="mistakes" name="mistakes" fill={COLORS.bar} radius={[4, 4, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="accuracy" name="accuracy %" stroke={COLORS.line} strokeWidth={2} isAnimationActive={false} />
      </ComposedChart>
    </section>
  )
}
