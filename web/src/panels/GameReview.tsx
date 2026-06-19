import { useState, useEffect, useCallback } from 'react'
import { Chessboard } from 'react-chessboard'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts'
import type { Arrow } from 'react-chessboard/dist/chessboard/types/index.js'
import type { GameSummary } from '../api-types.js'
import { sanToSquares } from '../sanToSquares.js'
import { AXIS, GRID, TOOLTIP, COLORS } from './chartTheme.js'

// Pick a game, see its eval graph, and step through it move by move.
export function GameReview({ games }: { games: GameSummary[] }) {
  const [gi, setGi] = useState(0)
  const [ply, setPly] = useState(0)
  const g = games.length ? games[Math.min(gi, games.length - 1)] : null
  const moves = g?.moves ?? []
  const maxPly = Math.max(0, moves.length - 1)

  const prev = useCallback(() => setPly((p) => Math.max(0, p - 1)), [])
  const next = useCallback(() => setPly((p) => Math.min(maxPly, p + 1)), [maxPly])

  // ← / → step through the game (ignored while a form control is focused).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next])

  if (!g) return null

  const idx = Math.min(ply, maxPly)
  const cur = moves[idx]
  const isMistake = !!cur && cur.isPlayerMove && cur.severity !== 'ok'
  const playedMv = cur ? sanToSquares(cur.fenBefore, cur.san) : null
  const bestMv = isMistake && cur ? sanToSquares(cur.fenBefore, cur.bestSan) : null
  const arrows: Arrow[] = []
  if (playedMv) arrows.push([playedMv.from as Arrow[0], playedMv.to as Arrow[1], isMistake ? 'rgb(200,80,80)' : 'rgb(90,140,220)'])
  if (bestMv) arrows.push([bestMv.from as Arrow[0], bestMv.to as Arrow[1], 'rgb(80,160,80)'])
  const data = moves.map((m) => ({ ply: m.ply, eval: m.evalCp }))

  function pick(i: number) { setGi(i); setPly(0) }

  return (
    <section>
      <h2>Game review</h2>
      <label>game:{' '}
        <select value={gi} onChange={(e) => pick(Number(e.target.value))}>
          {games.map((gg, i) => (
            <option key={i} value={i}>
              {gg.playedAt.slice(0, 10)} · {gg.color} · {gg.result} · {gg.accuracy}% · {gg.openingName}
            </option>
          ))}
        </select>
      </label>
      {moves.length === 0 ? (
        <p>No moves recorded for this game.</p>
      ) : (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
          <div style={{ width: 320 }}>
            {cur && (
              <Chessboard
                position={cur.fenBefore}
                boardOrientation={g.color}
                customArrows={arrows}
                arePiecesDraggable={false}
                boardWidth={320}
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button type="button" onClick={prev} disabled={idx === 0}>‹ prev</button>
                <button type="button" onClick={next} disabled={idx >= moves.length - 1}>next ›</button>
                <span style={{ fontSize: 13 }}>move {Math.ceil((cur?.ply ?? 0) / 2)} · {cur?.san}</span>
              </div>
              {isMistake && cur && (
                <div style={{ fontSize: 13, color: 'rgb(224,121,107)' }}>
                  {cur.severity} −{cur.cpLoss}cp · {cur.type} · best {cur.bestSan}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>← / → to step · click graph to jump</div>
            </div>
          </div>
          <LineChart
            width={420}
            height={240}
            data={data}
            style={{ cursor: 'pointer' }}
            onClick={(s: { activeTooltipIndex?: number }) => {
              if (s && typeof s.activeTooltipIndex === 'number') setPly(s.activeTooltipIndex)
            }}
          >
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="ply" tick={AXIS.tick} stroke={AXIS.stroke} />
            <YAxis domain={[-1500, 1500]} tick={AXIS.tick} stroke={AXIS.stroke} />
            <Tooltip {...TOOLTIP} />
            <ReferenceLine y={0} stroke="#4a525e" />
            {cur && <ReferenceLine x={cur.ply} stroke={COLORS.accent} />}
            <Line type="monotone" dataKey="eval" stroke={COLORS.line} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </div>
      )}
    </section>
  )
}
