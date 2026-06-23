import { useState, useRef, useEffect, useMemo } from 'react'
import type { BlunderRef, CoachableType, GameSummary } from '../api-types.js'
import { PuzzleBoard, PuzzleFeedback, type PuzzleState } from './PuzzleBoard.js'
import {
  loadSrs, saveSrs, recordResult, orderByDue, puzzleKey, type SrsStore,
} from '../puzzleSrs.js'
import { hangingAfter } from '../explainBlunder.js'

const PIECE_LABEL: Record<string, string> = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' }

const TYPE_LABEL: Record<CoachableType, string> = {
  hung_piece: 'hung piece', missed_tactic: 'missed tactic', bad_trade: 'bad trade',
  king_safety: 'king safety', positional: 'positional',
  fork: 'fork', pin: 'pin', skewer: 'skewer',
  discovered_attack: 'discovered attack', trapped_piece: 'trapped piece', back_rank: 'back rank',
}

function PatternBreakdown({ blunders }: { blunders: BlunderRef[] }) {
  const counts: Partial<Record<CoachableType, number>> = {}
  for (const b of blunders) {
    if (b.type !== 'lost_position') counts[b.type as CoachableType] = (counts[b.type as CoachableType] ?? 0) + 1
  }
  const sorted = (Object.entries(counts) as [CoachableType, number][]).sort((a, b) => b[1] - a[1]).slice(0, 5)
  if (sorted.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: '6px 14px', flexWrap: 'wrap', fontSize: 12, marginBottom: 18 }}>
      {sorted.map(([type, count]) => (
        <span key={type} style={{ color: 'var(--muted)' }}>
          <span style={{ fontWeight: 600, color: 'rgb(224,121,107)' }}>{count}×</span> {TYPE_LABEL[type] ?? type}
        </span>
      ))}
    </div>
  )
}

export function TrainingTab({ games, initialTypeFilter, initialHungPiece }: { games: GameSummary[]; initialTypeFilter?: CoachableType; initialHungPiece?: string }) {
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
  const [openingFilter, setOpeningFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>(initialTypeFilter ?? 'all')
  const [hungPieceFilter, setHungPieceFilter] = useState<string | undefined>(initialHungPiece)

  useEffect(() => {
    setOpeningFilter('all')
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

  const openings = useMemo(() => {
    const seen = new Set<string>()
    for (const b of blunders) if (b.family) seen.add(b.family)
    return [...seen].sort()
  }, [blunders])

  const types = useMemo(() => {
    const seen = new Set<string>()
    for (const b of blunders) seen.add(b.type)
    return [...seen].sort()
  }, [blunders])

  const filtered = useMemo(
    () => blunders.filter((b) =>
      (openingFilter === 'all' || b.family === openingFilter) &&
      (typeFilter === 'all' || b.type === typeFilter) &&
      (!hungPieceFilter || hangingAfter(b.fenBefore, b.san)?.piece === hungPieceFilter),
    ),
    [blunders, openingFilter, typeFilter, hungPieceFilter],
  )

  const now = Date.now()
  const queue = useMemo(
    () => orderByDue(filtered, srsRef.current, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered],
  )
  const idx = filtered.length === 0 ? 0 : Math.min(cur, queue.length - 1)
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

  // Treat reveal as a failed attempt so Enter/→ works and SRS is updated
  useEffect(() => {
    if (puzzleState.revealed && !puzzleAnswered && key) {
      handleResult(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleState.revealed])

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

  const wrongCount = srs[key]?.wrongCount ?? 0
  const sideToMove = b.fenBefore.split(' ')[1]
  const colorLabel = sideToMove === 'w' ? '♙ White' : '♟ Black'

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>Training</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {hungPieceFilter && (
            <button type="button" onClick={() => { setHungPieceFilter(undefined); setCur(0); setEpoch((ep) => ep + 1) }} style={{ fontSize: 13 }} title="Clear piece filter">
              {PIECE_LABEL[hungPieceFilter] ?? hungPieceFilter} hangs ✕
            </button>
          )}
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setHungPieceFilter(undefined); setCur(0); setEpoch((ep) => ep + 1); setPuzzleAnswered(false); setPuzzleState({ solved: false, revealed: false, wrong: 0, lastWrongSan: null }); setForceReveal(false) }} style={{ fontSize: 13 }}>
            <option value="all">all patterns ({blunders.length})</option>
            {types.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t as CoachableType] ?? t} ({blunders.filter((b) => b.type === t).length})</option>
            ))}
          </select>
          <select value={openingFilter} onChange={(e) => { setOpeningFilter(e.target.value); setCur(0); setEpoch((ep) => ep + 1); setPuzzleAnswered(false); setPuzzleState({ solved: false, revealed: false, wrong: 0, lastWrongSan: null }); setForceReveal(false) }} style={{ fontSize: 13 }}>
            <option value="all">all openings</option>
            {openings.map((o) => (
              <option key={o} value={o}>{o} ({blunders.filter((b) => b.family === o).length})</option>
            ))}
          </select>
        </div>
      </div>
      {typeFilter === 'all' && !hungPieceFilter && <PatternBreakdown blunders={blunders} />}
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            Find the best move for {colorLabel}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10, width: 380, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Move {Math.ceil(b.ply / 2)} · {b.type.replace(/_/g, ' ')} · −{b.cpLoss}cp
            {b.openingName && <> · {b.openingName}</>}
          </div>
          <PuzzleBoard key={`${key}-${epoch}`} blunder={b} onResult={handleResult} boardWidth={380} onStateChange={setPuzzleState} forceReveal={forceReveal} />
        </div>
        <div style={{ minWidth: 200 }}>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 4 }}>
            {idx + 1} / {queue.length} blunders
          </div>
          {wrongCount > 0 && (
            <div style={{ fontSize: 12, color: 'rgb(224,121,107)', marginBottom: 12 }}>
              failed {wrongCount}× across sessions
            </div>
          )}
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
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                {puzzleState.committed && (
                  <button type="button" style={{ fontSize: 13 }} onClick={() => { setEpoch((e) => e + 1); setPuzzleState({ solved: false, revealed: false, wrong: 0, lastWrongSan: null }); setForceReveal(false) }}>try again</button>
                )}
                <button type="button" style={{ fontSize: 13 }} onClick={() => setForceReveal(true)}>reveal</button>
              </div>
            )}
          </div>
          {b.url && <div style={{ marginBottom: 12 }}><a href={b.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>game ↗</a></div>}
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Enter / → to advance</div>
        </div>
      </div>
    </section>
  )
}
