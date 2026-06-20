import type { GameSummary } from '../api-types.js'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer } from 'recharts'
import { AXIS, GRID, TOOLTIP } from './chartTheme.js'

export function RatingChart({ games }: { games: GameSummary[] }) {
  const pts = games
    .filter((g) => g.playerRating !== null)
    .sort((a, b) => a.playedAt.localeCompare(b.playedAt))
    .map((g) => ({ date: g.playedAt.slice(0, 10), rating: g.playerRating as number, accuracy: g.accuracy }))
  if (pts.length < 3) return null
  return (
    <section>
      <h2>Rating progress</h2>
      <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tick={AXIS.tick} stroke={AXIS.stroke} interval="preserveStartEnd" />
          <YAxis yAxisId="r" tick={AXIS.tick} stroke={AXIS.stroke} domain={['auto', 'auto']} />
          <YAxis yAxisId="a" orientation="right" tick={AXIS.tick} stroke={AXIS.stroke} domain={[0, 100]} />
          <Tooltip {...TOOLTIP} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line yAxisId="r" type="monotone" dataKey="rating" stroke="#7bc47f" strokeWidth={2} dot={false} isAnimationActive={false} name="Rating" />
          <Line yAxisId="a" type="monotone" dataKey="accuracy" stroke="#e0b15a" strokeWidth={2} dot={false} isAnimationActive={false} name="Accuracy %" />
        </LineChart>
      </ResponsiveContainer>
      </div>
    </section>
  )
}
