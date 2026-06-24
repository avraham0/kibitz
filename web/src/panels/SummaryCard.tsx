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

// Median rating across the analyzed games — robust to outliers and to mixing rating
// pools (bullet vs rapid). The time trend lives in the Rating/Progress charts; this
// tile is just a representative snapshot.
function medianRating(games: GameSummary[]): number | null {
  const r = games.map((g) => g.playerRating).filter((x): x is number => x != null).sort((a, b) => a - b)
  if (r.length === 0) return null
  const mid = Math.floor(r.length / 2)
  return r.length % 2 ? r[mid] : Math.round((r[mid - 1] + r[mid]) / 2)
}

export function SummaryCard({ stats, games = [] }: { stats: Stats; games?: GameSummary[] }) {
  const r = stats.record
  const { winningGames, converted } = stats.conversion
  const missedWins = winningGames - converted
  const rec = blunderRecovery(games)
  const medRating = medianRating(games)
  const tiltDelta = rec ? rec.afterPct - rec.basePct : 0
  // All tiles render every time (placeholder '—' until their data is ready) so the
  // Summary row doesn't reflow / jump as partial results stream in during analysis.
  const tiles: { label: string; value: string; color?: string; sub?: string; badge?: string; badgeColor?: string; title?: string }[] = [
    { label: 'Accuracy', value: `${stats.accuracy}%`, color: accuracyColor(stats.accuracy) },
    { label: 'Record', value: `${r.wins}W-${r.losses}L-${r.draws}D` },
    { label: 'Median rating', value: medRating != null ? String(medRating) : '—', title: 'Median of your rating across the analyzed games. The trend over time is in the Rating chart below.' },
    { label: 'Mistakes', value: String(stats.mistakeCount) },
    { label: 'Missed wins', value: winningGames ? `${missedWins} / ${winningGames}` : '—', color: missedWins > 0 ? 'rgb(224,121,107)' : undefined },
    {
      label: 'Tilt',
      value: rec ? `${tiltDelta >= 0 ? '+' : ''}${tiltDelta}%` : '—',
      color: rec ? (tiltDelta > 10 ? 'rgb(224,121,107)' : tiltDelta <= 0 ? '#7bc47f' : undefined) : undefined,
      title: rec
        ? `How much more you blunder right after a blunder: ${rec.afterPct}% mistake rate in the 3 moves following a blunder vs ${rec.basePct}% normally. Positive = you tilt; 0 or negative = you steady yourself.`
        : 'How much more you blunder right after a blunder (needs a few blunders to compute).',
    },
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
            {t.sub && <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{t.sub}</div>}
            <div className="stat-label">{t.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
