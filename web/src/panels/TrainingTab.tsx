import { useState, useRef, useEffect, useMemo } from 'react'
import type { BlunderRef } from '../api-types.js'
import { PuzzleBoard } from './PuzzleBoard.js'
import {
  loadSrs, saveSrs, recordResult, orderByDue, dueCount, isDue, puzzleKey, type SrsStore,
} from '../puzzleSrs.js'

const BOX_LABEL = ['new', 'box 1', 'box 2', 'box 3', 'box 4', 'box 5']
const BOX_COLOR = ['var(--muted)', '#e0b15a', '#7bc47f', '#7bc47f', '#7bc47f', '#7bc47f']

function QueueBar({ total, due, solved }: { total: number; due: number; solved: number }) {
  return (
    <div style={{ display: 'flex', gap: 20, fontSize: 13, marginBottom: 20 }}>
      <span><span style={{ fontWeight: 700, color: 'rgb(224,121,107)' }}>{due}</span> <span style={{ color: 'var(--muted)' }}>due</span></span>
      <span><span style={{ fontWeight: 700 }}>{total - due}</span> <span style={{ color: 'var(--muted)' }}>scheduled</span></span>
      <span><span style={{ fontWeight: 700, color: '#7bc47f' }}>{solved}</span> <span style={{ color: 'var(--muted)' }}>done this session</span></span>
    </div>
  )
}

export function TrainingTab({ blunders }: { blunders: BlunderRef[] }) {
  const [srs, setSrs] = useState<SrsStore>(() => loadSrs())
  const srsRef = useRef(srs)
  srsRef.current = srs
  const [cur, setCur] = useState(0)
  const [sessionSolved, setSessionSolved] = useState(0)
  // Bump this to re-mount PuzzleBoard when we advance to the next puzzle.
  const [epoch, setEpoch] = useState(0)

  const now = Date.now()
  // Freeze the queue order at mount (and when blunders change) so that recording a
  // result mid-puzzle doesn't reorder the list and remount the current PuzzleBoard.
  const queue = useMemo(
    () => orderByDue(blunders, srsRef.current, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blunders],
  )
  const due = dueCount(blunders, srs, now)

  // After solving, auto-advance after a short pause.
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current) }, [])

  if (blunders.length === 0) {
    return (
      <section>
        <h2>Training</h2>
        <p style={{ color: 'var(--muted)' }}>No puzzles yet — run an analysis first.</p>
      </section>
    )
  }

  const idx = Math.min(cur, queue.length - 1)
  const b = queue[idx]
  const key = puzzleKey(b)
  const record = srs[key]
  const box = record?.box ?? 0
  const isCurrentDue = isDue(srs, key, now)

  function advance() {
    const next = Math.min(queue.length - 1, idx + 1)
    setCur(next)
    setEpoch((e) => e + 1)
  }

  function handleResult(correct: boolean) {
    setSrs((prev) => {
      const next = recordResult(prev, key, correct, Date.now())
      saveSrs(next)
      return next
    })
    if (correct) {
      setSessionSolved((c) => c + 1)
      advanceTimer.current = setTimeout(advance, 1200)
    }
  }

  return (
    <section>
      <h2>Training</h2>
      <QueueBar total={blunders.length} due={due} solved={sessionSolved} />
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <PuzzleBoard key={`${key}-${epoch}`} blunder={b} onResult={handleResult} boardWidth={380} />
        <div style={{ minWidth: 200 }}>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: BOX_COLOR[box], fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
              {BOX_LABEL[box]}{isCurrentDue ? '' : ' · scheduled'}
            </span>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
              {idx + 1} / {queue.length}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button type="button" onClick={() => { setCur((c) => Math.max(0, c - 1)); setEpoch((e) => e + 1) }} disabled={idx === 0}>‹ prev</button>
            <button type="button" onClick={advance} disabled={idx >= queue.length - 1}>next ›</button>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>Type: <span style={{ color: 'inherit' }}>{b.type.replace(/_/g, ' ')}</span></div>
            <div>Loss: −{b.cpLoss}cp</div>
            {b.url && <div><a href={b.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>game ↗</a></div>}
          </div>
          <div style={{ marginTop: 24, fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
            <div>SRS boxes: solve to promote,</div>
            <div>miss to reset to box 0.</div>
            <div>Intervals: 1d · 3d · 7d · 16d · 35d</div>
          </div>
        </div>
      </div>
    </section>
  )
}
