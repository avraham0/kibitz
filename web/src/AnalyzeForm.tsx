import { useState, type FormEvent } from 'react'
import { sinceFromRange, RANGE_LABELS, type RangeKey } from './sinceFromRange.js'

export type FormParams = { user: string; last?: string; depth?: string; since?: string; variations?: boolean; timeControl?: string }

export function AnalyzeForm({ onSubmit, disabled }: { onSubmit: (p: FormParams) => void; disabled: boolean }) {
  const [user, setUser] = useState('avraham00')
  const [last, setLast] = useState('10')
  const [depth, setDepth] = useState('12')
  const [range, setRange] = useState<RangeKey>('1year')
  const [customSince, setCustomSince] = useState('')
  const [variations, setVariations] = useState(false)
  const [timeControl, setTimeControl] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!user.trim()) return
    const since = range === 'custom' ? (customSince || undefined) : sinceFromRange(range, new Date())
    onSubmit({ user: user.trim(), last: last || undefined, depth: depth || undefined, since, variations, timeControl: timeControl || undefined })
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
      <label>chess.com username<br /><input value={user} onChange={(e) => setUser(e.target.value)} placeholder="username" required /></label>
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
      <div style={{ flexBasis: '100%', fontSize: 12, color: 'var(--muted)' }}>
        Both apply: range sets the window, then <em>last N</em> keeps the most recent N within it. Clear <em>last N</em> to use date only.
      </div>
    </form>
  )
}
