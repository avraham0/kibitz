import { useState, type FormEvent, type CSSProperties } from 'react'
import { sinceFromRange, RANGE_LABELS, type RangeKey } from './sinceFromRange.js'

export type FormParams = { user: string; last?: string; depth?: string; since?: string; variations?: boolean; timeControl?: string; result?: string; opening?: string }

const linkBtn: CSSProperties = {
  background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
  fontSize: 13, padding: 0, textDecoration: 'underline', textUnderlineOffset: 2,
}

export function AnalyzeForm({ onSubmit, disabled, hero = false }: { onSubmit: (p: FormParams) => void; disabled: boolean; hero?: boolean }) {
  const [user, setUser] = useState('avraham00')
  const [last, setLast] = useState('100')
  const [timeControl, setTimeControl] = useState('')
  const [result, setResult] = useState('all')
  const [opening, setOpening] = useState('')
  const [range, setRange] = useState<RangeKey>('1year')
  const [customSince, setCustomSince] = useState('')
  const [showOptions, setShowOptions] = useState(false)

  function sinceValue(): string | undefined {
    return range === 'custom' ? (customSince || undefined) : sinceFromRange(range, new Date())
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!user.trim()) return
    onSubmit({ user: user.trim(), last: last || undefined, since: sinceValue(), timeControl: timeControl || undefined, result, opening: opening || undefined })
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', alignItems: hero ? 'flex-start' : 'stretch' }}>
      <div style={{ display: 'flex', gap: 8, width: hero ? 'min(520px, 100%)' : '100%' }}>
        <input
          value={user} onChange={(e) => setUser(e.target.value)} placeholder="chess.com username" required
          name="chesscomHandle" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          data-1p-ignore="true" data-lpignore="true" data-form-type="other"
          style={{ flex: 1, fontSize: hero ? 16 : 14, padding: hero ? '10px 12px' : undefined }}
        />
        <button
          type="submit"
          disabled={disabled || !user.trim()}
          style={{
            background: '#3fa66b', color: '#fff', border: 'none', borderRadius: 6,
            fontWeight: 700, cursor: disabled || !user.trim() ? 'default' : 'pointer',
            opacity: disabled || !user.trim() ? 0.55 : 1,
            padding: hero ? '10px 18px' : '8px 14px', fontSize: hero ? 15 : 14, whiteSpace: 'nowrap',
          }}
        >
          {hero ? 'Analyze my games' : 'Analyze'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <button type="button" style={linkBtn} onClick={() => setShowOptions((v) => !v)} aria-expanded={showOptions}>Options {showOptions ? '▴' : '▾'}</button>
      </div>

      {showOptions && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', justifyContent: 'flex-start' }}>
          <label>last N<br /><input value={last} onChange={(e) => setLast(e.target.value)} style={{ width: 60 }} /></label>
          <label>range<br />
            <select value={range} onChange={(e) => setRange(e.target.value as RangeKey)}>
              {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
                <option key={k} value={k}>{RANGE_LABELS[k]}</option>
              ))}
            </select>
          </label>
          {range === 'custom' && (
            <label>since (YYYY-MM)<br /><input value={customSince} onChange={(e) => setCustomSince(e.target.value)} placeholder="2025-01" style={{ width: 90 }} /></label>
          )}
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
        </div>
      )}
    </form>
  )
}
