import { useState, useEffect } from 'react'

// Responsive board size: the desired max on wide screens, shrunk to fit the viewport
// on phones. `reserve` accounts for adjacent chrome (e.g. the eval bar + gap) and the
// page's horizontal padding. Clamped to a usable minimum.
export function useBoardSize(max: number, reserve = 0): number {
  const calc = () => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : max
    return Math.max(180, Math.min(max, vw - 32 - reserve))
  }
  const [size, setSize] = useState(calc)
  useEffect(() => {
    const onResize = () => setSize(calc())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max, reserve])
  return size
}
