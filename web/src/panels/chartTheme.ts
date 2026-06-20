// Shared recharts styling so every chart matches the dark theme.
export const AXIS = { tick: { fill: '#9aa3b2', fontSize: 12 }, stroke: '#39404d' } as const
export const GRID = '#262b34'
export const TOOLTIP = {
  contentStyle: { background: '#0f1117', border: '1px solid #4a5568', borderRadius: 8, color: '#f0f2f5', fontSize: 13, padding: '8px 12px' },
  labelStyle: { color: '#cbd5e0', fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: '#f0f2f5' },
  cursor: { fill: 'rgba(255,255,255,0.06)' },
} as const
export const COLORS = {
  allowed: '#e0796b',
  missed: '#6db3f2',
  bar: '#7bc47f',
  accent: '#6db3f2',
  line: '#7bc47f',
} as const
