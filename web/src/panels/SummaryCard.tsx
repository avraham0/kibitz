import type { Stats, GameSummary } from '../api-types.js'
import { accuracyColor } from '../accuracyColor.js'

function blunderRecovery(games: GameSummary[]): { afterPct: number; basePct: number } | null {
  let afterMistakes = 0, afterTotal = 0, baseMistakes = 0, baseTotal = 0
  for (const g of games) {
    const playerMoves = g.moves.filter((m) => m.isPlayerMove)
    const blunderIdxs = new Set(
      playerMoves.map((m, i) => (m.severity === 'blunder' ? i : -1)).filter((i) => i >= 0),
    )
    playerMoves.forEach((m, i) => {
      const inAftermath = [...blunderIdxs].some((bi) => i > bi && i <= bi + 3)
      const isMistake = m.severity !== 'ok'
      if (inAftermath) { afterTotal++; if (isMistake) afterMistakes++ }
      else { baseTotal++; if (isMistake) baseMistakes++ }
    })
  }
  if (afterTotal < 10) return null
  return {
    afterPct: Math.round((afterMistakes / afterTotal) * 100),
    basePct: baseTotal ? Math.round((baseMistakes / baseTotal) * 100) : 0,
  }
}

function ratingTrend(games: GameSummary[]): { delta: number; first: number; last: number } | null {
  const rated = games.filter((g) => g.playerRating != null).sort((a, b) => a.playedAt.localeCompare(b.playedAt))
  if (rated.length < 2) return null
  const first = rated[0].playerRating!
  const last = rated[rated.length - 1].playerRating!
  return { delta: last - first, first, last }
}

export function SummaryCard({ stats, games = [] }: { stats: Stats; games?: GameSummary[] }) {
  const r = stats.record
  const { winningGames, converted } = stats.conversion
  const missedWins = winningGames - converted
  const rec = blunderRecovery(games)
  const trend = ratingTrend(games)
  const tiltDelta = rec ? rec.afterPct - rec.basePct : 0
  const tiles: { label: string; value: string; color?: string; sub?: string; badge?: string; badgeColor?: string; title?: string }[] = [
    { label: 'Accuracy', value: `${stats.accuracy}%`, color: accuracyColor(stats.accuracy) },
    { label: 'Record', value: `${r.wins}W-${r.losses}L-${r.draws}D` },
    { label: 'Games', value: String(stats.gamesAnalyzed) },
    ...(trend ? [{ label: 'Rating', value: String(trend.last), badge: `${trend.delta >= 0 ? '+' : ''}${trend.delta}`, badgeColor: trend.delta >= 0 ? '#7bc47f' : '#e0796b', sub: `from ${trend.first}` }] : []),
    { label: 'Mistakes', value: String(stats.mistakeCount) },
    { label: 'Missed wins', value: winningGames ? `${missedWins} / ${winningGames}` : '—', color: missedWins > 0 ? 'rgb(224,121,107)' : undefined, sub: winningGames ? `converted ${converted}` : undefined },
    ...(rec ? [{
      label: 'Tilt',
      value: `${tiltDelta >= 0 ? '+' : ''}${tiltDelta}%`,
      color: tiltDelta > 10 ? 'rgb(224,121,107)' : tiltDelta <= 0 ? '#7bc47f' : undefined,
      sub: `${rec.afterPct}% vs ${rec.basePct}% normal`,
      title: 'How much more you blunder right after a blunder. Compares your mistake rate in the 3 moves following a blunder against your normal rate. Positive = you play worse after blundering (tilt); 0 or negative = you steady yourself.',
    }] : []),
  ]
  return (
    <section>
      <h2>Summary</h2>
      <div className="stats">
        {tiles.map((t) => (
          <div className="stat" key={t.label} title={t.title} style={t.title ? { cursor: 'help' } : undefined}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <div className="stat-value" style={t.color ? { color: t.color } : undefined}>{t.value}</div>
              {t.badge && <span style={{ fontSize: 13, fontWeight: 700, color: t.badgeColor }}>{t.badge}</span>}
            </div>
            {t.sub && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t.sub}</div>}
            <div className="stat-label">{t.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
