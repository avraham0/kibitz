import { useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'
import type { Arrow } from 'react-chessboard/dist/chessboard/types/index.js'
import type { GameSummary } from '../api-types.js'
import { sanToSquares } from '../sanToSquares.js'

// Pick a game, see its eval graph, and step through it move by move.
export function GameReview({ games }: { games: GameSummary[] }) {
  const [gi, setGi] = useState(0)
  const [ply, setPly] = useState(0)
  if (games.length === 0) return null

  const g = games[Math.min(gi, games.length - 1)]
  const moves = g.moves
  const idx = Math.min(ply, Math.max(0, moves.length - 1))
  const cur = moves[idx]
  const mv = cur ? sanToSquares(cur.fenBefore, cur.san) : null
  const arrows: Arrow[] = mv ? [[mv.from as Arrow[0], mv.to as Arrow[1], 'rgb(90,140,220)']] : []
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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <button type="button" onClick={() => setPly((p) => Math.max(0, p - 1))} disabled={idx === 0}>‹ prev</button>
              <span style={{ fontSize: 13 }}>
                move {Math.ceil((cur?.ply ?? 0) / 2)} · {cur?.san}{cur && cur.cpLoss >= 50 ? ` · −${cur.cpLoss}cp` : ''}
              </span>
              <button type="button" onClick={() => setPly((p) => Math.min(moves.length - 1, p + 1))} disabled={idx >= moves.length - 1}>next ›</button>
            </div>
          </div>
          <LineChart width={420} height={240} data={data}>
            <XAxis dataKey="ply" tick={{ fill: '#bbb' }} stroke="#555" />
            <YAxis domain={[-1500, 1500]} tick={{ fill: '#bbb' }} stroke="#555" />
            <Tooltip />
            <ReferenceLine y={0} stroke="#777" />
            {cur && <ReferenceLine x={cur.ply} stroke="#5a8cdc" />}
            <Line type="monotone" dataKey="eval" stroke="#9c6" dot={false} isAnimationActive={false} />
          </LineChart>
        </div>
      )}
    </section>
  )
}
