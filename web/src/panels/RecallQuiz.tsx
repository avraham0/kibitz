import { useState, useMemo } from 'react'
import { Chess } from 'chess.js'
import type { GameSummary } from '../api-types.js'
import { ThemedBoard as Chessboard } from '../ThemedBoard.js'
import type { Arrow } from '../ThemedBoard.js'
import { sanToSquares } from '../sanToSquares.js'
import { soundForSan, playMoveSound, soundEnabled } from '../sound.js'
import { useBoardSize } from '../useBoardSize.js'

// Active recall (Bjork 1994): instead of passively replaying the game, you guess
// your own move at each of your turns, then see what you actually played and what
// was best. Retrieval practice on your own games.
export function RecallQuiz({ game }: { game: GameSummary }) {
  const playerMoves = useMemo(() => game.moves.filter((m) => m.isPlayerMove), [game])
  const [i, setI] = useState(0)
  const [guess, setGuess] = useState<string | null>(null)
  const [selectedSq, setSelectedSq] = useState<string | null>(null)
  const [boardRef, size] = useBoardSize(360)

  const m = playerMoves[i]

  // Before answering: the position before your move. After: show your guess played.
  // (declared before the early return to keep hook order stable)
  const position = useMemo(() => {
    if (!m || !guess) return m?.fenBefore ?? ''
    try { const c = new Chess(m.fenBefore); c.move(guess); return c.fen() } catch { return m.fenBefore }
  }, [guess, m])

  if (!m) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 16px' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>You recalled all {playerMoves.length} of your moves.</div>
        <button type="button" onClick={() => { setI(0); setGuess(null) }}>Start over</button>
      </div>
    )
  }

  const moveNo = Math.floor((m.ply - 1) / 2) + 1
  const best = sanToSquares(m.fenBefore, m.bestSan)
  const actual = sanToSquares(m.fenBefore, m.san)

  function submit(san: string) {
    setGuess(san)
    setSelectedSq(null)
    if (soundEnabled()) playMoveSound(soundForSan(san))
  }

  function onDrop(from: string, to: string): boolean {
    if (guess) return false
    try {
      const c = new Chess(m.fenBefore)
      const mv = c.move({ from, to, promotion: 'q' })
      if (!mv) return false
      submit(mv.san)
      return true
    } catch { return false }
  }

  function onSquareClick(square: string) {
    if (guess) return
    const c = new Chess(m.fenBefore)
    const mover = c.turn()
    if (selectedSq) {
      if (!onDrop(selectedSq, square)) {
        const p = c.get(square as Parameters<typeof c.get>[0])
        setSelectedSq(p && p.color === mover ? square : null)
      } else setSelectedSq(null)
    } else {
      const p = c.get(square as Parameters<typeof c.get>[0])
      if (p && p.color === mover) setSelectedSq(square)
    }
  }

  function next() { setI((n) => n + 1); setGuess(null); setSelectedSq(null) }

  const foundBest = guess === m.bestSan
  const playedSame = guess === m.san
  const arrows: Arrow[] = guess ? [
    ...(actual && m.san !== m.bestSan ? [[actual.from as Arrow[0], actual.to as Arrow[1], 'rgb(200,120,60)'] as Arrow] : []),
    ...(best ? [[best.from as Arrow[0], best.to as Arrow[1], 'rgb(80,160,80)'] as Arrow] : []),
  ] : []

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
        Move {moveNo} · your move {i + 1} / {playerMoves.length} — what would you play?
      </div>
      <div ref={boardRef} style={{ width: '100%', maxWidth: 360 }}>
        <Chessboard
          position={position}
          boardOrientation={game.color}
          arePiecesDraggable={!guess}
          onPieceDrop={(s, t) => onDrop(s, t)}
          onSquareClick={onSquareClick}
          customSquareStyles={selectedSq ? { [selectedSq]: { background: 'rgba(123,196,127,0.5)' } } : undefined}
          customArrows={arrows}
          boardWidth={size}
        />
      </div>
      <div style={{ minHeight: 70, marginTop: 8, fontSize: 13 }}>
        {guess && (
          <>
            {foundBest ? (
              <div style={{ color: '#6c6', fontWeight: 600 }}>✓ {guess} — the best move{playedSame ? ', and what you played.' : '.'}</div>
            ) : (
              <>
                <div>You'd play <strong>{guess}</strong>.</div>
                {!playedSame && <div style={{ color: 'var(--muted)' }}>You actually played {m.san}{m.severity === 'blunder' || m.severity === 'mistake' ? ` (a ${m.severity})` : ''}.</div>}
                <div style={{ color: 'rgb(80,160,80)' }}>Best was {m.bestSan}.</div>
              </>
            )}
            <button type="button" style={{ marginTop: 8, fontSize: 13 }} onClick={next}>next move ›</button>
          </>
        )}
      </div>
    </div>
  )
}
