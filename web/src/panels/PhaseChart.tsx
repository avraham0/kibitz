import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import type { Stats } from '../api-types.js'

export function PhaseChart({ stats }: { stats: Stats }) {
  const data = (['opening', 'middlegame', 'endgame'] as const).map((p) => ({ phase: p, mistakes: stats.byPhase[p] }))
  return (
    <section>
      <h2>Mistakes by phase</h2>
      <BarChart width={480} height={240} data={data}>
        <XAxis dataKey="phase" tick={{ fill: '#bbb' }} stroke="#555" /><YAxis allowDecimals={false} tick={{ fill: '#bbb' }} stroke="#555" /><Tooltip />
        <Bar dataKey="mistakes" fill="#69c" />
      </BarChart>
    </section>
  )
}
