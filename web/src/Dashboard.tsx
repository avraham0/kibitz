import { useState } from 'react'
import type { AnalyzeResult } from './api-types.js'
import { SummaryCard } from './panels/SummaryCard.js'
import { TopLeaks } from './panels/TopLeaks.js'
import { Splits } from './panels/Splits.js'
import { OpeningsTable } from './panels/OpeningsTable.js'
import { BlunderList } from './panels/BlunderList.js'
import { CoachingCards } from './panels/CoachingCards.js'
import { MistakeTypesChart } from './panels/MistakeTypesChart.js'
import { PhaseChart } from './panels/PhaseChart.js'
import { TimePressureChart } from './panels/TimePressureChart.js'
import { GameReview } from './panels/GameReview.js'
import { ProgressChart } from './panels/ProgressChart.js'
import { HangFrequency } from './panels/HangFrequency.js'
import { CriticalPositions } from './panels/CriticalPositions.js'
import { MoveQualityChart } from './panels/MoveQualityChart.js'
import { EndgameStats } from './panels/EndgameStats.js'
import { RatingChart } from './panels/RatingChart.js'
import { BestGames } from './panels/BestGames.js'
import { OpeningRecommendations } from './panels/OpeningRecommendations.js'
import { ClockAccuracyChart } from './panels/ClockAccuracyChart.js'
import { TrainingTab } from './panels/TrainingTab.js'

type Tab = 'overview' | 'blunders' | 'train' | 'review'

export function Dashboard({ result }: { result: AnalyzeResult }) {
  const { stats, suggestions, games } = result
  const [tab, setTab] = useState<Tab>('overview')
  // Which game to focus in Game Review; `seq` bumps each request so re-clicking the
  // same game still triggers the jump.
  const [focus, setFocus] = useState<{ id: string; seq: number; ply?: number } | null>(null)
  function openGame(id: string, ply?: number) {
    setFocus((f) => ({ id, ply, seq: (f?.seq ?? 0) + 1 }))
    setTab('review')
  }
  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'blunders', label: 'Blunders' },
    { id: 'train', label: 'Train' },
    { id: 'review', label: 'Game review' },
  ]
  return (
    <div>
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <SummaryCard stats={stats} games={games} />
          <TopLeaks stats={stats} />
          <HangFrequency blunders={stats.topBlunders} />
          <CriticalPositions games={games} />
          <ProgressChart games={games} />
          <RatingChart games={games} />
          <BestGames games={games} onOpenGame={openGame} />
          <OpeningRecommendations stats={stats} />
          <MistakeTypesChart stats={stats} games={games} onOpenGame={openGame} />
          <PhaseChart stats={stats} />
          <MoveQualityChart games={games} />
          <TimePressureChart stats={stats} />
          {stats.gamesWithClock > 0 && <ClockAccuracyChart games={games} />}
          <Splits stats={stats} games={games} onOpenGame={openGame} />
          <EndgameStats games={games} />
          <OpeningsTable openings={stats.openings} games={games} onOpenGame={openGame} />
          <CoachingCards suggestions={suggestions} />
        </>
      )}
      {tab === 'blunders' && <BlunderList blunders={stats.topBlunders} />}
      {tab === 'train' && <TrainingTab blunders={stats.topBlunders} />}
      {tab === 'review' && <GameReview games={games} focus={focus} />}
    </div>
  )
}
