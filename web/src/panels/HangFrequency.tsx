import type { GameSummary, SuggestionAction } from '../api-types.js'
import { hangingAfter } from '../explainBlunder.js'

const PIECE_NAME: Record<string, string> = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn' }

export function HangFrequency({ games, onPractice }: {
  games: GameSummary[]
  onPractice?: (action: SuggestionAction) => void
}) {
  // Derive from all games (uncapped) so counts match the puzzle queue's hung-piece
  // filter exactly — topBlunders is capped at 50 and would undercount.
  const counts: Record<string, number> = {}
  for (const g of games) {
    for (const m of g.moves) {
      if (!m.isPlayerMove || m.severity !== 'blunder' || m.type === 'lost_position') continue
      const h = hangingAfter(m.fenBefore, m.san)
      if (h) counts[h.piece] = (counts[h.piece] ?? 0) + 1
    }
  }
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1])
  if (rows.length === 0) return null

  return (
    <section style={{ flex: '1 1 280px', minWidth: 0 }}>
      <h2>Pieces hung</h2>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 8 }}>
        {rows.map(([piece, count]) => {
          const clickable = !!onPractice
          return (
            <div
              key={piece}
              onClick={clickable ? () => onPractice!({ practice: 'tactics', type: 'hung_piece', hungPiece: piece }) : undefined}
              title={clickable ? `Drill all your hung ${(PIECE_NAME[piece] ?? piece).toLowerCase()} positions` : undefined}
              style={{ textAlign: 'center', cursor: clickable ? 'pointer' : 'default' }}
            >
              <div style={{ fontSize: 28, fontWeight: 700, color: 'rgb(224,121,107)', textDecoration: clickable ? 'underline' : 'none', textUnderlineOffset: 4 }}>{count}×</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{PIECE_NAME[piece] ?? piece}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
