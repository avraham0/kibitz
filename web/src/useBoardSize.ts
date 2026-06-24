import { useState, useRef, useCallback } from 'react'

// Responsive board size based on the *actual* container width (not the viewport), so
// boards never spill past their panel — accounting for padding, nesting, and any
// adjacent chrome via `reserve` (e.g. an eval bar + gap). Capped at `max`.
// Returns a callback ref to attach to a full-width wrapper, plus the computed size.
export function useBoardSize(max: number, reserve = 0): readonly [(el: HTMLElement | null) => void, number] {
  const [size, setSize] = useState(max)
  const roRef = useRef<ResizeObserver | null>(null)

  const setRef = useCallback((el: HTMLElement | null) => {
    roRef.current?.disconnect()
    roRef.current = null
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      if (w > 0) setSize(Math.max(160, Math.min(max, Math.floor(w - reserve))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    roRef.current = ro
  }, [max, reserve])

  return [setRef, size] as const
}
