import { useState, type FormEvent } from 'react'

export type FormParams = { user: string; last?: string; depth?: string; since?: string; variations?: boolean; timeControl?: string; result?: string; opening?: string }

export function AnalyzeForm({ onSubmit, disabled }: { onSubmit: (p: FormParams) => void; disabled: boolean }) {
  const [user, setUser] = useState('avraham00')
  const [last, setLast] = useState('50')
  const [variations, setVariations] = useState(false)
  const [timeControl, setTimeControl] = useState('')
  const [result, setResult] = useState('all')
  const [opening, setOpening] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!user.trim()) return
    onSubmit({ user: user.trim(), last: last || undefined, variations, timeControl: timeControl || undefined, result, opening: opening || undefined })
  }

  // Quick scan: shallow depth + a cap on games, for a fast pass.
  function quickScan() {
    if (!user.trim()) return
    setLast('50')
    onSubmit({ user: user.trim(), last: '50', depth: '8', variations, timeControl: timeControl || undefined, result, opening: opening || undefined })
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
      <label>chess.com username<br /><input
        value={user} onChange={(e) => setUser(e.target.value)} placeholder="username" required
        name="chesscomHandle" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        data-1p-ignore="true" data-lpignore="true" data-form-type="other"
      /></label>
      <label>last N<br /><input value={last} onChange={(e) => setLast(e.target.value)} style={{ width: 60 }} /></label>
      <label>result<br />
        <select value={result} onChange={(e) => setResult(e.target.value)}>
          <option value="all">all</option>
          <option value="loss">losses</option>
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
      <label>opening<br /><input
        value={opening} onChange={(e) => setOpening(e.target.value)}
        placeholder="e.g. Italian" style={{ width: 110 }}
        autoCorrect="off" autoCapitalize="off" spellCheck={false}
      /></label>
      <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input type="checkbox" checked={variations} onChange={(e) => setVariations(e.target.checked)} /> split variations
      </label>
      <button type="submit" disabled={disabled || !user.trim()} style={{ marginLeft: 'auto' }}>Analyze</button>
      <button type="button" onClick={quickScan} disabled={disabled || !user.trim()} title="last 50 games — a fast, shallow pass">Quick scan</button>
      <div style={{ flexBasis: '100%', fontSize: 12, color: 'var(--muted)' }}>
        <em>last N</em> keeps the most recent N games. <strong>Quick scan</strong> = last 50, a fast shallow pass.
      </div>
    </form>
  )
}
