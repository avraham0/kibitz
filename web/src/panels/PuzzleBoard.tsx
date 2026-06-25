import { useState, useEffect, useMemo } from 'react'
import { Chess } from 'chess.js'
import { ThemedBoard as Chessboard } from '../ThemedBoard.js'
import type { Arrow } from '../ThemedBoard.js'
import type { BlunderRef } from '../api-types.js'
import { sanToSquares } from '../sanToSquares.js'
import { orientationFromFen } from '../orientationFromFen.js'
import { soundForSan, playMoveSound, soundEnabled } from '../sound.js'
import { explainBlunder, explainWrongMove } from '../explainBlunder.js'
import { LESSON } from '../lessons.js'
import { ExternalLinkIcon } from './ExternalLinkIcon.js'
import { useBoardSize } from '../useBoardSize.js'

export type PuzzleState = { solved: boolean; revealed: boolean; wrong: number; lastWrongSan: string | null; committed?: boolean; reviewLen?: number }

function analysisLink(fen: string): string {
  return `https://www.chess.com/analysis?fen=${encodeURIComponent(fen)}`
}

export function PuzzleFeedback({ state, blunder, onReview }: { state: PuzzleState; blunder: BlunderRef; onReview?: () => void }) {
  const { solved, revealed, wrong, lastWrongSan, committed } = state
  const lesson = blunder.type in LESSON ? LESSON[blunder.type as keyof typeof LESSON] : null
  const principle = lesson && <div style={{ color: 'var(--muted)', marginTop: 3 }}><strong>Principle:</strong> {lesson}</div>
  return (
    <div style={{ fontSize: 13 }}>
      {solved ? (
        <>
          <div style={{ color: '#6c6', fontWeight: 600 }}>✓ Solved — {blunder.bestSan}</div>
          <div style={{ color: 'var(--muted)', marginTop: 3 }}>{explainBlunder(blunder)}</div>
          {principle}
        </>
      ) : revealed ? (
        <>
          <div>Best was <strong>{blunder.bestSan}</strong></div>
          <div style={{ color: 'var(--muted)', marginTop: 3 }}>{explainBlunder(blunder)}</div>
          {principle}
        </>
      ) : committed && lastWrongSan ? (
        <>
          <div style={{ color: 'rgb(224,121,107)', fontWeight: 600 }}>✗ {lastWrongSan} is a mistake</div>
          <div style={{ color: 'rgb(224,121,107)', marginTop: 3 }}>
            {explainWrongMove(blunder.fenBefore, lastWrongSan, blunder)}
          </div>
        </>
      ) : (
        <>
          {wrong > 0 && <div style={{ color: 'var(--muted)' }}>{wrong} wrong</div>}
          {lastWrongSan && (
            <div style={{ color: 'rgb(224,121,107)', marginTop: 3 }}>
              {explainWrongMove(blunder.fenBefore, lastWrongSan, blunder)}
            </div>
          )}
        </>
      )}
      <div style={{ marginTop: 4, color: 'var(--muted)', display: 'flex', gap: 12, alignItems: 'center' }}>
        {onReview && (
          <button type="button" onClick={onReview} style={{ background: 'none', border: 'none', color: 'var(--accent, #7bc4ff)', cursor: 'pointer', padding: 0, fontSize: 13, textDecoration: 'underline' }}>review</button>
        )}
        <a href={analysisLink(blunder.fenBefore)} target="_blank" rel="noreferrer" title="Analyze on chess.com" aria-label="Analyze on chess.com" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--muted)' }}>
          <ExternalLinkIcon />
        </a>
      </div>
    </div>
  )
}

// One blunder turned into a solvable puzzle: the board sits at the position before
// the mistake (from the player's perspective); the player tries to find the engine's
// best move. A correct drop solves it; wrong drops snap back and are counted.
// onResult fires once per puzzle: true when solved, false when the answer is revealed
// (i.e. given up). Used to drive the solved counter and spaced-repetition scheduling.
export function PuzzleBoard({
  blunder, onResult, boardWidth = 260, onStateChange, forceReveal, reviewIdx = null,
}: {
  blunder: BlunderRef
  onResult?: (correct: boolean) => void
  boardWidth?: number
  onStateChange?: (state: PuzzleState) => void
  forceReveal?: boolean
  reviewIdx?: number | null
}) {
  const best = sanToSquares(blunder.fenBefore, blunder.bestSan)
  const bad = sanToSquares(blunder.fenBefore, blunder.san)
  // The game line from the puzzle position: the move played, then what followed.
  // ← / → step through it (driven by the parent) once the puzzle is answered.
  const reviewLine = useMemo(() => {
    const positions = [blunder.fenBefore]
    const c = new Chess(blunder.fenBefore)
    for (const san of [blunder.san, ...(blunder.movesAfter ?? [])]) {
      try { c.move(san); positions.push(c.fen()) } catch { break }
    }
    return positions
  }, [blunder])
  const [position, setPosition] = useState(blunder.fenBefore)
  const [solved, setSolved] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [wrong, setWrong] = useState(0)
  const [lastWrongSan, setLastWrongSan] = useState<string | null>(null)
  // A legal-but-wrong move stays on the board (not snapped back) and locks it until
  // the player resets — they see the consequence of their mistake.
  const [committed, setCommitted] = useState(false)
  // Tap-to-move (works alongside drag, important on touch): first tap selects a
  // piece, second tap is the destination.
  const [selectedSq, setSelectedSq] = useState<string | null>(null)

  const state: PuzzleState = { solved, revealed, wrong, lastWrongSan, committed, reviewLen: reviewLine.length }
  useEffect(() => { onStateChange?.(state) }, [solved, revealed, wrong, lastWrongSan, committed, reviewLine.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (forceReveal) reveal() }, [forceReveal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Only swap to the step view once answered AND the parent has engaged stepping
  // (reviewIdx != null). Pre-answer the board stays exactly as before, so dragging
  // is unaffected.
  const reviewing = solved || revealed
  const stepping = reviewing && reviewIdx != null
  const ri = Math.min(Math.max(0, reviewIdx ?? 0), reviewLine.length - 1)
  const boardPosition = stepping ? reviewLine[ri] : position

  function onDrop(from: string, to: string): boolean {
    if (solved || revealed || committed) return false
    if (best && from === best.from && to === best.to) {
      const c = new Chess(blunder.fenBefore)
      try { c.move(blunder.bestSan) } catch { /* keep fenBefore */ }
      setPosition(c.fen())
      if (soundEnabled()) playMoveSound(soundForSan(blunder.bestSan))
      if (!solved && !revealed) onResult?.(true)
      setSolved(true)
      setLastWrongSan(null)
      return true
    }
    // Legal but wrong: play it so the piece stays where dropped, then lock the board.
    try {
      const c = new Chess(blunder.fenBefore)
      const mv = c.move({ from, to, promotion: 'q' })
      if (mv) {
        setPosition(c.fen())
        if (soundEnabled()) playMoveSound(soundForSan(mv.san))
        setLastWrongSan(mv.san)
        setWrong((w) => w + 1)
        setCommitted(true)
        return true
      }
    } catch { /* not a legal move (or opponent's piece) — counted, snapped back below */ }
    setWrong((w) => w + 1)
    return false
  }

  function onSquareClick(square: string) {
    if (solved || revealed || committed) return
    const c = new Chess(blunder.fenBefore)
    const mover = c.turn()
    if (selectedSq) {
      const moved = onDrop(selectedSq, square)
      setSelectedSq(null)
      if (!moved) {
        const p = c.get(square as Parameters<typeof c.get>[0])
        if (p && p.color === mover) setSelectedSq(square)
      }
    } else {
      const p = c.get(square as Parameters<typeof c.get>[0])
      if (p && p.color === mover) setSelectedSq(square)
    }
  }

  function reveal() {
    if (!solved && !revealed) onResult?.(false)
    setPosition(blunder.fenBefore) // reset to the original position before showing the answer
    setCommitted(false)
    setSelectedSq(null)
    setRevealed(true)
  }

  function tryAgain() {
    setPosition(blunder.fenBefore)
    setCommitted(false)
    setSelectedSq(null)
    setLastWrongSan(null)
  }

  // Don't reveal the played blunder upfront — only show it (and the best move) as
  // context once answered. Clear the arrows once the player steps into the line.
  const arrows: Arrow[] = (reviewing && (!stepping || ri === 0)) ? [
    ...(bad ? [[bad.from as Arrow[0], bad.to as Arrow[1], 'rgb(200,60,60)'] as Arrow] : []),
    ...(best ? [[best.from as Arrow[0], best.to as Arrow[1], 'rgb(80,160,80)'] as Arrow] : []),
  ] : []

  const [boardRef, size] = useBoardSize(boardWidth)
  return (
    <div ref={boardRef} style={{ width: '100%', maxWidth: boardWidth }}>
      <Chessboard
        position={boardPosition}
        boardOrientation={orientationFromFen(blunder.fenBefore)}
        arePiecesDraggable={!solved && !revealed && !committed}
        onPieceDrop={(s, t) => onDrop(s, t)}
        onSquareClick={onSquareClick}
        customSquareStyles={selectedSq ? { [selectedSq]: { background: 'rgba(123,196,127,0.5)' } } : undefined}
        customArrows={arrows}
        boardWidth={size}
      />
      {!onStateChange && (
        <div style={{ marginTop: 8 }}>
          <PuzzleFeedback state={state} blunder={blunder} />
          {!solved && !revealed && (
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {committed && <button type="button" style={{ fontSize: 13 }} onClick={tryAgain}>try again</button>}
              <button type="button" style={{ fontSize: 13 }} onClick={reveal}>reveal</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
