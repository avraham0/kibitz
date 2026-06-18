import { useState } from 'react'
import { Chessboard } from 'react-chessboard'
import type { Arrow } from 'react-chessboard/dist/chessboard/types/index.js'
import type { BlunderRef, MistakeType } from '../api-types.js'
import { sanToSquares } from '../sanToSquares.js'
import { orientationFromFen } from '../orientationFromFen.js'

function analysisLink(fen: string): string {
  return `https://www.chess.com/analysis?fen=${encodeURIComponent(fen)}`
}

export function BlunderList({ blunders }: { blunders: BlunderRef[] }) {
  const [filter, setFilter] = useState<'all' | MistakeType>('all')
  const types = Array.from(new Set(blunders.map((b) => b.type)))
  const shown = filter === 'all' ? blunders : blunders.filter((b) => b.type === filter)
  return (
    <section>
      <h2>Top blunders</h2>
      <label>filter by type:{' '}
        <select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | MistakeType)}>
          <option value="all">all ({blunders.length})</option>
          {types.map((t) => (
            <option key={t} value={t}>{t} ({blunders.filter((b) => b.type === t).length})</option>
          ))}
        </select>
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 8 }}>
        {shown.map((b, i) => {
          const played = sanToSquares(b.fenBefore, b.san)
          const best = sanToSquares(b.fenBefore, b.bestSan)
          const arrows: Arrow[] = []
          if (played) arrows.push([played.from as Arrow[0], played.to as Arrow[1], 'rgb(200,80,80)'])
          if (best) arrows.push([best.from as Arrow[0], best.to as Arrow[1], 'rgb(80,160,80)'])
          return (
            <div key={i} style={{ width: 260 }}>
              <Chessboard position={b.fenBefore} boardOrientation={orientationFromFen(b.fenBefore)} customArrows={arrows} arePiecesDraggable={false} boardWidth={260} />
              <div style={{ fontSize: 13 }}>
                Played {b.san} · Best {b.bestSan} · −{b.cpLoss}cp · {b.type}{' '}
                <a href={analysisLink(b.fenBefore)} target="_blank" rel="noreferrer">analyze</a>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
