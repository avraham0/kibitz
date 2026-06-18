import type { Stats } from './aggregate.js'
import type { Suggestion } from './coach.js'
import type { MistakeType, Phase } from '../types.js'

type Meta = { user: string; since: string; depth: number }
type CoachableMistakeType = Exclude<MistakeType, 'lost_position'>

export function analysisLink(_url: string, fen: string): string {
  return `https://www.chess.com/analysis?fen=${encodeURIComponent(fen)}`
}

const TYPES: CoachableMistakeType[] = ['hung_piece', 'missed_tactic', 'bad_trade', 'king_safety', 'positional']
const PHASES: Phase[] = ['opening', 'middlegame', 'endgame']

function recordStr(r: Stats['record']): string {
  return `${r.wins}W-${r.losses}L-${r.draws}D`
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, '\\|')
}

export function renderMarkdown(stats: Stats, suggestions: Suggestion[], meta: Meta): string {
  const lines: string[] = []
  lines.push(`# chess-coach report for ${meta.user}`)
  lines.push('')
  lines.push(`Games since ${meta.since} • analyzed at depth ${meta.depth}`)
  lines.push('')
  lines.push('## Summary')
  lines.push(`- Games analyzed: ${stats.gamesAnalyzed}`)
  lines.push(`- Record: ${recordStr(stats.record)}`)
  lines.push(`- Total mistakes (your moves): ${stats.mistakeCount}`)
  lines.push(`- Moves in already-lost positions (excluded): ${stats.lostPositionMoves}`)
  lines.push('')

  lines.push('## Top blunders')
  lines.push('| Move | Played | Best | cpLoss | Type | Analyze |')
  lines.push('|---|---|---|---|---|---|')
  for (const b of stats.topBlunders) {
    lines.push(`| ${b.ply} | ${escapeCell(b.san)} | ${escapeCell(b.bestSan)} | ${b.cpLoss} | ${escapeCell(b.type)} | [board](${analysisLink(b.url, b.fenBefore)}) |`)
  }
  lines.push('')

  lines.push('## Mistakes by phase')
  lines.push('| Phase | Count |')
  lines.push('|---|---|')
  for (const p of PHASES) lines.push(`| ${p} | ${stats.byPhase[p]} |`)
  lines.push('')

  lines.push('## Mistake types')
  lines.push('| Type | Count | Avg cpLoss |')
  lines.push('|---|---|---|')
  for (const t of TYPES) lines.push(`| ${t} | ${stats.byType[t].count} | ${stats.byType[t].avgCpLoss} |`)
  lines.push('')

  lines.push('## Openings')
  lines.push('| ECO | Opening | Games | Win % | Avg mistakes |')
  lines.push('|---|---|---|---|---|')
  for (const o of stats.openings) lines.push(`| ${o.eco} | ${escapeCell(o.name)} | ${o.games} | ${o.winPct} | ${o.avgMistakes} |`)
  lines.push('')

  lines.push('## Coaching')
  if (suggestions.length === 0) lines.push('No high-priority issues found. Keep it up!')
  for (const s of suggestions) {
    lines.push(`### ${s.title}`)
    lines.push(s.why)
    lines.push('')
    lines.push(`**Drill:** ${s.drill}`)
    if (s.examples.length) {
      lines.push('')
      lines.push('Examples:')
      for (const e of s.examples) {
        lines.push(`- ${e.san} (best: ${e.bestSan}) — [analyze](${analysisLink(e.url, e.fenBefore)})`)
      }
    }
    lines.push('')
  }
  return lines.join('\n')
}

export function renderTerminal(stats: Stats, suggestions: Suggestion[], meta: Meta): string {
  const lines: string[] = []
  lines.push(`chess-coach — ${meta.user} (since ${meta.since}, depth ${meta.depth})`)
  lines.push(`Games: ${stats.gamesAnalyzed}  Record: ${recordStr(stats.record)}  Mistakes: ${stats.mistakeCount}`)
  lines.push(`Moves in already-lost positions (excluded): ${stats.lostPositionMoves}`)
  lines.push('')
  lines.push('Mistake types:')
  for (const t of TYPES) {
    if (stats.byType[t].count) lines.push(`  ${t}: ${stats.byType[t].count} (avg ${stats.byType[t].avgCpLoss}cp)`)
  }
  lines.push('')
  lines.push('Top suggestions:')
  if (!suggestions.length) lines.push('  None — no high-priority issues found.')
  suggestions.forEach((s, i) => {
    lines.push(`  ${i + 1}. ${s.title}`)
    lines.push(`     → ${s.drill}`)
  })
  return lines.join('\n')
}
