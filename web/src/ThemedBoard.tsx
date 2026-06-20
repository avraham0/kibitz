import { Chessboard } from 'react-chessboard'
import type { ComponentProps } from 'react'
import { useSettings, BOARD_THEMES } from './settings.js'

type Props = Omit<ComponentProps<typeof Chessboard>, 'customLightSquareStyle' | 'customDarkSquareStyle'>

export function ThemedBoard(props: Props) {
  const { settings } = useSettings()
  const colors = BOARD_THEMES[settings.boardTheme]
  return (
    <Chessboard
      {...props}
      customLightSquareStyle={colors.light}
      customDarkSquareStyle={colors.dark}
    />
  )
}
