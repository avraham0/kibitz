import { useState, useEffect, useRef, useMemo } from 'react'
import { Chess } from 'chess.js'
import { ThemedBoard as Chessboard } from '../ThemedBoard.js'
import type { GameSummary, OpeningStat } from '../api-types.js'
import { buildTree } from '../openingTree.js'
import { useStockfishEval, getBestMove } from '../useStockfish.js'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const BOARD_SIZE = 380 // match the puzzles board

type Step = { fen: string; pgn: string; halfMove: number }

function EvalBar({ cp, height }: { cp: number | null; height: number }) {
  const v = cp ?? 0
  const whitePct = 50 + 50 * Math.tanh(v / 300)
  const label = cp == null ? '?' : v > 0 ? `+${(v / 100).toFixed(1)}` : (v / 100).toFixed(1)
  return (
    <div style={{ width: 16, height, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden', flexShrink: 0, position: 'relative' }} title={label}>
      <div style={{ position: 'absolute', bottom: 0, width: '100%', height: `${whitePct}%`, background: '#d8d8d8', transition: 'height 0.3s ease' }} />
    </div>
  )
}

function appendPgn(currentPgn: string, san: string, currentHalfMove: number): string {
  const moveNum = Math.floor(currentHalfMove / 2) + 1
  const isWhite = currentHalfMove % 2 === 0
  if (isWhite) return currentPgn ? `${currentPgn} ${moveNum}. ${san}` : `${moveNum}. ${san}`
  return `${currentPgn} ${san}`
}

// Parse "1. e4 e5 2. Nf3 Nc6" into rows for a vertical move list.
function pgnRows(pgn: string): { n: number; white: string; black: string }[] {
  const tokens = pgn.trim().split(/\s+/).filter(Boolean)
  const rows: { n: number; white: string; black: string }[] = []
  for (let i = 0; i < tokens.length;) {
    if (/^\d+\.$/.test(tokens[i])) {
      const n = parseInt(tokens[i], 10); i++
      const white = tokens[i] && !/^\d+\.$/.test(tokens[i]) ? tokens[i++] : ''
      const black = tokens[i] && !/^\d+\.$/.test(tokens[i]) ? tokens[i++] : ''
      rows.push({ n, white, black })
    } else { i++ }
  }
  return rows
}

export function OpeningDrill({ openings, games, initialFamily }: { openings: OpeningStat[]; games: GameSummary[]; initialFamily?: string }) {
  const [eco, setEco] = useState(initialFamily ?? openings[0]?.name ?? '')
  const [steps, setSteps] = useState<Step[]>([{ fen: START, pgn: '', halfMove: 0 }])
  const [viewIdx, setViewIdx] = useState(0)
  const [feedback, setFeedback] = useState<{ text: string; good: boolean } | null>(null)
  const [outOfBook, setOutOfBook] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [selectedSq, setSelectedSq] = useState<string | null>(null)
  const [hint, setHint] = useState<[string, string] | null>(null)
  const opponentTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const viewIdxRef = useRef(viewIdx)
  viewIdxRef.current = viewIdx
  const stepsRef = useRef(steps)
  stepsRef.current = steps

  const familyGames = useMemo(() => games.filter((g) => g.family === eco || g.openingName === eco), [games, eco])
  const tree = useMemo(() => buildTree(familyGames), [familyGames])

  const playerColor = useMemo((): 'white' | 'black' => {
    const whites = familyGames.filter((g) => g.color === 'white').length
    return whites >= familyGames.length / 2 ? 'white' : 'black'
  }, [familyGames])

  const atEnd = viewIdx === steps.length - 1
  const { fen, pgn, halfMove } = steps[viewIdx]
  const evalCp = useStockfishEval(fen)

  const chess = new Chess(fen)
  const sideToMove = chess.turn() === 'w' ? 'white' : 'black'
  const isPlayerTurn = sideToMove === playerColor && !waiting

  useEffect(() => { setHint(null) }, [fen])

  // Clear selection when navigating to a non-end position
  useEffect(() => {
    if (!atEnd) { setSelectedSq(null); setWaiting(false) }
  }, [atEnd])

  function pushStep(newFen: string, newPgn: string, newHalfMove: number) {
    const idx = viewIdxRef.current
    setSteps((prev) => [...prev.slice(0, idx + 1), { fen: newFen, pgn: newPgn, halfMove: newHalfMove }])
    setViewIdx(idx + 1)
  }

  function reset() {
    if (opponentTimer.current) clearTimeout(opponentTimer.current)
    setSteps([{ fen: START, pgn: '', halfMove: 0 }])
    setViewIdx(0)
    setFeedback(null)
    setOutOfBook(false)
    setWaiting(false)
    setSelectedSq(null)
    setHint(null)
  }

  useEffect(() => { reset() }, [eco]) // eslint-disable-line react-hooks/exhaustive-deps
  // Re-select when routed in from a coaching card for a different family.
  useEffect(() => { if (initialFamily) setEco(initialFamily) }, [initialFamily])

  function playOpponent(currentFen: string, currentHalfMove: number, currentPgn: string) {
    setWaiting(true)
    opponentTimer.current = setTimeout(async () => {
      const moves = tree[currentFen]
      if (moves) {
        const best = Object.entries(moves).sort((a, b) => b[1].count - a[1].count)[0]
        if (best && best[1].fenAfter) {
          pushStep(best[1].fenAfter, appendPgn(currentPgn, best[0], currentHalfMove), currentHalfMove + 1)
          setWaiting(false)
          return
        }
      }
      // Past your recorded games — keep going with the engine as the opponent.
      setOutOfBook(true)
      const uci = await getBestMove(currentFen, 12)
      if (uci) {
        try {
          const c = new Chess(currentFen)
          const mv = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: (uci[4] as 'q' | 'r' | 'b' | 'n') || 'q' })
          if (mv) pushStep(c.fen(), appendPgn(currentPgn, mv.san, currentHalfMove), currentHalfMove + 1)
        } catch { /* ignore illegal */ }
      }
      setWaiting(false)
    }, 800)
  }

  function onDrop(from: string, to: string): boolean {
    if (!isPlayerTurn) return false
    try {
      const c = new Chess(fen)
      const mv = c.move({ from, to, promotion: 'q' })
      if (!mv) return false
      const newFen = c.fen()
      const newHalfMove = halfMove + 1
      const newPgn = appendPgn(pgn, mv.san, halfMove)
      setOutOfBook(false)
      pushStep(newFen, newPgn, newHalfMove)
      const inBook = tree[fen]?.[mv.san]
      if (inBook) {
        const pct = Math.round((inBook.wins / inBook.count) * 100)
        setFeedback({ text: `Book ✓ — played ${inBook.count}× (${pct}% win)`, good: true })
      } else {
        setFeedback({ text: 'New move — not in your history', good: false })
      }
      playOpponent(newFen, newHalfMove, newPgn)
      return true
    } catch { return false }
  }

  function onSquareClick(square: string) {
    if (!isPlayerTurn) return
    const playerColorChar = playerColor === 'white' ? 'w' : 'b'
    if (selectedSq) {
      const moved = onDrop(selectedSq, square)
      setSelectedSq(null)
      if (!moved) {
        const c = new Chess(fen)
        const piece = c.get(square as Parameters<typeof c.get>[0])
        if (piece && piece.color === playerColorChar) setSelectedSq(square)
      }
    } else {
      const c = new Chess(fen)
      const piece = c.get(square as Parameters<typeof c.get>[0])
      if (piece && piece.color === playerColorChar) setSelectedSq(square)
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); setViewIdx((i) => Math.max(0, i - 1)) }
      if (e.key === 'ArrowRight') { e.preventDefault(); setViewIdx((i) => Math.min(stepsRef.current.length - 1, i + 1)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => () => { if (opponentTimer.current) clearTimeout(opponentTimer.current) }, [])

  if (openings.length === 0) return null

  useEffect(() => {
    if (playerColor === 'black' && fen === START && !waiting && !outOfBook) {
      playOpponent(START, 0, '')
    }
  }, [playerColor, eco]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section>
      <h2>Opening drill</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <label>Opening:{' '}
          <select value={eco} onChange={(e) => setEco(e.target.value)}>
            {openings.map((o) => (
              <option key={o.name} value={o.name}>{o.name} — {o.games} games</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={reset}>Start over</button>
      </div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, height: 44, overflow: 'hidden' }}>
            {!atEnd
              ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}>Reviewing — ← → to navigate · move to continue from here</span>
              : waiting
              ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}>Opponent thinking…</span>
              : outOfBook
              ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}>Past your game history — you're now playing the engine.</span>
              : <span>Make a move. Kibitz replies with the most common response from your games.</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <EvalBar cp={evalCp} height={BOARD_SIZE} />
            <div>
              <Chessboard
                position={fen}
                boardOrientation={playerColor}
                arePiecesDraggable={isPlayerTurn}
                onPieceDrop={(s, t) => { setSelectedSq(null); return onDrop(s, t) }}
                onSquareClick={onSquareClick}
                customSquareStyles={selectedSq ? { [selectedSq]: { background: 'rgba(123,196,127,0.5)' } } : {}}
                customArrows={hint ? [[hint[0], hint[1], 'rgb(0,120,255)']] as [string, string, string][] : []}
                boardWidth={BOARD_SIZE}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <button type="button" onClick={() => setViewIdx((i) => Math.max(0, i - 1))} disabled={viewIdx === 0}>‹</button>
                <button type="button" onClick={() => setViewIdx((i) => Math.min(steps.length - 1, i + 1))} disabled={atEnd}>›</button>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{viewIdx} / {steps.length - 1}</span>
                {isPlayerTurn && (
                  <button type="button" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={async () => {
                    // First click shows the best move; click again to play it.
                    if (hint) { const [from, to] = hint; setHint(null); onDrop(from, to); return }
                    const uci = await getBestMove(fen, 14)
                    if (uci) setHint([uci.slice(0, 2), uci.slice(2, 4)])
                  }}>{hint ? 'Play hint' : 'Hint'}</button>
                )}
              </div>
            </div>
          </div>
        </div>
        <div style={{ minWidth: 200 }}>
          {feedback && atEnd && (
            <div style={{ marginBottom: 16, fontSize: 13, color: feedback.good ? '#7bc47f' : '#e0b15a', fontWeight: 600 }}>
              {feedback.text}
            </div>
          )}
          {pgn && (
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, fontFamily: 'monospace' }}>
              {pgnRows(pgn).map((r) => (
                <div key={r.n} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr', gap: 6, lineHeight: 1.7 }}>
                  <span style={{ opacity: 0.6 }}>{r.n}.</span>
                  <span>{r.white}</span>
                  <span>{r.black}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
