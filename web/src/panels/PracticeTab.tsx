import { useState, useEffect } from 'react'
import type { GameSummary, OpeningStat, SuggestionAction, CoachableType } from '../api-types.js'
import { TrainingTab } from './TrainingTab.js'
import { OpeningDrill } from './OpeningDrill.js'

type Mode = 'puzzles' | 'openings'

// Merged practice surface. Two modes — blunder puzzles (every mistake type, not just
// tactics) and opening drills — but the user normally arrives here via a coaching card,
// which picks the mode and the filter. `focus` is the routed SuggestionAction.
export function PracticeTab({ games, openings, focus }: {
  games: GameSummary[]
  openings: OpeningStat[]
  focus: SuggestionAction | null
}) {
  const [mode, setMode] = useState<Mode>(focus?.practice === 'opening' ? 'openings' : 'puzzles')
  const [typeFilter, setTypeFilter] = useState<CoachableType | undefined>(focus?.practice === 'tactics' ? focus.type : undefined)
  const [family, setFamily] = useState<string | undefined>(focus?.practice === 'opening' ? focus.family : undefined)

  // Re-target whenever a new coaching card routes in.
  useEffect(() => {
    if (!focus) return
    if (focus.practice === 'tactics') { setMode('puzzles'); setTypeFilter(focus.type) }
    else { setMode('openings'); setFamily(focus.family) }
  }, [focus])

  const tabStyle = (active: boolean) => ({
    padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 14,
    border: '1px solid var(--border)',
    background: active ? 'var(--accent, #4a7)' : 'var(--surface-2)',
    color: active ? '#fff' : 'var(--text)',
    fontWeight: active ? 600 : 400,
  })

  return (
    <section>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button type="button" style={tabStyle(mode === 'puzzles')} onClick={() => setMode('puzzles')}>Puzzles</button>
        <button type="button" style={tabStyle(mode === 'openings')} onClick={() => setMode('openings')}>Openings</button>
      </div>
      {mode === 'puzzles'
        ? <TrainingTab games={games} initialTypeFilter={typeFilter} />
        : <OpeningDrill openings={openings} games={games} initialFamily={family} />}
    </section>
  )
}
