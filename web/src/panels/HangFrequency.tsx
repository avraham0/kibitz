import type { BlunderRef } from '../api-types.js'
import { hangingAfter } from '../explainBlunder.js'

const PIECE_NAME: Record<string, string> = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn' }

export function HangFrequency({ blunders }: { blunders: BlunderRef[] }) {
  const counts: Record<string, number> = {}
  for (const b of blunders) {
    const h = hangingAfter(b.fenBefore, b.san)
    if (h) counts[h.piece] = (counts[h.piece] ?? 0) + 1
  }
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1])
  if (rows.length === 0) return null
  return (
    <section>
      <h2>Pieces hung</h2>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 8 }}>
        {rows.map(([piece, count]) => (
          <div key={piece} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'rgb(224,121,107)' }}>{count}×</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{PIECE_NAME[piece] ?? piece}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
