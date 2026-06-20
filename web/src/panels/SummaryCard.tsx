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

export function SummaryCard({ stats, games = [] }: { stats: Stats; games?: GameSummary[] }) {
  const r = stats.record
  const { winningGames, converted } = stats.conversion
  const missedWins = winningGames - converted
  const rec = blunderRecovery(games)
  const tiles: { label: string; value: string; color?: string; sub?: string }[] = [
    { label: 'Accuracy', value: `${stats.accuracy}%`, color: accuracyColor(stats.accuracy) },
    { label: 'Record', value: `${r.wins}W-${r.losses}L-${r.draws}D` },
    { label: 'Games', value: String(stats.gamesAnalyzed) },
    { label: 'Mistakes', value: String(stats.mistakeCount) },
    { label: 'Missed wins', value: winningGames ? `${missedWins} / ${winningGames}` : '—', color: missedWins > 0 ? 'rgb(224,121,107)' : undefined, sub: winningGames ? `converted ${converted}` : undefined },
    ...(rec ? [{ label: 'After blunder', value: `${rec.afterPct}%`, color: rec.afterPct > rec.basePct + 10 ? 'rgb(224,121,107)' : undefined, sub: `baseline ${rec.basePct}%` }] : []),
  ]
  return (
    <section>
      <h2>Summary</h2>
      <div className="stats">
        {tiles.map((t) => (
          <div className="stat" key={t.label}>
            <div className="stat-value" style={t.color ? { color: t.color } : undefined}>{t.value}</div>
            {t.sub && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t.sub}</div>}
            <div className="stat-label">{t.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
