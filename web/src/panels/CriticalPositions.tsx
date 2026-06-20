import { ThemedBoard as Chessboard } from '../ThemedBoard.js'
import type { Arrow } from 'react-chessboard/dist/chessboard/types/index.js'
import type { GameSummary, MistakeType } from '../api-types.js'
import { sanToSquares } from '../sanToSquares.js'
import { orientationFromFen } from '../orientationFromFen.js'
import { explainBlunder } from '../explainBlunder.js'

type CritPos = { ply: number; san: string; bestSan: string; fenBefore: string; cpLoss: number; type: MistakeType; missed: boolean; gameId: string }

function analysisLink(fen: string) {
  return `https://www.chess.com/analysis?fen=${encodeURIComponent(fen)}`
}

export function CriticalPositions({ games, onOpenGame }: { games: GameSummary[]; onOpenGame?: (id: string, ply?: number) => void }) {
  const positions: CritPos[] = []
  for (const g of games) {
    for (const m of g.moves) {
      if (!m.isPlayerMove || m.cpLoss < 300) continue
      const playerPov = g.color === 'white' ? m.evalCp : -m.evalCp
      if (playerPov < 200) continue
      positions.push({ ply: m.ply, san: m.san, bestSan: m.bestSan, fenBefore: m.fenBefore, cpLoss: m.cpLoss, type: m.type, missed: m.missed, gameId: g.gameId })
    }
  }
  positions.sort((a, b) => b.cpLoss - a.cpLoss)

  if (positions.length === 0) return null
  return (
    <section>
      <h2>Critical positions</h2>
      <p style={{ marginTop: 0, fontSize: 12, color: 'var(--muted)' }}>You were winning (≥+2) but blundered ≥3 pawns. These cost you won games.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {positions.slice(0, 12).map((p, i) => {
          const played = sanToSquares(p.fenBefore, p.san)
          const best = sanToSquares(p.fenBefore, p.bestSan)
          const arrows: Arrow[] = []
          if (played) arrows.push([played.from as Arrow[0], played.to as Arrow[1], 'rgb(200,80,80)'])
          if (best) arrows.push([best.from as Arrow[0], best.to as Arrow[1], 'rgb(80,160,80)'])
          return (
            <div key={i} style={{ width: 240 }}>
              <Chessboard position={p.fenBefore} boardOrientation={orientationFromFen(p.fenBefore)} customArrows={arrows} arePiecesDraggable={false} boardWidth={240} />
              <div style={{ fontSize: 12, marginTop: 4 }}>
                −{p.cpLoss}cp · {p.san}{' '}
                <a href={analysisLink(p.fenBefore)} target="_blank" rel="noreferrer">analyze ↗</a>
                {onOpenGame && <>{' '}<button type="button" onClick={() => onOpenGame(p.gameId, p.ply)} style={{ fontSize: 12, padding: '0 4px', background: 'none', border: 'none', color: 'var(--accent, #7bc4ff)', cursor: 'pointer', textDecoration: 'underline' }}>review</button></>}
                <div style={{ color: 'var(--muted)', marginTop: 2 }}>{explainBlunder(p)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
