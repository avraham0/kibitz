import { useState, useRef, useEffect, useMemo } from 'react'
import type { BlunderRef, CoachableType, GameSummary } from '../api-types.js'
import { PuzzleBoard, PuzzleFeedback, type PuzzleState } from './PuzzleBoard.js'
import {
  loadSrs, saveSrs, recordResult, orderByCalibrated, puzzleKey, type SrsStore,
} from '../puzzleSrs.js'
import { hangingAfter } from '../explainBlunder.js'
import { recurringMistakes } from '../recurringMistakes.js'
import { LESSON, TYPE_NAME } from '../lessons.js'

const PIECE_LABEL: Record<string, string> = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' }

// Compact nav buttons so prev/next/reset/reveal sit on one row, including mobile.
const navBtn = { fontSize: 13, padding: '5px 9px', whiteSpace: 'nowrap' as const }

const TYPE_LABEL: Record<CoachableType, string> = {
  hung_piece: 'hung piece', missed_tactic: 'missed tactic', bad_trade: 'bad trade',
  king_safety: 'king safety', positional: 'positional',
  fork: 'fork', pin: 'pin', skewer: 'skewer',
  discovered_attack: 'discovered attack', trapped_piece: 'trapped piece', back_rank: 'back rank',
}

export function TrainingTab({ games, initialTypeFilter, initialHungPiece, onOpenGame }: { games: GameSummary[]; initialTypeFilter?: CoachableType; initialHungPiece?: string; onOpenGame?: (id: string, ply?: number) => void }) {
  const gameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of games) m.set(g.url, g.gameId)
    return m
  }, [games])
  const blunders = useMemo((): BlunderRef[] => {
    const result: BlunderRef[] = []
    for (const g of games) {
      for (let mi = 0; mi < g.moves.length; mi++) {
        const m = g.moves[mi]
        if (!m.isPlayerMove || m.severity !== 'blunder' || m.type === 'lost_position') continue
        result.push({ url: g.url, ply: m.ply, san: m.san, bestSan: m.bestSan, fenBefore: m.fenBefore, cpLoss: m.cpLoss, type: m.type, missed: m.missed, openingName: g.openingName, family: g.family, movesAfter: g.moves.slice(mi + 1, mi + 5).map((m2) => m2.san) })
      }
    }
    return result.sort((a, b) => b.cpLoss - a.cpLoss)
  }, [games])
  const [srs, setSrs] = useState<SrsStore>(() => loadSrs())
  const srsRef = useRef(srs)
  srsRef.current = srs
  const [cur, setCur] = useState(0)
  const [sessionSolved, setSessionSolved] = useState(0)
  const [answered, setAnswered] = useState<Set<string>>(() => new Set())
  const [puzzleAnswered, setPuzzleAnswered] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const [puzzleState, setPuzzleState] = useState<PuzzleState>({ solved: false, revealed: false, wrong: 0, lastWrongSan: null })
  const [forceReveal, setForceReveal] = useState(false)
  const [reviewIdx, setReviewIdx] = useState<number | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>(initialTypeFilter ?? 'all')
  const [hungPieceFilter, setHungPieceFilter] = useState<string | undefined>(initialHungPiece)

  useEffect(() => {
    setTypeFilter('all')
    setHungPieceFilter(undefined)
    setCur(0)
    setPuzzleAnswered(false)
    setPuzzleState({ solved: false, revealed: false, wrong: 0, lastWrongSan: null })
    setForceReveal(false)
  }, [games])

  // Sync when routed in from a coaching card / hung-piece tile.
  useEffect(() => { if (initialTypeFilter) { setTypeFilter(initialTypeFilter); setCur(0) } }, [initialTypeFilter])
  useEffect(() => { setHungPieceFilter(initialHungPiece); if (initialHungPiece) setCur(0) }, [initialHungPiece])

  const types = useMemo(() => {
    const seen = new Set<string>()
    for (const b of blunders) seen.add(b.type)
    return [...seen].sort()
  }, [blunders])

  // Personalized pre-move checklist: your top recurring weaknesses, shown as a
  // habit nudge before you answer (turns the mistake profile into in-the-moment behavior).
  const weaknesses = useMemo(() => recurringMistakes(games).filter((t) => t.count >= 2).slice(0, 2), [games])

  const filtered = useMemo(
    () => blunders.filter((b) =>
      (typeFilter === 'all' || b.type === typeFilter) &&
      (!hungPieceFilter || hangingAfter(b.fenBefore, b.san)?.piece === hungPieceFilter),
    ),
    [blunders, typeFilter, hungPieceFilter],
  )

  const now = Date.now()
  const queue = useMemo(
    () => orderByCalibrated(filtered, srsRef.current, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered],
  )
  const idx = filtered.length === 0 ? 0 : Math.min(cur, queue.length - 1)
  const b = queue[idx]
  const key = b ? puzzleKey(b) : ''

  function advance() {
    setCur(Math.min(queue.length - 1, idx + 1))
    setEpoch((e) => e + 1)
    setPuzzleAnswered(false)
    setPuzzleState({ solved: false, revealed: false, wrong: 0, lastWrongSan: null })
    setForceReveal(false)
  }
  function goPrev() {
    setCur((c) => Math.max(0, c - 1))
    setEpoch((e) => e + 1)
    setPuzzleAnswered(false)
    setPuzzleState({ solved: false, revealed: false, wrong: 0, lastWrongSan: null })
    setForceReveal(false)
  }
  // Reset the current puzzle in place (clears solved/revealed/committed via remount).
  function resetPuzzle() {
    setEpoch((e) => e + 1)
    setPuzzleState({ solved: false, revealed: false, wrong: 0, lastWrongSan: null })
    setForceReveal(false)
  }

  function handleResult(correct: boolean) {
    setSrs((prev) => {
      const next = recordResult(prev, key, correct, Date.now())
      saveSrs(next)
      return next
    })
    setAnswered((prev) => new Set([...prev, key]))
    setPuzzleAnswered(true)
    if (correct) {
      setSessionSolved((c) => c + 1)
    }
  }

  // Treat reveal as a failed attempt so Enter/→ works and SRS is updated
  useEffect(() => {
    if (puzzleState.revealed && !puzzleAnswered && key) {
      handleResult(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleState.revealed])

  // Reset the step cursor when the shown puzzle changes.
  useEffect(() => { setReviewIdx(null) }, [key, epoch])

  // Once answered, ← / → step the pieces through the game line on the board.
  // Enter advances to the next puzzle.
  useEffect(() => {
    const reviewing = puzzleState.solved || puzzleState.revealed
    const reviewLen = puzzleState.reviewLen ?? 1
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return
      if (e.key === 'ArrowLeft' && reviewing) { e.preventDefault(); setReviewIdx((i) => Math.max(0, (i ?? 0) - 1)) }
      else if (e.key === 'ArrowRight' && reviewing) { e.preventDefault(); setReviewIdx((i) => Math.min(reviewLen - 1, (i ?? 0) + 1)) }
      else if (e.key === 'Enter' && puzzleAnswered && idx < queue.length - 1) { e.preventDefault(); advance() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleState.solved, puzzleState.revealed, puzzleState.reviewLen, puzzleAnswered, idx, queue.length])

  if (blunders.length === 0) {
    return (
      <section>
        <h2>Training</h2>
        <p style={{ color: 'var(--muted)' }}>No puzzles yet — run an analysis first.</p>
      </section>
    )
  }

  const allAnswered = queue.length > 0 && queue.every((p) => answered.has(puzzleKey(p)))
  if (allAnswered) {
    return (
      <section>
        <h2>Training</h2>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Session complete</div>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
            {sessionSolved} solved · {queue.length - sessionSolved} revealed
          </div>
          <button type="button" onClick={() => { setCur(0); setAnswered(new Set()); setEpoch((e) => e + 1); setPuzzleAnswered(false) }}>
            Start over
          </button>
        </div>
      </section>
    )
  }

  const sideToMove = b.fenBefore.split(' ')[1]
  const colorLabel = sideToMove === 'w' ? '♙ White' : '♟ Black'

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>Training</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
          {hungPieceFilter && (
            <button type="button" onClick={() => { setHungPieceFilter(undefined); setCur(0); setEpoch((ep) => ep + 1) }} style={{ fontSize: 13 }} title="Clear piece filter">
              {PIECE_LABEL[hungPieceFilter] ?? hungPieceFilter} hangs ✕
            </button>
          )}
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setHungPieceFilter(undefined); setCur(0); setEpoch((ep) => ep + 1); setPuzzleAnswered(false); setPuzzleState({ solved: false, revealed: false, wrong: 0, lastWrongSan: null }); setForceReveal(false) }} style={{ fontSize: 13, maxWidth: 200 }}>
            <option value="all">all patterns ({blunders.length})</option>
            {types.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t as CoachableType] ?? t} ({blunders.filter((b) => b.type === t).length})</option>
            ))}
          </select>
        </div>
      </div>
      {weaknesses.length > 0 && !puzzleState.solved && !puzzleState.revealed && (
        <div style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Before you move</span>
          <span style={{ color: 'var(--muted)' }}> — your recurring habits:</span>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {weaknesses.map((w) => (
              <li key={w.type}><span style={{ color: 'var(--muted)' }}>{TYPE_NAME[w.type]}:</span> {LESSON[w.type]}</li>
            ))}
          </ul>
        </div>
      )}
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 380px', minWidth: 0, maxWidth: 380 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
            Find the best move for {colorLabel}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 6 }}>
            {idx + 1} / {queue.length} blunders
          </div>
          <PuzzleBoard key={`${key}-${epoch}`} blunder={b} onResult={handleResult} boardWidth={380} onStateChange={setPuzzleState} forceReveal={forceReveal} reviewIdx={reviewIdx} />
        </div>
        <div style={{ minWidth: 200, flex: '1 1 200px' }}>
          {/* Feedback first so it sits right under the board on mobile (where this
              panel wraps below), with the action buttons following it. */}
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
            {(puzzleState.solved || puzzleState.revealed) && (
              <button type="button" style={navBtn} onClick={resetPuzzle}>reset</button>
            )}
            {!puzzleState.solved && !puzzleState.revealed && puzzleState.committed && (
              <button type="button" style={navBtn} onClick={resetPuzzle}>try again</button>
            )}
            {!puzzleState.solved && !puzzleState.revealed && (
              <button type="button" style={navBtn} onClick={() => setForceReveal(true)}>reveal</button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
