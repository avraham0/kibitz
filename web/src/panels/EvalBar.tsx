// Vertical eval bar — the white fill grows toward white's advantage. `cp` is white-POV
// centipawns (null = unknown). `orientation` matches the board: the side shown at the
// bottom of the board fills from the bottom of the bar. Shared by Opening drill / Game review.
export function EvalBar({ cp, height, orientation = 'white' }: { cp: number | null; height: number; orientation?: 'white' | 'black' }) {
  const v = cp ?? 0
  const whitePct = 50 + 50 * Math.tanh(v / 300)
  const label = cp == null ? '?' : v > 0 ? `+${(v / 100).toFixed(1)}` : (v / 100).toFixed(1)
  // White fills from the bottom when white is at the bottom of the board, else from the top.
  const anchor = orientation === 'black' ? { top: 0 } : { bottom: 0 }
  return (
    <div style={{ width: 16, height, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden', flexShrink: 0, position: 'relative' }} title={label}>
      <div style={{ position: 'absolute', ...anchor, width: '100%', height: `${whitePct}%`, background: '#d8d8d8', transition: 'height 0.3s ease' }} />
    </div>
  )
}
