import type { AnalyzeResult } from './api-types.js'
import { SummaryCard } from './panels/SummaryCard.js'
import { OpeningsTable } from './panels/OpeningsTable.js'
import { CoachingCards } from './panels/CoachingCards.js'
import { MistakeTypesChart } from './panels/MistakeTypesChart.js'
import { PhaseChart } from './panels/PhaseChart.js'
import { TimePressureChart } from './panels/TimePressureChart.js'

export function Dashboard({ result }: { result: AnalyzeResult }) {
  const { stats, suggestions } = result
  return (
    <div>
      <SummaryCard stats={stats} />
      <MistakeTypesChart stats={stats} />
      <PhaseChart stats={stats} />
      <TimePressureChart stats={stats} />
      <OpeningsTable openings={stats.openings} />
      {/* BlunderList slots here (Task 9) */}
      <CoachingCards suggestions={suggestions} />
    </div>
  )
}
