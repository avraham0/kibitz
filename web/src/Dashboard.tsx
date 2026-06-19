import { useState } from 'react'
import type { AnalyzeResult } from './api-types.js'
import { SummaryCard } from './panels/SummaryCard.js'
import { OpeningsTable } from './panels/OpeningsTable.js'
import { BlunderList } from './panels/BlunderList.js'
import { CoachingCards } from './panels/CoachingCards.js'
import { MistakeTypesChart } from './panels/MistakeTypesChart.js'
import { PhaseChart } from './panels/PhaseChart.js'
import { TimePressureChart } from './panels/TimePressureChart.js'
import { GameReview } from './panels/GameReview.js'
import { ProgressChart } from './panels/ProgressChart.js'

type Tab = 'overview' | 'blunders' | 'review'

export function Dashboard({ result }: { result: AnalyzeResult }) {
  const { stats, suggestions, games } = result
  const [tab, setTab] = useState<Tab>('overview')
  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'blunders', label: 'Blunders & puzzles' },
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
          <SummaryCard stats={stats} />
          <ProgressChart games={games} />
          <MistakeTypesChart stats={stats} />
          <PhaseChart stats={stats} />
          <TimePressureChart stats={stats} />
          <OpeningsTable openings={stats.openings} />
          <CoachingCards suggestions={suggestions} />
        </>
      )}
      {tab === 'blunders' && <BlunderList blunders={stats.topBlunders} />}
      {tab === 'review' && <GameReview games={games} />}
    </div>
  )
}
