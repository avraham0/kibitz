import type { GameSummary } from '../api-types.js'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { AXIS, GRID, TOOLTIP } from './chartTheme.js'
import { linearTrend } from './trendLine.js'

export function RatingChart({ games }: { games: GameSummary[] }) {
  const sorted = games
    .filter((g) => g.playerRating !== null)
    .sort((a, b) => a.playedAt.localeCompare(b.playedAt))

  if (sorted.length < 3) return null

  const trend = linearTrend(sorted.map((g) => g.playerRating as number))
  const pts = sorted.map((g, i) => ({ date: g.playedAt.slice(0, 10), rating: g.playerRating as number, trend: Math.round(trend[i]) }))

  return (
    <section>
      <h2>Rating progress</h2>
      <p style={{ marginTop: 0, fontSize: 12, color: 'var(--muted)' }}>Rating per game, oldest to newest. Dashed = trend.</p>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={pts}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tick={AXIS.tick} stroke={AXIS.stroke} interval="preserveStartEnd" />
            <YAxis tick={AXIS.tick} stroke={AXIS.stroke} domain={['auto', 'auto']} />
            <Tooltip {...TOOLTIP} formatter={((v: number, name: string) => [v, name === 'trend' ? 'trend' : 'rating']) as any} />
            <Line type="monotone" dataKey="rating" stroke="#7bc47f" strokeWidth={2} dot={false} isAnimationActive={false} name="rating" />
            <Line type="monotone" dataKey="trend" stroke="#7bc47f" strokeWidth={1.5} strokeDasharray="5 3" dot={false} isAnimationActive={false} name="trend" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
