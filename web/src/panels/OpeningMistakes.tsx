import { useState, useRef, useEffect, useMemo } from 'react'
import type { BlunderRef, GameSummary } from '../api-types.js'
import { PuzzleBoard, PuzzleFeedback, type PuzzleState } from './PuzzleBoard.js'
import { BestLineWalkthrough } from './BestLineWalkthrough.js'
import { loadSrs, saveSrs, recordResult, orderByCalibrated, puzzleKey, type SrsStore } from '../puzzleSrs.js'

const navBtn = { fontSize: 13, padding: '5px 9px', whiteSpace: 'nowrap' as const }

// Repurposed Openings tab: drill the positions in YOUR openings where you actually
// went wrong (opening-phase mistakes/blunders) and practice the correction — instead
// of replaying your most-common moves, which can reinforce bad habits.
export function OpeningMistakes({ games, initialFamily, onOpenGame }: {
  games: GameSummary[]
  initialFamily?: string
  onOpenGame?: (id: string, ply?: number) => void
}) {
  const gameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of games) m.set(g.url, g.gameId)
    return m
  }, [games])

  // Player mistakes (mistake or blunder) made in the opening phase, as puzzles.
  const blunders = useMemo((): BlunderRef[] => {
    const out: BlunderRef[] = []
    for (const g of games) {
      for (let mi = 0; mi < g.moves.length; mi++) {
        const m = g.moves[mi]
        if (!m.isPlayerMove || m.phase !== 'opening' || m.type === 'lost_position') continue
        if (m.severity !== 'blunder' && m.severity !== 'mistake') continue
        out.push({ url: g.url, ply: m.ply, san: m.san, bestSan: m.bestSan, fenBefore: m.fenBefore, cpLoss: m.cpLoss, type: m.type, missed: m.missed, openingName: g.openingName, family: g.family, movesAfter: g.moves.slice(mi + 1, mi + 5).map((x) => x.san) })
      }
    }
    return out.sort((a, b) => b.cpLoss - a.cpLoss)
  }, [games])

  const families = useMemo(() => {
    const c: Record<string, number> = {}
    for (const b of blunders) if (b.family) c[b.family] = (c[b.family] ?? 0) + 1
    return Object.entries(c).sort((a, b) => b[1] - a[1])
  }, [blunders])

  const [family, setFamily] = useState<string>(initialFamily ?? 'all')
  const [srs, setSrs] = useState<SrsStore>(() => loadSrs())
  const srsRef = useRef(srs)
  srsRef.current = srs
  const [cur, setCur] = useState(0)
  const [epoch, setEpoch] = useState(0)
  const [puzzleState, setPuzzleState] = useState<PuzzleState>({ solved: false, revealed: false, wrong: 0, lastWrongSan: null })
  const [forceReveal, setForceReveal] = useState(false)
  const [reviewIdx, setReviewIdx] = useState<number | null>(null)
  const [showLine, setShowLine] = useState(false)

  useEffect(() => { setFamily(initialFamily ?? 'all'); setCur(0) }, [initialFamily])
  useEffect(() => { setReviewIdx(null); setShowLine(false) }, [cur, epoch])

  const filtered = useMemo(
    () => blunders.filter((b) => family === 'all' || b.family === family),
    [blunders, family],
  )
  const queue = useMemo(() => orderByCalibrated(filtered, srsRef.current, Date.now()), [filtered])
  const idx = filtered.length === 0 ? 0 : Math.min(cur, queue.length - 1)
  const b = queue[idx]
  const key = b ? puzzleKey(b) : ''

  function reset() {
    setEpoch((e) => e + 1)
    setPuzzleState({ solved: false, revealed: false, wrong: 0, lastWrongSan: null })
    setForceReveal(false)
  }
  function advance() { setCur(Math.min(queue.length - 1, idx + 1)); reset() }
  function goPrev() { setCur(Math.max(0, idx - 1)); reset() }
  function changeFamily(f: string) { setFamily(f); setCur(0); reset() }

  function handleResult(correct: boolean) {
    setSrs((prev) => { const next = recordResult(prev, key, correct, Date.now()); saveSrs(next); return next })
  }

  // ← / → step the line once answered.
  useEffect(() => {
    const reviewing = puzzleState.solved || puzzleState.revealed
    const reviewLen = puzzleState.reviewLen ?? 1
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return
      if (e.key === 'ArrowLeft' && reviewing) { e.preventDefault(); setReviewIdx((i) => Math.max(0, (i ?? 0) - 1)) }
      else if (e.key === 'ArrowRight' && reviewing) { e.preventDefault(); setReviewIdx((i) => Math.min(reviewLen - 1, (i ?? 0) + 1)) }
      else if (e.key === 'Enter' && (puzzleState.solved || puzzleState.revealed) && idx < queue.length - 1) { e.preventDefault(); advance() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleState.solved, puzzleState.revealed, puzzleState.reviewLen, idx, queue.length])

  if (blunders.length === 0) {
    return <p style={{ color: 'var(--muted)' }}>No opening-phase mistakes found — your openings are solid, or there aren't enough games yet.</p>
  }
  if (!b) return <p style={{ color: 'var(--muted)' }}>No mistakes in this opening.</p>

  const sideToMove = b.fenBefore.split(' ')[1]
  const colorLabel = sideToMove === 'w' ? '♙ White' : '♟ Black'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>Opening mistakes</h2>
        <select value={family} onChange={(e) => changeFamily(e.target.value)} aria-label="Opening" style={{ fontSize: 13, maxWidth: 'min(240px, 100%)' }}>
          <option value="all">all openings ({blunders.length})</option>
          {families.map(([f, n]) => <option key={f} value={f}>{f} ({n})</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 380px', minWidth: 0, maxWidth: 380 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Find the best move for {colorLabel}</div>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 6 }}>{idx + 1} / {queue.length} opening mistakes</div>
          <PuzzleBoard key={`${key}-${epoch}`} blunder={b} onResult={handleResult} boardWidth={380} onStateChange={setPuzzleState} forceReveal={forceReveal} reviewIdx={reviewIdx} />
        </div>
        <div style={{ minWidth: 200, flex: '1 1 200px' }}>
          <div style={{ minHeight: 40, marginBottom: 12 }}>
            <PuzzleFeedback
              state={puzzleState}
              blunder={b}
              onReview={(() => { const gid = gameById.get(b.url); return onOpenGame && gid ? () => onOpenGame(gid, b.ply - 1) : undefined })()}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" style={navBtn} onClick={goPrev} disabled={idx === 0}>‹ prev</button>
            <button type="button" style={navBtn} onClick={advance} disabled={idx >= queue.length - 1}>next ›</button>
            {(puzzleState.solved || puzzleState.revealed) && <button type="button" style={navBtn} onClick={reset}>reset</button>}
            {(puzzleState.solved || puzzleState.revealed) && <button type="button" style={navBtn} onClick={() => setShowLine((v) => !v)}>{showLine ? 'hide line' : 'walk the line'}</button>}
            {!puzzleState.solved && !puzzleState.revealed && puzzleState.committed && <button type="button" style={navBtn} onClick={reset}>try again</button>}
            {!puzzleState.solved && !puzzleState.revealed && <button type="button" style={navBtn} onClick={() => setForceReveal(true)}>reveal</button>}
          </div>
          {showLine && (puzzleState.solved || puzzleState.revealed) && (
            <BestLineWalkthrough key={key} fenBefore={b.fenBefore} bestSan={b.bestSan} />
          )}
        </div>
      </div>
    </div>
  )
}
