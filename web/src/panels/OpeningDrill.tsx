import { useState, useEffect, useRef, useMemo } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { GameSummary, OpeningStat } from '../api-types.js'
import { buildTree, topMove } from '../openingTree.js'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export function OpeningDrill({ openings, games }: { openings: OpeningStat[]; games: GameSummary[] }) {
  const [eco, setEco] = useState(openings[0]?.eco ?? '')
  const [fen, setFen] = useState(START)
  const [pgn, setPgn] = useState('')
  const [halfMove, setHalfMove] = useState(0)
  const [feedback, setFeedback] = useState<{ text: string; good: boolean } | null>(null)
  const [outOfBook, setOutOfBook] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const opponentTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ecoGames = useMemo(() => games.filter((g) => g.eco === eco), [games, eco])
  const tree = useMemo(() => buildTree(ecoGames), [ecoGames])

  const playerColor = useMemo((): 'white' | 'black' => {
    const whites = ecoGames.filter((g) => g.color === 'white').length
    return whites >= ecoGames.length / 2 ? 'white' : 'black'
  }, [ecoGames])

  const chess = new Chess(fen)
  const sideToMove = chess.turn() === 'w' ? 'white' : 'black'
  const isPlayerTurn = sideToMove === playerColor && !outOfBook && !waiting

  function appendPgn(currentPgn: string, san: string, currentHalfMove: number): string {
    const moveNum = Math.floor(currentHalfMove / 2) + 1
    const isWhite = currentHalfMove % 2 === 0
    if (isWhite) return currentPgn ? `${currentPgn} ${moveNum}. ${san}` : `${moveNum}. ${san}`
    return `${currentPgn} ${san}`
  }

  function reset() {
    if (opponentTimer.current) clearTimeout(opponentTimer.current)
    setFen(START); setPgn(''); setHalfMove(0); setFeedback(null); setOutOfBook(false); setWaiting(false)
  }

  // Reset when ECO changes
  useEffect(() => { reset() }, [eco]) // eslint-disable-line react-hooks/exhaustive-deps

  function playOpponent(currentFen: string, currentHalfMove: number, currentPgn: string) {
    setWaiting(true)
    opponentTimer.current = setTimeout(() => {
      const best = topMove(tree, currentFen)
      if (!best || !best.stats.fenAfter) {
        setOutOfBook(true); setWaiting(false); return
      }
      const newPgn = appendPgn(currentPgn, best.san, currentHalfMove)
      setFen(best.stats.fenAfter)
      setPgn(newPgn)
      setHalfMove((h) => h + 1)
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
      setFen(newFen); setHalfMove(newHalfMove); setPgn(newPgn)
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

  useEffect(() => () => { if (opponentTimer.current) clearTimeout(opponentTimer.current) }, [])

  if (openings.length === 0) return null

  // If playing black, auto-play white's first move on mount / reset
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
              <option key={o.eco} value={o.eco}>{o.name} ({o.eco}) — {o.games} games</option>
            ))}
          </select>
        </label>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>You play {playerColor} · {ecoGames.length} training games</span>
        <button type="button" onClick={reset}>Start over</button>
      </div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 14, marginBottom: 8, minHeight: 22 }}>
            {outOfBook
              ? <span style={{ color: 'rgb(224,121,107)' }}>Out of book — position not in your history</span>
              : waiting
              ? <span style={{ color: 'var(--muted)' }}>Opponent thinking…</span>
              : isPlayerTurn
              ? <span style={{ fontWeight: 600 }}>Your move ({playerColor})</span>
              : null}
          </div>
          <Chessboard
            position={fen}
            boardOrientation={playerColor}
            arePiecesDraggable={isPlayerTurn}
            onPieceDrop={(s, t) => onDrop(s, t)}
            boardWidth={360}
          />
        </div>
        <div style={{ minWidth: 200 }}>
          {feedback && (
            <div style={{ marginBottom: 16, fontSize: 14, color: feedback.good ? '#7bc47f' : '#e0b15a', fontWeight: 600 }}>
              {feedback.text}
            </div>
          )}
          {pgn && (
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, fontFamily: 'monospace', lineHeight: 1.8 }}>
              {pgn}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
            <div>Drag to make your move.</div>
            <div>Kibitz replies with the most</div>
            <div>common response from your games.</div>
          </div>
        </div>
      </div>
    </section>
  )
}
