import { useState, useRef, useEffect, useMemo } from 'react'
import type { BlunderRef } from '../api-types.js'
import { PuzzleBoard } from './PuzzleBoard.js'
import {
  loadSrs, saveSrs, recordResult, orderByDue, dueCount, isDue, puzzleKey, type SrsStore,
} from '../puzzleSrs.js'

function QueueBar({ total, due, solved, streak }: { total: number; due: number; solved: number; streak: number }) {
  return (
    <div style={{ display: 'flex', gap: 20, fontSize: 13, marginBottom: 20, flexWrap: 'wrap' }}>
      <span><span style={{ fontWeight: 700, color: 'rgb(224,121,107)' }}>{due}</span> <span style={{ color: 'var(--muted)' }}>due</span></span>
      <span><span style={{ fontWeight: 700 }}>{total - due}</span> <span style={{ color: 'var(--muted)' }}>scheduled</span></span>
      <span><span style={{ fontWeight: 700, color: '#7bc47f' }}>{solved}</span> <span style={{ color: 'var(--muted)' }}>done this session</span></span>
      {streak > 0 && <span><span style={{ fontWeight: 700, color: '#e0b15a' }}>{streak}</span> <span style={{ color: 'var(--muted)' }}>streak 🔥</span></span>}
    </div>
  )
}

function SrsDots({ box }: { box: number }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ fontSize: 16, color: i < box ? '#7bc47f' : 'var(--muted)', opacity: i < box ? 1 : 0.3 }}>●</span>
      ))}
    </div>
  )
}

export function TrainingTab({ blunders }: { blunders: BlunderRef[] }) {
  const [srs, setSrs] = useState<SrsStore>(() => loadSrs())
  const srsRef = useRef(srs)
  srsRef.current = srs
  const [cur, setCur] = useState(0)
  const [sessionSolved, setSessionSolved] = useState(0)
  const [streak, setStreak] = useState(0)
  const [answered, setAnswered] = useState<Set<string>>(() => new Set())
  const [puzzleAnswered, setPuzzleAnswered] = useState(false)
  const [epoch, setEpoch] = useState(0)

  const now = Date.now()
  const queue = useMemo(
    () => orderByDue(blunders, srsRef.current, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blunders],
  )
  const due = dueCount(blunders, srs, now)

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current) }, [])

  const idx = blunders.length === 0 ? 0 : Math.min(cur, queue.length - 1)
  const b = queue[idx]
  const key = b ? puzzleKey(b) : ''

  function advance() {
    if (advanceTimer.current) { clearTimeout(advanceTimer.current); advanceTimer.current = null }
    const next = Math.min(queue.length - 1, idx + 1)
    setCur(next)
    setEpoch((e) => e + 1)
    setPuzzleAnswered(false)
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
      setStreak((s) => s + 1)
      advanceTimer.current = setTimeout(advance, 1200)
    } else {
      setStreak(0)
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

  const record = srs[key]
  const box = record?.box ?? 0
  const isCurrentDue = isDue(srs, key, now)
  const sideToMove = b.fenBefore.split(' ')[1]
  const colorLabel = sideToMove === 'w' ? '♙ White' : '♟ Black'

  return (
    <section>
      <h2>Training</h2>
      <QueueBar total={blunders.length} due={due} solved={sessionSolved} streak={streak} />
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
            Find the best move for {colorLabel}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
            Move {Math.ceil(b.ply / 2)} · {b.type.replace(/_/g, ' ')} · −{b.cpLoss}cp
          </div>
          <PuzzleBoard key={`${key}-${epoch}`} blunder={b} onResult={handleResult} boardWidth={380} />
        </div>
        <div style={{ minWidth: 200 }}>
          <div style={{ marginBottom: 16 }}>
            <SrsDots box={box} />
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              {box === 0 ? 'new' : `box ${box}`}{isCurrentDue ? '' : ' · scheduled'}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
              {idx + 1} / {queue.length}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button type="button" onClick={() => { setCur((c) => Math.max(0, c - 1)); setEpoch((e) => e + 1); setPuzzleAnswered(false) }} disabled={idx === 0}>‹ prev</button>
            <button type="button" onClick={advance} disabled={idx >= queue.length - 1}>next ›</button>
          </div>
          {b.url && <div style={{ marginBottom: 12 }}><a href={b.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>game ↗</a></div>}
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Enter / → to advance</div>
        </div>
      </div>
    </section>
  )
}
