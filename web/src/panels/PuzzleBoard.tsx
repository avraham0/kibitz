import { useState, useEffect } from 'react'
import { Chess } from 'chess.js'
import { ThemedBoard as Chessboard } from '../ThemedBoard.js'
import type { Arrow } from '../ThemedBoard.js'
import type { BlunderRef } from '../api-types.js'
import { sanToSquares } from '../sanToSquares.js'
import { orientationFromFen } from '../orientationFromFen.js'
import { soundForSan, playMoveSound, soundEnabled } from '../sound.js'
import { explainBlunder, explainWrongMove } from '../explainBlunder.js'

export type PuzzleState = { solved: boolean; revealed: boolean; wrong: number; lastWrongSan: string | null }

function analysisLink(fen: string): string {
  return `https://www.chess.com/analysis?fen=${encodeURIComponent(fen)}`
}

export function PuzzleFeedback({ state, blunder }: { state: PuzzleState; blunder: BlunderRef }) {
  const { solved, revealed, wrong, lastWrongSan } = state
  return (
    <div style={{ fontSize: 13 }}>
      {solved ? (
        <>
          <div style={{ color: '#6c6', fontWeight: 600 }}>✓ Solved — {blunder.bestSan}</div>
          <div style={{ color: 'var(--muted)', marginTop: 3 }}>{explainBlunder(blunder)}</div>
          {blunder.movesAfter?.length > 0 && (
            <div style={{ color: 'var(--muted)', marginTop: 4, fontSize: 12 }}>
              Game continued: {blunder.movesAfter.join(' ')}
            </div>
          )}
        </>
      ) : revealed ? (
        <>
          <div>Best was <strong>{blunder.bestSan}</strong></div>
          <div style={{ color: 'var(--muted)', marginTop: 3 }}>{explainBlunder(blunder)}</div>
          {blunder.movesAfter?.length > 0 && (
            <div style={{ color: 'var(--muted)', marginTop: 4, fontSize: 12 }}>
              Game continued: {blunder.movesAfter.join(' ')}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ color: 'var(--muted)' }}>
            Find the best move{wrong > 0 ? ` · ${wrong} wrong` : ''}
          </div>
          {lastWrongSan && (
            <div style={{ color: 'rgb(224,121,107)', marginTop: 3 }}>
              {explainWrongMove(blunder.fenBefore, lastWrongSan, blunder)}
            </div>
          )}
        </>
      )}
      <div style={{ marginTop: 4, color: 'var(--muted)' }}>
        {blunder.type}{' · '}
        <a href={analysisLink(blunder.fenBefore)} target="_blank" rel="noreferrer">analyze</a>
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
  blunder, onResult, boardWidth = 260, onStateChange, forceReveal,
}: {
  blunder: BlunderRef
  onResult?: (correct: boolean) => void
  boardWidth?: number
  onStateChange?: (state: PuzzleState) => void
  forceReveal?: boolean
}) {
  const best = sanToSquares(blunder.fenBefore, blunder.bestSan)
  const bad = sanToSquares(blunder.fenBefore, blunder.san)
  const [position, setPosition] = useState(blunder.fenBefore)
  const [solved, setSolved] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [wrong, setWrong] = useState(0)
  const [lastWrongSan, setLastWrongSan] = useState<string | null>(null)

  const state: PuzzleState = { solved, revealed, wrong, lastWrongSan }
  useEffect(() => { onStateChange?.(state) }, [solved, revealed, wrong, lastWrongSan]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (forceReveal) reveal() }, [forceReveal]) // eslint-disable-line react-hooks/exhaustive-deps

  function onDrop(from: string, to: string): boolean {
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
    try {
      const c = new Chess(blunder.fenBefore)
      const mv = c.move({ from, to, promotion: 'q' })
      if (mv) setLastWrongSan(mv.san)
    } catch { /* ignore */ }
    setWrong((w) => w + 1)
    return false
  }

  function reveal() {
    if (!solved && !revealed) onResult?.(false)
    setRevealed(true)
  }

  const arrows: Arrow[] = [
    ...(bad ? [[bad.from as Arrow[0], bad.to as Arrow[1], 'rgb(200,60,60)'] as Arrow] : []),
    ...(revealed && !solved && best ? [[best.from as Arrow[0], best.to as Arrow[1], 'rgb(80,160,80)'] as Arrow] : []),
  ]

  return (
    <div style={{ width: boardWidth }}>
      <Chessboard
        position={position}
        boardOrientation={orientationFromFen(blunder.fenBefore)}
        arePiecesDraggable={!solved && !revealed}
        onPieceDrop={(s, t) => onDrop(s, t)}
        customArrows={arrows}
        boardWidth={boardWidth}
      />
      {!onStateChange && (
        <div style={{ marginTop: 8 }}>
          <PuzzleFeedback state={state} blunder={blunder} />
          {!solved && !revealed && (
            <button type="button" style={{ marginTop: 6, fontSize: 13 }} onClick={reveal}>reveal</button>
          )}
        </div>
      )}
    </div>
  )
}
