import { Chessboard } from 'react-chessboard'
import type { CSSProperties } from 'react'
import { useSettings, BOARD_THEMES } from './settings.js'

// v4-compatible tuple Arrow type; converted to v5 objects internally
export type Arrow = [string, string, string?]

type Props = {
  position?: string
  boardOrientation?: 'white' | 'black'
  boardWidth?: number
  arePiecesDraggable?: boolean
  onPieceDrop?: (source: string, target: string) => boolean
  onSquareClick?: (square: string) => void
  customArrows?: Arrow[]
  customSquareStyles?: Record<string, CSSProperties>
}

export function ThemedBoard({ boardWidth, arePiecesDraggable, onPieceDrop, onSquareClick, customArrows, customSquareStyles, position, boardOrientation }: Props) {
  const { settings } = useSettings()
  const colors = BOARD_THEMES[settings.boardTheme]

  return (
    <div style={boardWidth ? { width: boardWidth } : {}}>
      <Chessboard
        options={{
          position,
          boardOrientation,
          lightSquareStyle: colors.light as CSSProperties,
          darkSquareStyle: colors.dark as CSSProperties,
          animationDurationInMs: 150,
          allowDragging: arePiecesDraggable ?? true,
          onPieceDrop: onPieceDrop ? ({ sourceSquare, targetSquare }) =>
            targetSquare ? onPieceDrop(sourceSquare, targetSquare) : false
          : undefined,
          onSquareClick: onSquareClick ? ({ square }) => onSquareClick(square) : undefined,
          arrows: customArrows?.map(([startSquare, endSquare, color]) => ({
            startSquare,
            endSquare,
            color: color ?? 'rgb(90,140,220)',
          })),
          squareStyles: customSquareStyles,
        }}
      />
    </div>
  )
}
