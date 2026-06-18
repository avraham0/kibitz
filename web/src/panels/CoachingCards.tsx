import type { Suggestion } from '../api-types.js'

export function CoachingCards({ suggestions }: { suggestions: Suggestion[] }) {
  return (
    <section>
      <h2>Coaching</h2>
      {suggestions.length === 0 && <p>No high-priority issues found.</p>}
      {suggestions.map((s, i) => (
        <div key={i} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <h3 style={{ margin: '0 0 4px' }}>{s.title}</h3>
          <p style={{ margin: '0 0 4px' }}>{s.why}</p>
          <p style={{ margin: 0 }}><strong>Drill:</strong> {s.drill}</p>
        </div>
      ))}
    </section>
  )
}
