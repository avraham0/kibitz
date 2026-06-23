import type { Suggestion, SuggestionAction } from '../api-types.js'

export function CoachingCards({ suggestions, onPractice }: { suggestions: Suggestion[]; onPractice?: (action: SuggestionAction) => void }) {
  return (
    <section>
      <h2>Coaching</h2>
      {suggestions.length === 0 && <p>No high-priority issues found.</p>}
      {suggestions.map((s, i) => (
        <div key={i} style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <h3 style={{ margin: '0 0 4px' }}>{s.title}</h3>
          <p style={{ margin: '0 0 4px' }}>{s.why}</p>
          <p style={{ margin: 0 }}><strong>Drill:</strong> {s.drill}</p>
          {s.action && onPractice && (
            <button
              type="button"
              onClick={() => onPractice(s.action!)}
              style={{
                marginTop: 12,
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 700,
                color: '#fff',
                background: 'var(--accent, #4a7)',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
              }}
            >
              {s.action.practice === 'opening' ? `Practice the ${s.action.family} →` : 'Practice these positions →'}
            </button>
          )}
        </div>
      ))}
    </section>
  )
}
