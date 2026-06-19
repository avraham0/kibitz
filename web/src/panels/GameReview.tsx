import { useState, useEffect, useCallback, useRef } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts'
import type { Arrow } from 'react-chessboard/dist/chessboard/types/index.js'
import type { GameSummary, GameMove } from '../api-types.js'
import { sanToSquares } from '../sanToSquares.js'
import { AXIS, GRID, TOOLTIP, COLORS } from './chartTheme.js'
import { accuracyColor } from '../accuracyColor.js'
import { soundForSan, playMoveSound, SOUND_KEY } from '../sound.js'

const TIME_TROUBLE_SEC = 20

// One clickable move in the notation list. Player mistakes are tinted red; the
// current move is highlighted.
function MoveSan({ m, active, onClick }: { m: GameMove; active: boolean; onClick: () => void }) {
  const isMistake = m.isPlayerMove && m.severity !== 'ok'
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? COLORS.accent : 'transparent',
        color: active ? '#0b0e13' : isMistake ? 'rgb(224,121,107)' : 'inherit',
        border: 'none', cursor: 'pointer', padding: '1px 5px', borderRadius: 3,
        fontWeight: active || isMistake ? 700 : 400, width: 72, textAlign: 'left',
      }}
    >
      {m.san}
    </button>
  )
}

function fmtClock(sec: number | null): string | null {
  if (sec == null) return null
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Position with the move played — we store the position before each move, so apply
// the SAN to show the move as played (chess.com/lichess convention).
function fenAfter(fen: string, san: string): string {
  try { const c = new Chess(fen); c.move(san); return c.fen() } catch { return fen }
}

// Pick a game, see its eval graph, and step through it move by move.
export function GameReview({ games, focus }: { games: GameSummary[]; focus?: { id: string; seq: number } | null }) {
  const [gi, setGi] = useState(0)
  const [ply, setPly] = useState(0)

  // Jump to a game requested from elsewhere (e.g. the openings drill-down).
  useEffect(() => {
    if (!focus) return
    const i = games.findIndex((g) => g.gameId === focus.id)
    if (i >= 0) { setGi(i); setPly(0) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.seq])
  const g = games.length ? games[Math.min(gi, games.length - 1)] : null
  const moves = g?.moves ?? []
  const maxPly = Math.max(0, moves.length - 1)

  const prev = useCallback(() => setPly((p) => Math.max(0, p - 1)), [])
  const next = useCallback(() => setPly((p) => Math.min(maxPly, p + 1)), [maxPly])

  const [soundOn, setSoundOn] = useState<boolean>(() => {
    try { return localStorage.getItem(SOUND_KEY) !== '0' } catch { return true }
  })
  const soundOnRef = useRef(soundOn)
  soundOnRef.current = soundOn
  const firstRef = useRef(true)

  const [flipped, setFlipped] = useState(false)
  const [playing, setPlaying] = useState(false)

  // Autoplay: advance one ply on a timer while playing; stop at the last move.
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setPly((p) => (p >= maxPly ? p : p + 1)), 900)
    return () => clearInterval(id)
  }, [playing, maxPly])
  useEffect(() => {
    if (playing && Math.min(ply, maxPly) >= maxPly) setPlaying(false)
  }, [ply, maxPly, playing])

  function togglePlay() {
    setPly((p) => (p >= maxPly ? 0 : p)) // restart if parked at the end
    setPlaying((v) => !v)
  }

  function toggleSound() {
    setSoundOn((v) => {
      const nv = !v
      try { localStorage.setItem(SOUND_KEY, nv ? '1' : '0') } catch { /* unavailable */ }
      if (nv) playMoveSound('move') // sample + unlocks audio on this gesture
      return nv
    })
  }

  // Play a move sound whenever the position changes (step, jump, or game switch).
  // The board shows the current move as played, so sound that same move.
  useEffect(() => {
    if (firstRef.current) { firstRef.current = false; return }
    if (!soundOnRef.current) return
    const m = moves[Math.min(ply, maxPly)]
    if (m) playMoveSound(soundForSan(m.san))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ply, gi])

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
  const clock = cur ? fmtClock(cur.clockSeconds) : null
  const timeTrouble = !!cur && cur.isPlayerMove && cur.clockSeconds != null && cur.clockSeconds < TIME_TROUBLE_SEC
  const playedMv = cur ? sanToSquares(cur.fenBefore, cur.san) : null
  const bestMv = isMistake && cur ? sanToSquares(cur.fenBefore, cur.bestSan) : null
  const arrows: Arrow[] = []
  if (playedMv) arrows.push([playedMv.from as Arrow[0], playedMv.to as Arrow[1], isMistake ? 'rgb(200,80,80)' : 'rgb(90,140,220)'])
  if (bestMv) arrows.push([bestMv.from as Arrow[0], bestMv.to as Arrow[1], 'rgb(80,160,80)'])
  const data = moves.map((m) => ({ ply: m.ply, eval: m.evalCp, mistake: m.isPlayerMove && m.severity !== 'ok' }))
  const mistakeIdxs = moves.map((m, i) => (m.isPlayerMove && m.severity !== 'ok' ? i : -1)).filter((i) => i >= 0)
  const jumpPrevMistake = () => setPly((p) => [...mistakeIdxs].reverse().find((i) => i < p) ?? p)
  const jumpNextMistake = () => setPly((p) => mistakeIdxs.find((i) => i > p) ?? p)

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
      <span style={{ marginLeft: 10, fontWeight: 600, color: accuracyColor(g.accuracy) }}>Accuracy {g.accuracy}%</span>
      {g.url && <a style={{ marginLeft: 10 }} href={g.url} target="_blank" rel="noreferrer">open on chess.com ↗</a>}
      {moves.length === 0 ? (
        <p>No moves recorded for this game.</p>
      ) : (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
          <div style={{ width: 320 }}>
            {cur && (
              <Chessboard
                position={fenAfter(cur.fenBefore, cur.san)}
                boardOrientation={flipped ? (g.color === 'white' ? 'black' : 'white') : g.color}
                customArrows={arrows}
                arePiecesDraggable={false}
                boardWidth={320}
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button type="button" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={prev} disabled={idx === 0}>‹ prev</button>
                <button type="button" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={togglePlay} title="autoplay">{playing ? '⏸' : '▶'}</button>
                <button type="button" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={next} disabled={idx >= moves.length - 1}>next ›</button>
                <button type="button" style={{ flexShrink: 0 }} onClick={() => setFlipped((f) => !f)} title="flip board" aria-label="flip board">⇅</button>
                <button type="button" style={{ flexShrink: 0 }} onClick={toggleSound} title={soundOn ? 'mute move sounds' : 'enable move sounds'} aria-label="toggle move sounds">{soundOn ? '🔊' : '🔇'}</button>
              </div>
              <div style={{ fontSize: 13 }}>
                move {Math.ceil((cur?.ply ?? 0) / 2)} · {cur?.san} · {cur?.phase}
                {clock && <> · ⏱ {clock}</>}
                {timeTrouble && <span style={{ color: 'rgb(224,121,107)' }}> · time trouble</span>}
                {cur && <> · <a href={`https://www.chess.com/analysis?fen=${encodeURIComponent(cur.fenBefore)}`} target="_blank" rel="noreferrer">analyze ↗</a></>}
              </div>
              {mistakeIdxs.length > 0 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <button type="button" onClick={jumpPrevMistake} disabled={!mistakeIdxs.some((i) => i < idx)}>‹ mistake</button>
                  <button type="button" onClick={jumpNextMistake} disabled={!mistakeIdxs.some((i) => i > idx)}>mistake ›</button>
                  <span style={{ color: 'var(--muted)' }}>{mistakeIdxs.length} mistakes</span>
                </div>
              )}
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
            <Line
              type="monotone" dataKey="eval" stroke={COLORS.line} strokeWidth={2} isAnimationActive={false}
              dot={(p: { cx: number; cy: number; index: number; payload?: { mistake?: boolean } }) => (
                <circle key={p.index} cx={p.cx} cy={p.cy} r={p.payload?.mistake ? 4 : 0} fill="rgb(224,121,107)" stroke="none" />
              )}
            />
          </LineChart>
          <div style={{ width: 210, maxHeight: 340, overflowY: 'auto', fontSize: 13, lineHeight: 1.6 }}>
            {Array.from({ length: Math.ceil(moves.length / 2) }, (_, r) => {
              const wi = r * 2
              const bi = r * 2 + 1
              return (
                <div key={r} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ color: 'var(--muted)', width: 26, textAlign: 'right' }}>{r + 1}.</span>
                  <MoveSan m={moves[wi]} active={wi === idx} onClick={() => setPly(wi)} />
                  {bi < moves.length && <MoveSan m={moves[bi]} active={bi === idx} onClick={() => setPly(bi)} />}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
