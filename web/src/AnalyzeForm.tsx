import { useState, type FormEvent, type CSSProperties } from 'react'
import { sinceFromRange, RANGE_LABELS, type RangeKey } from './sinceFromRange.js'

export type FormParams = { user: string; source?: 'chesscom' | 'lichess'; last?: string; depth?: string; since?: string; range?: string; variations?: boolean; timeControl?: string; result?: string; opening?: string }

const linkBtn: CSSProperties = {
  background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
  fontSize: 13, padding: 0, textDecoration: 'underline', textUnderlineOffset: 2,
}

export function AnalyzeForm({ onSubmit, disabled, hero = false, initial }: { onSubmit: (p: FormParams) => void; disabled: boolean; hero?: boolean; initial?: FormParams }) {
  // Seed from the last-used values so the form keeps your source/username/etc. after
  // results load (the hero and results-view forms are separate instances).
  const [user, setUser] = useState(initial?.user ?? '')
  const [source, setSource] = useState<'chesscom' | 'lichess'>(initial?.source ?? 'chesscom')
  const [last, setLast] = useState(initial?.last ?? '100')
  const [timeControl, setTimeControl] = useState(initial?.timeControl ?? '')
  const [result, setResult] = useState(initial?.result ?? 'all')
  const [opening, setOpening] = useState(initial?.opening ?? '')
  const [range, setRange] = useState<RangeKey>((initial?.range as RangeKey) ?? '1year')
  const [customSince, setCustomSince] = useState(initial?.range === 'custom' ? (initial?.since ?? '') : '')
  const [showOptions, setShowOptions] = useState(false)

  function sinceValue(): string | undefined {
    return range === 'custom' ? (customSince || undefined) : sinceFromRange(range, new Date())
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!user.trim()) return
    onSubmit({ user: user.trim(), source, last: last || undefined, since: sinceValue(), range, timeControl: timeControl || undefined, result, opening: opening || undefined })
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', alignItems: hero ? 'flex-start' : 'stretch' }}>
      <div style={{ display: 'flex', gap: 8, width: hero ? 'min(560px, 100%)' : '100%', flexWrap: 'wrap' }}>
        <select value={source} onChange={(e) => setSource(e.target.value as 'chesscom' | 'lichess')} style={{ fontSize: hero ? 15 : 14 }} title="Game source" aria-label="Game source">
          <option value="chesscom">chess.com</option>
          <option value="lichess">lichess</option>
        </select>
        <input
          value={user} onChange={(e) => setUser(e.target.value)} placeholder={source === 'lichess' ? 'lichess username' : 'chess.com username'} required
          name="chesscomHandle" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          data-1p-ignore="true" data-lpignore="true" data-form-type="other"
          style={{ flex: 1, minWidth: 0, fontSize: hero ? 16 : 14, padding: hero ? '10px 12px' : undefined }}
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
