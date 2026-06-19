import { useState, useRef, useEffect, useMemo } from 'react'
import type { BlunderRef } from '../api-types.js'
import { PuzzleBoard, PuzzleFeedback, type PuzzleState } from './PuzzleBoard.js'
import {
  loadSrs, saveSrs, recordResult, orderByDue, puzzleKey, type SrsStore,
} from '../puzzleSrs.js'

export function TrainingTab({ blunders }: { blunders: BlunderRef[] }) {
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

  const now = Date.now()
  const queue = useMemo(
    () => orderByDue(blunders, srsRef.current, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blunders],
  )
  const idx = blunders.length === 0 ? 0 : Math.min(cur, queue.length - 1)
  const b = queue[idx]
  const key = b ? puzzleKey(b) : ''

  function advance() {
    const next = Math.min(queue.length - 1, idx + 1)
    setCur(next)
    setEpoch((e) => e + 1)
    setPuzzleAnswered(false)
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

  // Enter / → to advance after puzzle is answered
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return
      if ((e.key === 'Enter' || e.key === 'ArrowRight') && puzzleAnswered && idx < queue.length - 1) {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleAnswered, idx, queue.length])

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
          <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
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
      <h2>Training</h2>
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
            Find the best move for {colorLabel}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
            Move {Math.ceil(b.ply / 2)} · {b.type.replace(/_/g, ' ')} · −{b.cpLoss}cp
          </div>
          <PuzzleBoard key={`${key}-${epoch}`} blunder={b} onResult={handleResult} boardWidth={380} onStateChange={setPuzzleState} forceReveal={forceReveal} />
        </div>
        <div style={{ minWidth: 200 }}>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
            {idx + 1} / {queue.length}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button type="button" onClick={() => { setCur((c) => Math.max(0, c - 1)); setEpoch((e) => e + 1); setPuzzleAnswered(false); setPuzzleState({ solved: false, revealed: false, wrong: 0, lastWrongSan: null }); setForceReveal(false) }} disabled={idx === 0}>‹ prev</button>
            <button type="button" onClick={advance} disabled={idx >= queue.length - 1}>next ›</button>
          </div>
          <div style={{ marginBottom: 16 }}>
            <PuzzleFeedback state={puzzleState} blunder={b} />
            {(puzzleState.solved || puzzleState.revealed) && (
              <button type="button" style={{ marginTop: 8, fontSize: 13 }} onClick={() => { setEpoch((e) => e + 1); setPuzzleState({ solved: false, revealed: false, wrong: 0, lastWrongSan: null }); setForceReveal(false) }}>reset</button>
            )}
            {!puzzleState.solved && !puzzleState.revealed && (
              <button type="button" style={{ marginTop: 6, fontSize: 13 }} onClick={() => setForceReveal(true)}>reveal</button>
            )}
          </div>
          {b.url && <div style={{ marginBottom: 12 }}><a href={b.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>game ↗</a></div>}
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Enter / → to advance</div>
        </div>
      </div>
    </section>
  )
}
