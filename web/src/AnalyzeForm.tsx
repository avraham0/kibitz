import { useState, type FormEvent } from 'react'

export type FormParams = { user: string; last?: string; depth?: string; since?: string; variations?: boolean; timeControl?: string }

export function AnalyzeForm({ onSubmit, disabled }: { onSubmit: (p: FormParams) => void; disabled: boolean }) {
  const [user, setUser] = useState('')
  const [last, setLast] = useState('10')
  const [depth, setDepth] = useState('15')
  const [since, setSince] = useState('')
  const [variations, setVariations] = useState(false)
  const [timeControl, setTimeControl] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!user.trim()) return
    onSubmit({ user: user.trim(), last: last || undefined, depth: depth || undefined, since: since || undefined, variations, timeControl: timeControl || undefined })
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
      <label>chess.com username<br /><input value={user} onChange={(e) => setUser(e.target.value)} placeholder="username" required /></label>
      <label>last N<br /><input value={last} onChange={(e) => setLast(e.target.value)} style={{ width: 60 }} /></label>
      <label>depth<br /><input value={depth} onChange={(e) => setDepth(e.target.value)} style={{ width: 60 }} /></label>
      <label>since (YYYY-MM)<br /><input value={since} onChange={(e) => setSince(e.target.value)} style={{ width: 100 }} /></label>
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
    </form>
  )
}
