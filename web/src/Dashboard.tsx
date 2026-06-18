import type { AnalyzeResult } from './api-types.js'
import { SummaryCard } from './panels/SummaryCard.js'
import { OpeningsTable } from './panels/OpeningsTable.js'
import { CoachingCards } from './panels/CoachingCards.js'

export function Dashboard({ result }: { result: AnalyzeResult }) {
  const { stats, suggestions } = result
  return (
    <div>
      <SummaryCard stats={stats} />
      {/* MistakeTypesChart / PhaseChart / TimePressureChart slot here (Task 8) */}
      <OpeningsTable openings={stats.openings} />
      {/* BlunderList slots here (Task 9) */}
      <CoachingCards suggestions={suggestions} />
    </div>
  )
}
