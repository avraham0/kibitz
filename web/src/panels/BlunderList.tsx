import { useState } from 'react'
import { Chessboard } from 'react-chessboard'
import type { Arrow } from 'react-chessboard/dist/chessboard/types/index.js'
import type { BlunderRef, MistakeType } from '../api-types.js'
import { sanToSquares } from '../sanToSquares.js'
import { orientationFromFen } from '../orientationFromFen.js'
import { PuzzleBoard } from './PuzzleBoard.js'

function analysisLink(fen: string): string {
  return `https://www.chess.com/analysis?fen=${encodeURIComponent(fen)}`
}

export function BlunderList({ blunders }: { blunders: BlunderRef[] }) {
  const [filter, setFilter] = useState<'all' | MistakeType>('all')
  const [mode, setMode] = useState<'review' | 'solve'>('review')
  const [solved, setSolved] = useState(0)
  const [cur, setCur] = useState(0)
  const types = Array.from(new Set(blunders.map((b) => b.type)))
  const shown = filter === 'all' ? blunders : blunders.filter((b) => b.type === filter)

  // Reset solve progress whenever the puzzle set changes.
  function reset() { setSolved(0); setCur(0) }

  return (
    <section>
      <h2>Top blunders</h2>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>filter by type:{' '}
          <select value={filter} onChange={(e) => { setFilter(e.target.value as 'all' | MistakeType); reset() }}>
            <option value="all">all ({blunders.length})</option>
            {types.map((t) => (
              <option key={t} value={t}>{t} ({blunders.filter((b) => b.type === t).length})</option>
            ))}
          </select>
        </label>
        <label>mode:{' '}
          <select value={mode} onChange={(e) => { setMode(e.target.value as 'review' | 'solve'); reset() }}>
            <option value="review">review (show answer)</option>
            <option value="solve">solve (puzzle)</option>
          </select>
        </label>
        {mode === 'solve' && <span style={{ color: 'var(--muted)' }}>Solved {solved} / {shown.length}</span>}
      </div>
      {mode === 'solve' ? (
        shown.length === 0 ? (
          <p style={{ marginTop: 8 }}>No puzzles for this filter.</p>
        ) : (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <button type="button" onClick={() => setCur((c) => Math.max(0, c - 1))} disabled={cur === 0}>‹ prev</button>
              <button type="button" onClick={() => setCur((c) => Math.min(shown.length - 1, c + 1))} disabled={cur >= shown.length - 1}>next ›</button>
              <span style={{ color: 'var(--muted)' }}>Puzzle {cur + 1} / {shown.length}</span>
            </div>
            <PuzzleBoard key={`${filter}-${cur}`} blunder={shown[Math.min(cur, shown.length - 1)]} onSolve={() => setSolved((c) => c + 1)} />
          </div>
        )
      ) : (
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
      )}
    </section>
  )
}
