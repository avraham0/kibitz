import { useState, useEffect, useCallback, useRef } from 'react'
import { Chess } from 'chess.js'
import { ThemedBoard as Chessboard } from '../ThemedBoard.js'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid, ResponsiveContainer } from 'recharts'
import type { Arrow } from '../ThemedBoard.js'
import type { GameSummary, GameMove } from '../api-types.js'
import { sanToSquares } from '../sanToSquares.js'
import { AXIS, GRID, TOOLTIP, COLORS } from './chartTheme.js'
import { accuracyColor } from '../accuracyColor.js'
import { soundForSan, playMoveSound, SOUND_KEY } from '../sound.js'
import { explainBlunder } from '../explainBlunder.js'
import { ExternalLinkIcon } from './ExternalLinkIcon.js'
import { EvalBar } from './EvalBar.js'
import { useStockfishEval } from '../useStockfish.js'
import { useBoardSize } from '../useBoardSize.js'

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
export function GameReview({ games, focus }: { games: GameSummary[]; focus?: { id: string; seq: number; ply?: number } | null }) {
  const [gi, setGi] = useState(() => Math.max(0, games.length - 1))
  const [ply, setPly] = useState(0)
  // Free-play exploration forked from the current position; null = following the game.
  const [explore, setExplore] = useState<{ fen: string; n: number } | null>(null)
  // Any navigation returns to the game line.
  useEffect(() => { setExplore(null) }, [ply, gi])
  // While exploring an off-game line, compute the eval live with the engine
  // (no stored eval exists for those positions); null otherwise (use stored evals).
  const exploreEval = useStockfishEval(explore ? explore.fen : null)
  const [boardRef, boardSize] = useBoardSize(320, 24) // reserve for eval bar + gap

  // Jump to a game (and optionally a specific move) requested from elsewhere.
  useEffect(() => {
    if (!focus) return
    const i = games.findIndex((g) => g.gameId === focus.id)
    if (i >= 0) { suppressSoundRef.current = true; setGi(i); setPly(focus.ply ?? 0) }
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
  const suppressSoundRef = useRef(false)

  const [flipped, setFlipped] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [pgnCopied, setPgnCopied] = useState(false)
  const [tpHover, setTpHover] = useState(false)

  // Autoplay: advance one ply on a timer while playing; stop at the last move.
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setPly((p) => (p >= maxPly ? p : p + 1)), 900)
    return () => clearInterval(id)
  }, [playing, maxPly])
  useEffect(() => {
    if (playing && Math.min(ply, maxPly) >= maxPly) setPlaying(false)
  }, [ply, maxPly, playing])

  function buildPgn(game: typeof g): string {
    if (!game) return ''
    const date = game.playedAt.slice(0, 10).replace(/-/g, '.')
    const result = game.color === 'white'
      ? (game.result === 'win' ? '1-0' : game.result === 'loss' ? '0-1' : '1/2-1/2')
      : (game.result === 'win' ? '0-1' : game.result === 'loss' ? '1-0' : '1/2-1/2')
    const headers = [
      `[Event "Chess.com Live Game"]`,
      `[Site "${game.url}"]`,
      `[Date "${date}"]`,
      `[White "?"]`,
      `[Black "?"]`,
      `[Result "${result}"]`,
      `[Opening "${game.openingName}"]`,
    ].join('\n')
    let movetext = ''
    for (const m of game.moves) {
      const num = Math.ceil(m.ply / 2)
      if (m.ply % 2 === 1) movetext += `${num}. ${m.san} `
      else movetext += `${m.san} `
    }
    return `${headers}\n\n${movetext.trim()} ${result}`
  }

  function exportToLichess() {
    if (!g) return
    const pgn = buildPgn(g)
    navigator.clipboard.writeText(pgn).catch(() => {})
    window.open('https://lichess.org/paste', '_blank', 'noreferrer')
    setPgnCopied(true)
    setTimeout(() => setPgnCopied(false), 3000)
  }

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
    if (suppressSoundRef.current) { suppressSoundRef.current = false; return }
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
  // Plot the eval AFTER each move (= the next position's "before" eval) so the
  // highlighted point lines up with the board, which shows the move as played.
  const data = moves.map((m, i) => ({ ply: m.ply, eval: moves[i + 1] ? moves[i + 1].evalCp : m.evalCp, mistake: m.isPlayerMove && m.severity !== 'ok' }))
  const mistakeIdxs = moves.map((m, i) => (m.isPlayerMove && m.severity !== 'ok' ? i : -1)).filter((i) => i >= 0)
  const jumpPrevMistake = () => setPly((p) => [...mistakeIdxs].reverse().find((i) => i < p) ?? p)
  const jumpNextMistake = () => setPly((p) => mistakeIdxs.find((i) => i > p) ?? p)

  function pick(i: number) { setGi(i); setPly(0) }

  // Drag a piece to explore a line from the shown position. Returns false (snap back)
  // for illegal moves. Navigation clears the exploration (see the [ply, gi] effect).
  const gamePos = cur ? fenAfter(cur.fenBefore, cur.san) : ''
  // Eval of the shown position (after the current move) — white-POV, matching the chart.
  const shownEval = cur ? (moves[idx + 1]?.evalCp ?? cur.evalCp) : 0
  const boardOrientation = flipped ? (g.color === 'white' ? 'black' : 'white') : g.color
  function onDrop(from: string, to: string): boolean {
    try {
      const c = new Chess(explore?.fen ?? gamePos)
      const mv = c.move({ from, to, promotion: 'q' })
      if (!mv) return false
      setExplore((e) => ({ fen: c.fen(), n: (e?.n ?? 0) + 1 }))
      if (soundOnRef.current) playMoveSound(soundForSan(mv.san))
      return true
    } catch {
      return false
    }
  }

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Game review</h2>
        <select value={gi} onChange={(e) => pick(Number(e.target.value))} style={{ fontSize: 13, maxWidth: 'min(280px, 100%)' }}>
          {[...games].reverse().map((gg, ri) => {
            const i = games.length - 1 - ri
            return (
              <option key={i} value={i}>
                {gg.wasWinning && gg.result !== 'win' ? '⚑ ' : ''}{gg.playedAt.slice(0, 10)} · {gg.color} · {gg.result} · {gg.chesscomAccuracy != null ? `${Math.round(gg.chesscomAccuracy)}%` : `${gg.accuracy}%`} · {gg.openingName}
              </option>
            )
          })}
        </select>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'center', marginTop: 6 }}>
        <span style={{ fontWeight: 600, color: accuracyColor(g.accuracy) }}>Kibitz {g.accuracy}%</span>
        {g.chesscomAccuracy != null && (
          <span style={{ fontWeight: 600, color: accuracyColor(g.chesscomAccuracy) }}>chess.com {Math.round(g.chesscomAccuracy)}%</span>
        )}
        {g.wasWinning && g.result !== 'win' && (
          <span style={{ color: 'rgb(224,121,107)', fontWeight: 600 }}>⚑ missed win</span>
        )}
        {g.turningPointIdx != null && (
          <button
            type="button"
            onClick={() => setPly(g.turningPointIdx!)}
            onMouseEnter={() => setTpHover(true)}
            onMouseLeave={() => setTpHover(false)}
            style={{ fontWeight: 700, color: tpHover ? '#0b0e13' : 'rgb(224,121,107)', border: '1px solid rgb(224,121,107)', background: tpHover ? 'rgb(224,121,107)' : 'transparent', borderRadius: 4, padding: '1px 8px', cursor: 'pointer', fontSize: 13, transition: 'background 0.15s, color 0.15s' }}
          >
            ⚠ turning point
          </button>
        )}
      </div>
      <div style={{ marginTop: 4, fontSize: 13, color: 'var(--muted)', display: 'flex', gap: 12 }}>
        {(['opening', 'middlegame', 'endgame'] as const).map((p) => (
          <span key={p}>
            {p.slice(0, 3).toUpperCase()}{' '}
            <span style={{ color: accuracyColor(g.accuracyByPhase[p]), fontWeight: 600 }}>{g.accuracyByPhase[p]}%</span>
          </span>
        ))}
      </div>
      <div style={{ fontSize: 13, marginTop: 6, visibility: isMistake && cur ? 'visible' : 'hidden' }}>
        <div style={{ color: 'rgb(224,121,107)' }}>{cur && isMistake ? `${cur.severity} −${cur.cpLoss}cp · best ${cur.bestSan}` : ' '}</div>
        <div style={{ color: 'var(--muted)' }}>{cur && isMistake ? explainBlunder(cur) : ' '}</div>
      </div>
      {moves.length === 0 ? (
        <p>No moves recorded for this game.</p>
      ) : (
        <div ref={boardRef} style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              {cur && <EvalBar cp={explore ? exploreEval : shownEval} height={boardSize} orientation={boardOrientation} />}
              {cur && (
                <Chessboard
                  position={explore?.fen ?? gamePos}
                  boardOrientation={boardOrientation}
                  customArrows={explore ? [] : arrows}
                  arePiecesDraggable
                  onPieceDrop={(s, t) => onDrop(s, t)}
                  boardWidth={boardSize}
                />
              )}
            </div>
            {explore && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, fontSize: 13 }}>
                <span style={{ color: 'var(--amber, #e0b15a)' }}>Exploring — {explore.n} move{explore.n === 1 ? '' : 's'} in</span>
                <button type="button" onClick={() => setExplore(null)}>back to game</button>
              </div>
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
                {cur?.san} · {cur?.phase}
                {clock && <> · ⏱ {clock}</>}
                {timeTrouble && <span style={{ color: 'rgb(224,121,107)' }}> · time trouble</span>}
              </div>
              {mistakeIdxs.length > 0 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <button type="button" onClick={jumpPrevMistake} disabled={!mistakeIdxs.some((i) => i < idx)}>‹ mistake</button>
                  <button type="button" onClick={jumpNextMistake} disabled={!mistakeIdxs.some((i) => i > idx)}>mistake ›</button>
                  <span style={{ color: 'var(--muted)' }}>{mistakeIdxs.length} mistakes</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {g.url && <a href={g.url} target="_blank" rel="noreferrer" title="Open game on chess.com" aria-label="Open game on chess.com" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--muted)' }}><ExternalLinkIcon /></a>}
                <button
                  type="button"
                  onClick={exportToLichess}
                  title="Copy PGN and open Lichess import"
                  style={{ fontSize: 13, padding: '1px 7px' }}
                >
                  {pgnCopied ? '✓ PGN copied' : '⬇ Lichess'}
                </button>
              </div>
            </div>
          </div>
          <div style={{ flex: '1 1 300px', minWidth: 0, maxWidth: 420, height: 240 }}>
          <ResponsiveContainer>
          <LineChart
            data={data}
            style={{ cursor: 'pointer' }}
            onClick={(s: any) => {
              if (s && typeof s.activeTooltipIndex === 'number') setPly(s.activeTooltipIndex)
            }}
          >
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="ply" tick={AXIS.tick} stroke={AXIS.stroke} />
            <YAxis domain={[-1500, 1500]} tick={AXIS.tick} stroke={AXIS.stroke} />
            <Tooltip {...TOOLTIP} />
            <ReferenceLine y={0} stroke="#4a525e" />
            {g.turningPointIdx != null && moves[g.turningPointIdx] && (
              <ReferenceLine x={moves[g.turningPointIdx].ply} stroke="rgb(224,121,107)" strokeDasharray="4 4" />
            )}
            {cur && <ReferenceLine x={cur.ply} stroke={COLORS.accent} />}
            <Line
              type="monotone" dataKey="eval" stroke={COLORS.line} strokeWidth={2} isAnimationActive={false}
              dot={((p: { cx: number; cy: number; index: number; payload?: { mistake?: boolean } }) => (
                <circle key={p.index} cx={p.cx} cy={p.cy} r={p.payload?.mistake ? 4 : 0} fill="rgb(224,121,107)" stroke="none" />
              )) as any}
            />
          </LineChart>
          </ResponsiveContainer>
          </div>
          {/* Stretch to the row's full height (board/graph bottom) and scroll inside.
              The inner div is absolutely positioned so the list's length doesn't drive
              the row taller — it fills whatever height the board column sets. */}
          <div style={{ width: 210, alignSelf: 'stretch', position: 'relative', minHeight: 240 }}>
            <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', fontSize: 13, lineHeight: 1.6 }}>
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
        </div>
      )}
    </section>
  )
}
