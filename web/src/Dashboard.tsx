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

export function Dashboard({ result }: { result: AnalyzeResult }) {
  const { stats, suggestions, games } = result
  return (
    <div>
      <SummaryCard stats={stats} />
      <ProgressChart games={games} />
      <MistakeTypesChart stats={stats} />
      <PhaseChart stats={stats} />
      <TimePressureChart stats={stats} />
      <OpeningsTable openings={stats.openings} />
      <BlunderList blunders={stats.topBlunders} />
      <GameReview games={games} />
      <CoachingCards suggestions={suggestions} />
    </div>
  )
}
