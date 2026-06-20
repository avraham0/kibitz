import { useState, useMemo, useRef } from 'react'
import { ThemedBoard as Chessboard } from '../ThemedBoard.js'
import type { Arrow } from 'react-chessboard/dist/chessboard/types/index.js'
import type { BlunderRef, MistakeType } from '../api-types.js'
import { sanToSquares } from '../sanToSquares.js'
import { orientationFromFen } from '../orientationFromFen.js'
import { PuzzleBoard } from './PuzzleBoard.js'
import { loadSrs, saveSrs, recordResult, orderByDue, dueCount, isDue, puzzleKey, type SrsStore } from '../puzzleSrs.js'
import { explainBlunder } from '../explainBlunder.js'

function analysisLink(fen: string): string {
  return `https://www.chess.com/analysis?fen=${encodeURIComponent(fen)}`
}

function statusTag(store: SrsStore, b: BlunderRef, now: number): { text: string; color: string } {
  const key = puzzleKey(b)
  if (!store[key]) return { text: 'new', color: 'var(--muted)' }
  return isDue(store, key, now) ? { text: 'due', color: 'rgb(224,121,107)' } : { text: 'scheduled', color: '#7bc47f' }
}

export function BlunderList({ blunders }: { blunders: BlunderRef[] }) {
  const [filter, setFilter] = useState<'all' | MistakeType>('all')
  const [mode, setMode] = useState<'review' | 'solve'>('review')
  const [solved, setSolved] = useState(0)
  const [cur, setCur] = useState(0)
  const [visible, setVisible] = useState(10) // review grid shows 10 at a time
  const [srs, setSrs] = useState<SrsStore>(() => loadSrs())
  // Used to order the solve queue without re-sorting it every time a result lands.
  const srsRef = useRef(srs)
  srsRef.current = srs
  const types = Array.from(new Set(blunders.map((b) => b.type)))
  const shown = filter === 'all' ? blunders : blunders.filter((b) => b.type === filter)

  // Order the solve queue most-overdue-first, frozen per filter so recording a
  // result doesn't reshuffle the puzzle under you mid-session.
  const queue = useMemo(
    () => orderByDue(shown, srsRef.current, Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filter, blunders, mode],
  )
  const now = Date.now()
  const due = dueCount(shown, srs, now)

  function recordPuzzle(b: BlunderRef, correct: boolean) {
    setSrs((prev) => { const next = recordResult(prev, puzzleKey(b), correct, Date.now()); saveSrs(next); return next })
    if (correct) setSolved((c) => c + 1)
  }

  // Reset solve progress whenever the puzzle set changes.
  function reset() { setSolved(0); setCur(0); setVisible(10) }

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
        {mode === 'solve' && (
          <span style={{ color: 'var(--muted)' }}>Solved {solved} / {shown.length} · {due} due for review</span>
        )}
      </div>
      {mode === 'solve' ? (
        queue.length === 0 ? (
          <p style={{ marginTop: 8 }}>No puzzles for this filter.</p>
        ) : (() => {
          const idx = Math.min(cur, queue.length - 1)
          const b = queue[idx]
          const tag = statusTag(srs, b, now)
          return (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <button type="button" onClick={() => setCur((c) => Math.max(0, c - 1))} disabled={idx === 0}>‹ prev</button>
              <button type="button" onClick={() => setCur((c) => Math.min(queue.length - 1, c + 1))} disabled={idx >= queue.length - 1}>next ›</button>
              <span style={{ color: 'var(--muted)' }}>Puzzle {idx + 1} / {queue.length}</span>
              <span style={{ color: tag.color, fontWeight: 600 }}>{tag.text}</span>
            </div>
            <PuzzleBoard key={`${filter}-${idx}`} blunder={b} onResult={(correct) => recordPuzzle(b, correct)} />
          </div>
          )
        })()
      ) : (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 8 }}>
        {shown.slice(0, visible).map((b, i) => {
          const played = sanToSquares(b.fenBefore, b.san)
          const best = sanToSquares(b.fenBefore, b.bestSan)
          const arrows: Arrow[] = []
          if (played) arrows.push([played.from as Arrow[0], played.to as Arrow[1], 'rgb(200,80,80)'])
          if (best) arrows.push([best.from as Arrow[0], best.to as Arrow[1], 'rgb(80,160,80)'])
          return (
            <div key={i} style={{ width: 240 }}>
              <Chessboard position={b.fenBefore} boardOrientation={orientationFromFen(b.fenBefore)} customArrows={arrows} arePiecesDraggable={false} boardWidth={240} />
              <div style={{ fontSize: 13 }}>
                Played {b.san} · Best {b.bestSan} · −{b.cpLoss}cp{' '}
                <a href={analysisLink(b.fenBefore)} target="_blank" rel="noreferrer">analyze</a>
                <div style={{ color: 'var(--muted)', marginTop: 2 }}>{explainBlunder(b)}</div>
              </div>
            </div>
          )
        })}
      </div>
      )}
      {mode === 'review' && shown.length > visible && (
        <button type="button" style={{ marginTop: 12 }} onClick={() => setVisible((v) => v + 10)}>
          Load more ({shown.length - visible} more)
        </button>
      )}
    </section>
  )
}
