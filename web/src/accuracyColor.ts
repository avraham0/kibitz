// Green / amber / red by accuracy %, for at-a-glance reads.
export function accuracyColor(pct: number): string {
  if (pct >= 80) return '#7bc47f'
  if (pct >= 60) return '#e0b15a'
  return '#e0796b'
}
