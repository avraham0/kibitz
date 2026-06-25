import { useState, useEffect } from 'react'
import { Chess } from 'chess.js'
import { ThemedBoard as Chessboard } from '../ThemedBoard.js'
import { getBestMove } from '../useStockfish.js'
import { orientationFromFen } from '../orientationFromFen.js'
import { useBoardSize } from '../useBoardSize.js'

// A worked example (Kirschner 2006; Van Gerven 2002): play the engine's best move,
// then extend the line with the engine for a few plies, and let the player step
// through the whole solution on the board instead of just seeing one move.
export function BestLineWalkthrough({ fenBefore, bestSan, max = 300 }: { fenBefore: string; bestSan: string; max?: number }) {
  const [boardRef, size] = useBoardSize(max)
  const [fens, setFens] = useState<string[] | null>(null)
  const [sans, setSans] = useState<string[]>([])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    let cancelled = false
    setFens(null); setSans([]); setIdx(0)
    ;(async () => {
      const c = new Chess(fenBefore)
      const f = [fenBefore]
      const s: string[] = []
      try { c.move(bestSan); f.push(c.fen()); s.push(bestSan) } catch { /* best move illegal — bail */ }
      for (let i = 0; i < 6 && f.length > 1; i++) {
        const uci = await getBestMove(c.fen(), 12)
        if (cancelled || !uci) break
        let mv
        try { mv = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: (uci[4] as 'q' | 'r' | 'b' | 'n') || 'q' }) } catch { break }
        if (!mv) break
        f.push(c.fen()); s.push(mv.san)
      }
      if (!cancelled) { setFens(f); setSans(s); setIdx(Math.min(1, f.length - 1)) }
    })()
    return () => { cancelled = true }
  }, [fenBefore, bestSan])

  if (!fens) return <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>Computing the winning line…</div>

  const pos = fens[Math.min(idx, fens.length - 1)]
  return (
    <div ref={boardRef} style={{ width: '100%', maxWidth: max, marginTop: 8 }}>
      <Chessboard position={pos} boardOrientation={orientationFromFen(fenBefore)} arePiecesDraggable={false} boardWidth={size} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, fontSize: 13 }}>
        <button type="button" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>‹</button>
        <button type="button" onClick={() => setIdx((i) => Math.min(fens.length - 1, i + 1))} disabled={idx >= fens.length - 1}>›</button>
        <span style={{ color: 'var(--muted)' }}>{idx} / {fens.length - 1}</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 13, fontFamily: 'monospace', lineHeight: 1.7 }}>
        {sans.map((s, i) => (
          <span
            key={i}
            onClick={() => setIdx(i + 1)}
            style={{ cursor: 'pointer', marginRight: 8, fontWeight: idx === i + 1 ? 700 : 400, color: idx === i + 1 ? 'var(--accent)' : 'var(--text)' }}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}
