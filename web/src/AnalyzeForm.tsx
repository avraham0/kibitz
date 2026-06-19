import { useState, type FormEvent } from 'react'
import { sinceFromRange, RANGE_LABELS, type RangeKey } from './sinceFromRange.js'

export type FormParams = { user: string; last?: string; depth?: string; since?: string; variations?: boolean; timeControl?: string; result?: string }

export function AnalyzeForm({ onSubmit, disabled }: { onSubmit: (p: FormParams) => void; disabled: boolean }) {
  const [user, setUser] = useState('avraham00')
  const [last, setLast] = useState('50')
  const [depth, setDepth] = useState('18')
  const [range, setRange] = useState<RangeKey>('1year')
  const [customSince, setCustomSince] = useState('')
  const [variations, setVariations] = useState(false)
  const [timeControl, setTimeControl] = useState('')
  const [result, setResult] = useState('loss') // default to losses — most to learn from

  function sinceValue() {
    return range === 'custom' ? (customSince || undefined) : sinceFromRange(range, new Date())
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!user.trim()) return
    onSubmit({ user: user.trim(), last: last || undefined, depth: depth || undefined, since: sinceValue(), variations, timeControl: timeControl || undefined, result })
  }

  // Quick scan: shallow depth + a cap on games, for a fast pass over a big range.
  function quickScan() {
    if (!user.trim()) return
    setLast('50'); setDepth('8') // reflect the preset in the fields
    onSubmit({ user: user.trim(), last: '50', depth: '8', since: sinceValue(), variations, timeControl: timeControl || undefined, result })
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
      <label>chess.com username<br /><input
        value={user} onChange={(e) => setUser(e.target.value)} placeholder="username" required
        name="chesscomHandle" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        data-1p-ignore="true" data-lpignore="true" data-form-type="other"
      /></label>
      <label>last N<br /><input value={last} onChange={(e) => setLast(e.target.value)} style={{ width: 60 }} /></label>
      <label>depth<br /><input value={depth} onChange={(e) => setDepth(e.target.value)} style={{ width: 60 }} /></label>
      <label>range<br />
        <select value={range} onChange={(e) => setRange(e.target.value as RangeKey)}>
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
            <option key={k} value={k}>{RANGE_LABELS[k]}</option>
          ))}
        </select>
      </label>
      {range === 'custom' && (
        <label>since (YYYY-MM)<br /><input value={customSince} onChange={(e) => setCustomSince(e.target.value)} placeholder="2025-01" style={{ width: 100 }} /></label>
      )}
      <label>result<br />
        <select value={result} onChange={(e) => setResult(e.target.value)}>
          <option value="loss">losses</option>
          <option value="all">all</option>
          <option value="win">wins</option>
          <option value="draw">draws</option>
        </select>
      </label>
      <label>time control<br />
        <select value={timeControl} onChange={(e) => setTimeControl(e.target.value)}>
          <option value="">any</option>
          <option value="bullet">bullet</option>
          <option value="blitz">blitz</option>
          <option value="rapid">rapid</option>
          <option value="daily">daily</option>
        </select>
      </label>
      <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input type="checkbox" checked={variations} onChange={(e) => setVariations(e.target.checked)} /> split variations
      </label>
      <button type="submit" disabled={disabled || !user.trim()}>Analyze</button>
      <button type="button" onClick={quickScan} disabled={disabled || !user.trim()} title="depth 8 · last 50 games — a fast pass">Quick scan</button>
      <div style={{ flexBasis: '100%', fontSize: 12, color: 'var(--muted)' }}>
        Both apply: range sets the window, then <em>last N</em> keeps the most recent N within it. Clear <em>last N</em> to use date only.
        {' '}<strong>Quick scan</strong> = depth 8 · last 50, for a fast look over a big range.
      </div>
    </form>
  )
}
