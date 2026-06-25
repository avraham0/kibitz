import type { GameSummary, SuggestionAction } from '../api-types.js'
import { recurringMistakes } from '../recurringMistakes.js'
import { TYPE_NAME, LESSON } from '../lessons.js'

const TREND = {
  improving: { label: '↓ improving', color: '#7bc47f' },
  worsening: { label: '↑ getting worse', color: 'rgb(224,121,107)' },
  flat: { label: '→ steady', color: 'var(--muted)' },
  unknown: { label: '', color: 'var(--muted)' },
} as const

// Adult-improver "blunder journal": the handful of mistakes you make over and over,
// each with a reusable principle and an early-vs-recent trend so you can see progress.
export function RecurringMistakes({ games, onPractice }: { games: GameSummary[]; onPractice?: (a: SuggestionAction) => void }) {
  const themes = recurringMistakes(games).filter((t) => t.count >= 2).slice(0, 5)
  if (themes.length === 0) return null

  return (
    <section>
      <h2>Your recurring mistakes</h2>
      <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 13 }}>
        The patterns you repeat most. Learn the principle, then drill it — and watch the trend across your games.
      </p>
      {themes.map((t) => {
        const tr = TREND[t.trend]
        return (
          <div key={t.type} style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>{TYPE_NAME[t.type]}</h3>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                {t.count}× ({Math.round(t.share * 100)}% of mistakes) · avg −{t.avgCpLoss}cp
              </span>
              {t.trend !== 'unknown' && (
                <span style={{ color: tr.color, fontSize: 13, fontWeight: 600 }}>{tr.label}</span>
              )}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 14 }}>
              <strong>Principle:</strong> {LESSON[t.type]}
            </p>
            {onPractice && (
              <button
                type="button"
                onClick={() => onPractice({ practice: 'tactics', type: t.type })}
                style={{ marginTop: 10, padding: '6px 14px', fontSize: 13, fontWeight: 700, color: '#fff', background: 'var(--accent, #4a7)', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                Drill {TYPE_NAME[t.type].toLowerCase()} →
              </button>
            )}
          </div>
        )
      })}
    </section>
  )
}
