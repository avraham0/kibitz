export function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div>
      <div>Analyzing… {done}/{total} games</div>
      <div style={{ background: '#333', height: 8, borderRadius: 4 }}>
        <div style={{ width: `${pct}%`, height: 8, background: '#4a8', borderRadius: 4 }} />
      </div>
    </div>
  )
}
