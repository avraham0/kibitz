import type { GameSummary } from '../api-types.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid, ResponsiveContainer } from 'recharts'
import { AXIS, GRID, TOOLTIP } from './chartTheme.js'

const SEVERITY_COLOR: Record<string, string> = {
  ok: '#7bc47f',
  inaccuracy: '#e0b15a',
  mistake: 'rgb(224,150,80)',
  blunder: 'rgb(224,121,107)',
}

export function MoveQualityChart({ games }: { games: GameSummary[] }) {
  const counts: Record<string, number> = { ok: 0, inaccuracy: 0, mistake: 0, blunder: 0 }
  for (const g of games) {
    for (const m of g.moves) {
      if (m.isPlayerMove) counts[m.severity] = (counts[m.severity] ?? 0) + 1
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) return null
  const data = (['ok', 'inaccuracy', 'mistake', 'blunder'] as const).map((s) => ({
    name: s, count: counts[s], pct: total ? Math.round((counts[s] / total) * 100) : 0,
  }))
  return (
    <section>
      <h2>Move quality</h2>
      <div style={{ width: '100%', maxWidth: 420, height: 200 }}><ResponsiveContainer><BarChart data={data}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={AXIS.tick} stroke={AXIS.stroke} />
        <YAxis tick={AXIS.tick} stroke={AXIS.stroke} />
        <Tooltip
          {...TOOLTIP}
          formatter={((v: number, _name: string, entry: { payload?: { pct?: number } }) =>
            [`${v} (${entry.payload?.pct ?? 0}%)`, 'moves']) as any
          }
        />
        <Bar dataKey="count" isAnimationActive={false} radius={[3, 3, 0, 0]}>
          {data.map((d) => <Cell key={d.name} fill={SEVERITY_COLOR[d.name]} />)}
        </Bar>
      </BarChart></ResponsiveContainer></div>
    </section>
  )
}
