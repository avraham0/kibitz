import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import type { Stats } from '../api-types.js'

export function PhaseChart({ stats }: { stats: Stats }) {
  const data = (['opening', 'middlegame', 'endgame'] as const).map((p) => ({ phase: p, mistakes: stats.byPhase[p] }))
  return (
    <section>
      <h2>Mistakes by phase</h2>
      <BarChart width={480} height={240} data={data}>
        <XAxis dataKey="phase" /><YAxis allowDecimals={false} /><Tooltip />
        <Bar dataKey="mistakes" fill="#69c" />
      </BarChart>
    </section>
  )
}
