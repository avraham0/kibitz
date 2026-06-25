import { useState, useMemo } from 'react'
import type { AnalyzeResult, SuggestionAction } from './api-types.js'
import { SummaryCard } from './panels/SummaryCard.js'
import { Splits } from './panels/Splits.js'
import { OpeningsTable } from './panels/OpeningsTable.js'
import { BlunderList } from './panels/BlunderList.js'
import { CoachingCards } from './panels/CoachingCards.js'
import { RecurringMistakes } from './panels/RecurringMistakes.js'
import { MistakeTypesChart } from './panels/MistakeTypesChart.js'
import { PhaseChart } from './panels/PhaseChart.js'
import { TimePressureChart } from './panels/TimePressureChart.js'
import { GameReview } from './panels/GameReview.js'
import { ProgressChart } from './panels/ProgressChart.js'
import { HangFrequency } from './panels/HangFrequency.js'
import { MoveQualityChart } from './panels/MoveQualityChart.js'
import { RatingChart } from './panels/RatingChart.js'
import { OpeningRecommendations } from './panels/OpeningRecommendations.js'
import { ClockAccuracyChart } from './panels/ClockAccuracyChart.js'
import { PracticeTab } from './panels/PracticeTab.js'
// Mastery tab hidden for now — keep the import/code for easy re-enable.
// import { MasteryTab } from './panels/MasteryTab.js'
import { recomputeStats } from './recomputeStats.js'
import { coach } from './coach.js'

type Tab = 'overview' | 'blunders' | 'practice' | 'stats' | 'review' | 'mastery'

export function Dashboard({ result }: { result: AnalyzeResult }) {
  const { stats, suggestions, games } = result
  const [tab, setTab] = useState<Tab>('overview')
  const [tc, setTc] = useState('all')
  const tcs = Array.from(new Set(games.map((g) => g.timeControl).filter(Boolean) as string[])).sort()
  const filteredGames = tc === 'all' ? games : games.filter((g) => g.timeControl === tc)
  const filteredStats = useMemo(() => tc === 'all' ? stats : recomputeStats(filteredGames), [filteredGames, tc, stats])
  const filteredSuggestions = useMemo(() => tc === 'all' ? suggestions : coach(filteredStats), [filteredStats, tc, suggestions])

  const [focus, setFocus] = useState<{ id: string; seq: number; ply?: number } | null>(null)
  function openGame(id: string, ply?: number) {
    setFocus((f) => ({ id, ply, seq: (f?.seq ?? 0) + 1 }))
    setTab('review')
  }
  // Routed from a coaching card's "Practice" button — picks the practice mode + filter.
  const [practiceFocus, setPracticeFocus] = useState<(SuggestionAction & { seq: number }) | null>(null)
  function startPractice(action: SuggestionAction) {
    setPracticeFocus((f) => ({ ...action, seq: (f?.seq ?? 0) + 1 }))
    setTab('practice')
  }
  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'blunders', label: 'Blunders' },
    { id: 'practice', label: 'Practice' },
    { id: 'review', label: 'Review' },
    { id: 'stats', label: 'Stats' },
    // { id: 'mastery', label: 'Mastery' },
  ]
  return (
    <div>
      <div className="tabs" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {tabs.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
        {tcs.length > 1 && (
          <select value={tc} onChange={(e) => setTc(e.target.value)} style={{ marginLeft: 'auto', fontSize: 13 }}>
            <option value="all">all time controls</option>
            {tcs.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {tab === 'overview' && (
        <>
          <div style={{ display: 'flex', gap: '0 24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 700px', minWidth: 0 }}><SummaryCard stats={filteredStats} games={filteredGames} /></div>
            <HangFrequency games={filteredGames} onPractice={startPractice} />
          </div>
          <CoachingCards suggestions={filteredSuggestions} onPractice={startPractice} />
          <RecurringMistakes games={filteredGames} onPractice={startPractice} />
          <OpeningRecommendations stats={filteredStats} />
          <OpeningsTable openings={filteredStats.openings} games={filteredGames} onOpenGame={openGame} onPractice={(family) => startPractice({ practice: 'opening', family })} />
        </>
      )}
      {tab === 'stats' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 24, alignItems: 'start' }}>
            <ProgressChart games={filteredGames} />
            <RatingChart games={filteredGames} />
          </div>
          <MistakeTypesChart stats={filteredStats} games={filteredGames} onOpenGame={openGame} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 24 }}>
            <PhaseChart stats={filteredStats} />
            <MoveQualityChart games={filteredGames} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 24 }}>
            <TimePressureChart stats={filteredStats} />
            {stats.gamesWithClock > 0 && <ClockAccuracyChart games={filteredGames} />}
          </div>
          <Splits stats={filteredStats} games={filteredGames} onOpenGame={openGame} />
        </>
      )}
      {tab === 'blunders' && <BlunderList blunders={filteredStats.topBlunders} games={filteredGames} onOpenGame={openGame} />}
      {tab === 'practice' && <PracticeTab games={filteredGames} openings={filteredStats.openings} focus={practiceFocus} onOpenGame={openGame} />}
      {tab === 'review' && <GameReview games={filteredGames} focus={focus} />}
      {/* {tab === 'mastery' && <MasteryTab games={filteredGames} onOpenGame={openGame} />} */}
    </div>
  )
}
