import { useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { Arrow } from 'react-chessboard/dist/chessboard/types/index.js'
import type { BlunderRef } from '../api-types.js'
import { sanToSquares } from '../sanToSquares.js'
import { orientationFromFen } from '../orientationFromFen.js'

function analysisLink(fen: string): string {
  return `https://www.chess.com/analysis?fen=${encodeURIComponent(fen)}`
}

// One blunder turned into a solvable puzzle: the board sits at the position before
// the mistake (from the player's perspective); the player tries to find the engine's
// best move. A correct drop solves it; wrong drops snap back and are counted.
export function PuzzleBoard({ blunder, onSolve }: { blunder: BlunderRef; onSolve?: () => void }) {
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
      if (!solved) onSolve?.()
      setSolved(true)
      return true
    }
    setWrong((w) => w + 1)
    return false
  }

  function reveal() {
    setRevealed(true)
  }

  const arrows: Arrow[] = revealed && !solved && best
    ? [[best.from as Arrow[0], best.to as Arrow[1], 'rgb(80,160,80)']]
    : []

  return (
    <div style={{ width: 260 }}>
      <Chessboard
        position={position}
        boardOrientation={orientationFromFen(blunder.fenBefore)}
        arePiecesDraggable={!solved && !revealed}
        onPieceDrop={(s, t) => onDrop(s, t)}
        customArrows={arrows}
        boardWidth={260}
      />
      <div style={{ fontSize: 13 }}>
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
