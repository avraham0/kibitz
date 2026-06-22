import type { GameSummary } from '../api-types.js'
import { OpeningNovelty } from './OpeningNovelty.js'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  ScatterChart, Scatter, Cell,
} from 'recharts'
import { AXIS, GRID, TOOLTIP } from './chartTheme.js'
import { accuracyColor } from '../accuracyColor.js'

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', minWidth: 110 }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: color ?? 'var(--accent)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

// Accuracy when winning/drawing/losing
function ScorePerformance({ games }: { games: GameSummary[] }) {
  const byResult = { win: [] as number[], draw: [] as number[], loss: [] as number[] }
  for (const g of games) byResult[g.result].push(g.accuracy)
  const data = [
    { result: 'Win', accuracy: Math.round(avg(byResult.win)), n: byResult.win.length },
    { result: 'Draw', accuracy: Math.round(avg(byResult.draw)), n: byResult.draw.length },
    { result: 'Loss', accuracy: Math.round(avg(byResult.loss)), n: byResult.loss.length },
  ].filter((d) => d.n > 0)
  if (data.length < 2) return null
  return (
    <section>
      <h2>Accuracy by result</h2>
      <p style={{ marginTop: 0, fontSize: 12, color: 'var(--muted)' }}>How accurately you play in won, drawn, and lost games.</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {data.map((d) => (
          <StatCard key={d.result} label={d.result} value={`${d.accuracy}%`} sub={`${d.n} games`} color={accuracyColor(d.accuracy)} />
        ))}
      </div>
      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={48}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="result" tick={AXIS.tick} stroke={AXIS.stroke} />
            <YAxis domain={[0, 100]} tick={AXIS.tick} stroke={AXIS.stroke} />
            <Tooltip {...TOOLTIP} formatter={((v: number) => [`${v}%`, 'Accuracy']) as any} />
            <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.result} fill={d.result === 'Win' ? '#7bc47f' : d.result === 'Draw' ? '#6db3f2' : '#e0796b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

// Inaccuracy:mistake:blunder severity profile
function SeverityProfile({ games }: { games: GameSummary[] }) {
  let inaccuracies = 0, mistakes = 0, blunders = 0, total = 0
  for (const g of games) {
    for (const m of g.moves) {
      if (!m.isPlayerMove) continue
      total++
      if (m.severity === 'inaccuracy') inaccuracies++
      else if (m.severity === 'mistake') mistakes++
      else if (m.severity === 'blunder') blunders++
    }
  }
  if (total === 0) return null
  const pct = (n: number) => total > 0 ? ((n / total) * 100).toFixed(1) : '0'
  const data = [
    { name: 'Inaccuracy', count: inaccuracies, pct: Number(pct(inaccuracies)), color: '#e0b15a' },
    { name: 'Mistake', count: mistakes, pct: Number(pct(mistakes)), color: '#e0946b' },
    { name: 'Blunder', count: blunders, pct: Number(pct(blunders)), color: '#e0796b' },
  ]
  const gamesCount = games.length
  return (
    <section>
      <h2>Error severity profile</h2>
      <p style={{ marginTop: 0, fontSize: 12, color: 'var(--muted)' }}>
        Share of your moves that are inaccuracies (−30cp), mistakes (−100cp), or blunders (−300cp). Lower is better.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {data.map((d) => (
          <StatCard key={d.name} label={d.name} value={`${d.pct}%`} sub={`${d.count} moves · ${(d.count / gamesCount).toFixed(1)}/game`} color={d.color} />
        ))}
      </div>
      <div style={{ width: '100%', height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={48}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="name" tick={AXIS.tick} stroke={AXIS.stroke} />
            <YAxis tick={AXIS.tick} stroke={AXIS.stroke} unit="%" />
            <Tooltip {...TOOLTIP} formatter={((v: number) => [`${v}%`, '% of moves']) as any} />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

// Clock time on accurate vs inaccurate moves
function ClockEfficiency({ games }: { games: GameSummary[] }) {
  const accurateTimes: number[] = [], inaccurateTimes: number[] = []
  for (const g of games) {
    for (const m of g.moves) {
      if (!m.isPlayerMove || m.clockSeconds == null) continue
      if (m.severity === 'ok') accurateTimes.push(m.clockSeconds)
      else inaccurateTimes.push(m.clockSeconds)
    }
  }
  if (accurateTimes.length < 10 || inaccurateTimes.length < 5) return null
  const avgAccurate = avg(accurateTimes)
  const avgInaccurate = avg(inaccurateTimes)
  const spendMore = avgInaccurate > avgAccurate
  return (
    <section>
      <h2>Clock efficiency</h2>
      <p style={{ marginTop: 0, fontSize: 12, color: 'var(--muted)' }}>
        Average time spent on moves you got right vs moves you got wrong.
        {spendMore
          ? ' You spend more time on bad moves — suggests calculation errors under pressure.'
          : ' You spend less time on bad moves — suggests impulsive decisions.'}
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard label="Accurate moves" value={`${avgAccurate.toFixed(0)}s`} sub={`${accurateTimes.length} moves`} color="#7bc47f" />
        <StatCard label="Error moves" value={`${avgInaccurate.toFixed(0)}s`} sub={`${inaccurateTimes.length} moves`} color="#e0796b" />
        <StatCard
          label={spendMore ? 'spent more on errors' : 'spent less on errors'}
          value={`${Math.abs(avgInaccurate - avgAccurate).toFixed(0)}s`}
          sub="difference"
          color={spendMore ? '#e0b15a' : '#e0796b'}
        />
      </div>
    </section>
  )
}

// Per-game endgame accuracy scatter
function EndgameAccuracy({ games }: { games: GameSummary[] }) {
  const pts = games
    .filter((g) => g.accuracyByPhase.endgame > 0)
    .map((g, i) => ({ i, endgame: g.accuracyByPhase.endgame, result: g.result, date: g.playedAt.slice(0, 10) }))
  if (pts.length < 5) return null
  const mean = Math.round(avg(pts.map((p) => p.endgame)))
  return (
    <section>
      <h2>Endgame accuracy</h2>
      <p style={{ marginTop: 0, fontSize: 12, color: 'var(--muted)' }}>
        Accuracy in endgame phase per game. Average: <strong style={{ color: accuracyColor(mean) }}>{mean}%</strong>.
        Green = win, blue = draw, red = loss.
      </p>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid stroke={GRID} />
            <XAxis dataKey="i" name="Game" tick={AXIS.tick} stroke={AXIS.stroke} label={{ value: 'game #', position: 'insideBottom', offset: -2, style: { fontSize: 11, fill: '#6b7280' } }} />
            <YAxis dataKey="endgame" name="Accuracy" domain={[0, 100]} tick={AXIS.tick} stroke={AXIS.stroke} unit="%" />
            <Tooltip {...TOOLTIP} formatter={((v: number) => [`${v}%`, 'Endgame accuracy']) as any} labelFormatter={((_: any, p: any[]) => p[0]?.payload?.date ?? '') as any} />
            <Scatter data={pts}>
              {pts.map((p, idx) => (
                <Cell key={idx} fill={p.result === 'win' ? '#7bc47f' : p.result === 'draw' ? '#6db3f2' : '#e0796b'} fillOpacity={0.8} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

type DriftEvent = {
  gameId: string; date: string; url: string
  startPly: number; moves: string[]; totalLoss: number; phase: string
}

function findDrifts(games: GameSummary[]): DriftEvent[] {
  const drifts: DriftEvent[] = []
  for (const g of games) {
    const player = g.moves.filter((m) => m.isPlayerMove)
    let run: typeof player = []
    const flush = () => {
      if (run.length >= 3) {
        const total = run.reduce((s, m) => s + m.cpLoss, 0)
        if (total >= 100) {
          drifts.push({
            gameId: g.gameId, date: g.playedAt.slice(0, 10), url: g.url,
            startPly: run[0].ply, moves: run.map((m) => m.san),
            totalLoss: total, phase: run[0].phase,
          })
        }
      }
      run = []
    }
    for (const m of player) {
      if (m.cpLoss >= 15 && m.severity !== 'blunder') {
        run.push(m)
      } else {
        flush()
      }
    }
    flush()
  }
  return drifts.sort((a, b) => b.totalLoss - a.totalLoss).slice(0, 20)
}

function PropylaxisMisses({ games, onOpenGame }: { games: GameSummary[]; onOpenGame?: (id: string, ply?: number) => void }) {
  const drifts = findDrifts(games)
  if (drifts.length === 0) return null
  const avgLoss = Math.round(avg(drifts.map((d) => d.totalLoss)))
  return (
    <section>
      <h2>Prophylaxis misses</h2>
      <p style={{ marginTop: 0, fontSize: 12, color: 'var(--muted)' }}>
        Sequences of 3+ consecutive small errors (no single blunder) that cumulatively cost ≥100cp.
        These are positional drifts — missed prophylaxis or slow plan execution.
        Avg loss per drift: <strong style={{ color: '#e0b15a' }}>−{avgLoss}cp</strong> · {drifts.length} events found.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {drifts.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, padding: '6px 10px', background: 'var(--surface-2)', borderRadius: 6, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--muted)', minWidth: 80 }}>{d.date}</span>
            <span style={{ color: '#e0b15a', fontWeight: 600, minWidth: 60 }}>−{d.totalLoss}cp</span>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>{d.moves.length} moves</span>
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.moves.join(' ')}</span>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>{d.phase}</span>
            {onOpenGame && (
              <button type="button" onClick={() => onOpenGame(d.gameId, d.startPly - 1)}
                style={{ fontSize: 12, padding: '0 6px', marginLeft: 'auto' }}>
                review
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export function MasteryTab({ games, onOpenGame }: { games: GameSummary[]; onOpenGame?: (id: string, ply?: number) => void }) {
  if (games.length === 0) return null
  return (
    <div>
      <ScorePerformance games={games} />
      <SeverityProfile games={games} />
      <ClockEfficiency games={games} />
      <OpeningNovelty games={games} onOpenGame={onOpenGame} />
      <PropylaxisMisses games={games} onOpenGame={onOpenGame} />
      <EndgameAccuracy games={games} />
    </div>
  )
}
