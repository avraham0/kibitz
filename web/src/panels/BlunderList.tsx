import { useState, useMemo, useRef } from 'react'
import { ThemedBoard as Chessboard } from '../ThemedBoard.js'
import type { Arrow } from '../ThemedBoard.js'
import type { BlunderRef, GameSummary, MistakeType } from '../api-types.js'
import { sanToSquares } from '../sanToSquares.js'
import { orientationFromFen } from '../orientationFromFen.js'
import { PuzzleBoard } from './PuzzleBoard.js'
import { loadSrs, saveSrs, recordResult, orderByCalibrated, dueCount, isDue, puzzleKey, type SrsStore } from '../puzzleSrs.js'
import { explainBlunder } from '../explainBlunder.js'
import { ExternalLinkIcon } from './ExternalLinkIcon.js'
import { useBoardSize } from '../useBoardSize.js'

function analysisLink(fen: string): string {
  return `https://www.chess.com/analysis?fen=${encodeURIComponent(fen)}`
}

function statusTag(store: SrsStore, b: BlunderRef, now: number): { text: string; color: string } {
  const key = puzzleKey(b)
  if (!store[key]) return { text: 'new', color: 'var(--muted)' }
  return isDue(store, key, now) ? { text: 'due', color: 'rgb(224,121,107)' } : { text: 'scheduled', color: '#7bc47f' }
}

export function BlunderList({ blunders, games, onOpenGame }: {
  blunders: BlunderRef[]
  games?: GameSummary[]
  onOpenGame?: (id: string, ply?: number) => void
}) {
  const [scope, setScope] = useState<'all' | 'critical'>('critical')
  const [filter, setFilter] = useState<'all' | MistakeType>('all')
  const [mode, setMode] = useState<'review' | 'solve'>('review')
  const [solved, setSolved] = useState(0)
  const [cur, setCur] = useState(0)
  const [visible, setVisible] = useState(10) // review grid shows 10 at a time
  const [gridRef, cardSize] = useBoardSize(320)
  const [srs, setSrs] = useState<SrsStore>(() => loadSrs())
  // Used to order the solve queue without re-sorting it every time a result lands.
  const srsRef = useRef(srs)
  srsRef.current = srs

  // url → gameId map for the "review" button
  const gameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of games ?? []) m.set(g.url, g.gameId)
    return m
  }, [games])

  // All blunders derived from games (uncapped, matches backend logic)
  const allBlundersFromGames = useMemo((): BlunderRef[] => {
    if (!games) return blunders
    const result: BlunderRef[] = []
    for (const g of games) {
      for (let mi = 0; mi < g.moves.length; mi++) {
        const m = g.moves[mi]
        if (!m.isPlayerMove || m.severity !== 'blunder' || m.type === 'lost_position') continue
        result.push({ url: g.url, ply: m.ply, san: m.san, bestSan: m.bestSan, fenBefore: m.fenBefore, cpLoss: m.cpLoss, type: m.type, missed: m.missed, openingName: g.openingName, family: g.family, movesAfter: g.moves.slice(mi + 1, mi + 5).map((m2) => m2.san) })
      }
    }
    return result.sort((a, b) => b.cpLoss - a.cpLoss)
  }, [games, blunders])

  // Critical positions: blunders from won positions (playerPov ≥ +200, cpLoss ≥ 300)
  const criticalPositions = useMemo((): BlunderRef[] => {
    if (!games) return []
    const positions: BlunderRef[] = []
    for (const g of games) {
      for (let mi = 0; mi < g.moves.length; mi++) {
        const m = g.moves[mi]
        if (!m.isPlayerMove || m.severity !== 'blunder' || m.type === 'lost_position') continue
        const playerPov = g.color === 'white' ? m.evalCp : -m.evalCp
        if (playerPov < 200) continue
        positions.push({ url: g.url, ply: m.ply, san: m.san, bestSan: m.bestSan, fenBefore: m.fenBefore, cpLoss: m.cpLoss, type: m.type, missed: m.missed, openingName: g.openingName, family: g.family, movesAfter: g.moves.slice(mi + 1, mi + 5).map((m2) => m2.san) })
      }
    }
    return positions.sort((a, b) => b.cpLoss - a.cpLoss)
  }, [games])

  const activeBlunders = scope === 'critical' ? criticalPositions : allBlundersFromGames
  const types = Array.from(new Set(activeBlunders.map((b) => b.type)))
  const shown = filter === 'all' ? activeBlunders : activeBlunders.filter((b) => b.type === filter)

  // Order the solve queue most-overdue-first, frozen per filter so recording a
  // result doesn't reshuffle the puzzle under you mid-session.
  const queue = useMemo(
    () => orderByCalibrated(shown, srsRef.current, Date.now()),
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
      <h2>Blunders</h2>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginLeft: -18, marginRight: -18, paddingLeft: 18, paddingRight: 18, paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
        {games && games.length > 0 && (
          <label>scope:{' '}
            <select value={scope} onChange={(e) => { setScope(e.target.value as 'all' | 'critical'); setFilter('all'); reset() }}>
              <option value="all">all blunders ({allBlundersFromGames.length})</option>
              <option value="critical">critical — won positions ({criticalPositions.length})</option>
            </select>
          </label>
        )}
        <label>filter by type:{' '}
          <select value={filter} onChange={(e) => { setFilter(e.target.value as 'all' | MistakeType); reset() }}>
            <option value="all">all ({activeBlunders.length})</option>
            {types.map((t) => (
              <option key={t} value={t}>{t} ({activeBlunders.filter((b) => b.type === t).length})</option>
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
      <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: 16, marginTop: 8, paddingTop: 12 }}>
        {shown.slice(0, visible).map((b, i) => {
          const played = sanToSquares(b.fenBefore, b.san)
          const best = sanToSquares(b.fenBefore, b.bestSan)
          const arrows: Arrow[] = []
          if (played) arrows.push([played.from as Arrow[0], played.to as Arrow[1], 'rgb(200,80,80)'])
          if (best) arrows.push([best.from as Arrow[0], best.to as Arrow[1], 'rgb(80,160,80)'])
          return (
            <div key={i}>
              <Chessboard position={b.fenBefore} boardOrientation={orientationFromFen(b.fenBefore)} customArrows={arrows} arePiecesDraggable={false} boardWidth={cardSize} />
              <div style={{ fontSize: 13 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span>Played {b.san} · Best {b.bestSan}</span>
                  {(() => { const gid = gameById.get(b.url); return onOpenGame && gid ? <button type="button" onClick={() => onOpenGame(gid, b.ply - 1)} style={{ fontSize: 13, padding: 0, background: 'none', border: 'none', color: 'var(--accent, #7bc4ff)', cursor: 'pointer', textDecoration: 'underline' }}>review</button> : null })()}
                  <a href={analysisLink(b.fenBefore)} target="_blank" rel="noreferrer" title="Analyze on chess.com" aria-label="Analyze on chess.com" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--muted)' }}><ExternalLinkIcon /></a>
                </div>
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
