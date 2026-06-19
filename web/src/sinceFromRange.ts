export type RangeKey = '1month' | '3month' | '6month' | '1year' | 'custom'

const MONTHS: Record<Exclude<RangeKey, 'custom'>, number> = {
  '1month': 1, '3month': 3, '6month': 6, '1year': 12,
}

// Turn a relative range into the YYYY-MM string the API expects, counting back
// from `now`. 'custom' is handled by the form's free-text field, not here.
export function sinceFromRange(range: Exclude<RangeKey, 'custom'>, now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - MONTHS[range], 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export const RANGE_LABELS: Record<RangeKey, string> = {
  '1month': '1 month', '3month': '3 months', '6month': '6 months', '1year': '1 year', custom: 'custom',
}
