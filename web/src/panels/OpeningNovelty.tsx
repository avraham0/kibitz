import { useState, useEffect } from 'react'
import { Chess } from 'chess.js'
import type { GameSummary } from '../api-types.js'
import { loadBook, lookupFen, type BookMove } from '../openingBook.js'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

type Deviation = {
  gameId: string; date: string; url: string
  ply: number; san: string; bookMoves: string[]; moveNum: number
}

async function findDeviations(games: GameSummary[]): Promise<Deviation[]> {
  const deviations: Deviation[] = []
  for (const g of games) {
    const chess = new Chess()
    let devPly: number | null = null
    for (const m of g.moves) {
      const fen = chess.fen()
      const bookMoves = await lookupFen(fen)
      const bookSans = bookMoves.map((bm) => sanFromUci(fen, bm))
      if (bookMoves.length > 0 && !bookSans.includes(m.san)) {
        devPly = m.ply
        deviations.push({
          gameId: g.gameId, date: g.playedAt.slice(0, 10), url: g.url,
          ply: m.ply, san: m.san, bookMoves: bookSans.filter(Boolean).slice(0, 3),
          moveNum: Math.ceil(m.ply / 2),
        })
        break
      }
      // Stop after opening phase
      if (m.phase !== 'opening') break
      try { chess.move(m.san) } catch { break }
    }
    if (devPly === null && g.moves.some((m) => m.phase === 'opening')) {
      // Never left book during opening
    }
  }
  return deviations.sort((a, b) => b.ply - a.ply)  // longest in-book first (most prepared)
}

function sanFromUci(fen: string, bm: BookMove): string {
  try {
    const c = new Chess(fen)
    const mv = c.move({ from: bm.from, to: bm.to, promotion: bm.promotion })
    return mv?.san ?? ''
  } catch { return '' }
}

export function OpeningNovelty({ games, onOpenGame }: { games: GameSummary[]; onOpenGame?: (id: string, ply?: number) => void }) {
  const [status, setStatus] = useState<'idle' | 'loading-book' | 'analyzing' | 'done' | 'no-book'>('idle')
  const [deviations, setDeviations] = useState<Deviation[]>([])
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus('loading-book')
    loadBook().then(async (book) => {
      if (cancelled) return
      if (!book) { setStatus('no-book'); return }
      setStatus('analyzing')
      // Process games in batches to keep UI responsive
      const results: Deviation[] = []
      for (let i = 0; i < games.length; i++) {
        if (cancelled) return
        const devs = await findDeviations([games[i]])
        results.push(...devs)
        setProgress(Math.round(((i + 1) / games.length) * 100))
      }
      if (!cancelled) {
        setDeviations(results.sort((a, b) => b.ply - a.ply))
        setStatus('done')
      }
    })
    return () => { cancelled = true }
  }, [games])

  if (status === 'no-book') {
    return (
      <section>
        <h2>Opening novelty</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          No opening book found. Download <code>cerebellum.bin</code> from{' '}
          <a href="https://github.com/official-stockfish/books" target="_blank" rel="noreferrer">official-stockfish/books</a>{' '}
          and place it at <code>web/public/book.bin</code>.
        </p>
      </section>
    )
  }

  if (status === 'loading-book') {
    return (
      <section>
        <h2>Opening novelty</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading opening book…</p>
      </section>
    )
  }

  if (status === 'analyzing') {
    return (
      <section>
        <h2>Opening novelty</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Analyzing openings… {progress}%</p>
      </section>
    )
  }

  const avgBookDepth = deviations.length > 0
    ? Math.round(deviations.reduce((s, d) => s + d.moveNum - 1, 0) / deviations.length)
    : 0

  return (
    <section>
      <h2>Opening novelty</h2>
      <p style={{ marginTop: 0, fontSize: 12, color: 'var(--muted)' }}>
        First move in each game that deviates from the opening book (cerebellum).
        Average book depth: <strong>{avgBookDepth} moves</strong>.
      </p>
      {deviations.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>All games stayed in book through the opening phase.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {deviations.slice(0, 20).map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, padding: '6px 10px', background: 'var(--surface-2)', borderRadius: 6, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--muted)', minWidth: 80 }}>{d.date}</span>
              <span style={{ color: 'var(--muted)', minWidth: 60 }}>move {d.moveNum}</span>
              <span style={{ fontFamily: 'monospace', color: '#e0b15a', fontWeight: 600 }}>{d.san}</span>
              {d.bookMoves.length > 0 && (
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                  book: <span style={{ fontFamily: 'monospace', color: '#7bc47f' }}>{d.bookMoves.join(' / ')}</span>
                </span>
              )}
              {onOpenGame && (
                <button type="button" onClick={() => onOpenGame(d.gameId, d.ply)}
                  style={{ fontSize: 12, padding: '0 6px', marginLeft: 'auto' }}>
                  review
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
