import type { OpeningStat } from '../api-types.js'

export function OpeningsTable({ openings }: { openings: OpeningStat[] }) {
  return (
    <section>
      <h2>Openings</h2>
      <table><thead><tr><th>ECO</th><th>Opening</th><th>Games</th><th>Win %</th><th>Avg mistakes</th></tr></thead>
        <tbody>{openings.map((o, i) => (
          <tr key={i}><td>{o.eco}</td><td>{o.name}</td><td>{o.games}</td><td>{o.winPct}</td><td>{o.avgMistakes}</td></tr>
        ))}</tbody>
      </table>
    </section>
  )
}
