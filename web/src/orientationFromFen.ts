// A blunder is always the player's own move, so the side to move in its
// fenBefore is the player's colour — orient the board from their perspective.
export function orientationFromFen(fen: string): 'white' | 'black' {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white'
}
