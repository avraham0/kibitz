// Shared recharts styling so every chart matches the dark theme.
export const AXIS = { tick: { fill: '#9aa3b2', fontSize: 12 }, stroke: '#39404d' } as const
export const GRID = '#262b34'
export const TOOLTIP = {
  contentStyle: { background: '#1b1f26', border: '1px solid #2a2f3a', borderRadius: 8, color: '#e6e8ec' },
  labelStyle: { color: '#9aa3b2' },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
} as const
export const COLORS = {
  allowed: '#e0796b',
  missed: '#6db3f2',
  bar: '#7bc47f',
  accent: '#6db3f2',
  line: '#7bc47f',
} as const
