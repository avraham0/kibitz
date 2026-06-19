import { useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { Arrow } from 'react-chessboard/dist/chessboard/types/index.js'
import type { BlunderRef } from '../api-types.js'
import { sanToSquares } from '../sanToSquares.js'
import { orientationFromFen } from '../orientationFromFen.js'
import { soundForSan, playMoveSound, soundEnabled } from '../sound.js'

function analysisLink(fen: string): string {
  return `https://www.chess.com/analysis?fen=${encodeURIComponent(fen)}`
}

// One blunder turned into a solvable puzzle: the board sits at the position before
// the mistake (from the player's perspective); the player tries to find the engine's
// best move. A correct drop solves it; wrong drops snap back and are counted.
// onResult fires once per puzzle: true when solved, false when the answer is revealed
// (i.e. given up). Used to drive the solved counter and spaced-repetition scheduling.
export function PuzzleBoard({ blunder, onResult, boardWidth = 260 }: { blunder: BlunderRef; onResult?: (correct: boolean) => void; boardWidth?: number }) {
  const best = sanToSquares(blunder.fenBefore, blunder.bestSan)
  const [position, setPosition] = useState(blunder.fenBefore)
  const [solved, setSolved] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [wrong, setWrong] = useState(0)

  function onDrop(from: string, to: string): boolean {
    if (best && from === best.from && to === best.to) {
      const c = new Chess(blunder.fenBefore)
      try { c.move(blunder.bestSan) } catch { /* keep fenBefore */ }
      setPosition(c.fen())
      if (soundEnabled()) playMoveSound(soundForSan(blunder.bestSan))
      if (!solved && !revealed) onResult?.(true)
      setSolved(true)
      return true
    }
    setWrong((w) => w + 1)
    return false
  }

  function reveal() {
    if (!solved && !revealed) onResult?.(false)
    setRevealed(true)
  }

  const arrows: Arrow[] = revealed && !solved && best
    ? [[best.from as Arrow[0], best.to as Arrow[1], 'rgb(80,160,80)']]
    : []

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
      <div style={{ fontSize: 13, marginTop: 8 }}>
        {solved ? (
          <span style={{ color: '#6c6' }}>✓ Solved — {blunder.bestSan}</span>
        ) : revealed ? (
          <span>Best was {blunder.bestSan}</span>
        ) : (
          <>
            Your move — find the best{wrong > 0 ? ` · ${wrong} wrong` : ''}{' '}
            <button type="button" onClick={reveal}>reveal</button>
          </>
        )}
        {' '}· {blunder.type}{' '}
        <a href={analysisLink(blunder.fenBefore)} target="_blank" rel="noreferrer">analyze</a>
      </div>
    </div>
  )
}
