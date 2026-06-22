// Least-squares linear regression. Returns a y-value for each input point.
export function linearTrend(values: number[]): number[] {
  const n = values.length
  if (n < 2) return [...values]
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += values[i]; sumXY += i * values[i]; sumX2 += i * i
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  return values.map((_, i) => intercept + slope * i)
}
