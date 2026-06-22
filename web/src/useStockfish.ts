import { useState, useEffect, useRef } from 'react'

// Singleton UCI worker — one Stockfish engine shared across the app.
let worker: Worker | null = null
let workerReady = false
let pendingSearch: (() => void) | null = null
const messageListeners = new Set<(line: string) => void>()

function ensureWorker() {
  if (worker) return
  worker = new Worker('/stockfish.js')
  worker.onerror = (e) => console.error('[stockfish] worker error:', e.message, e)
  worker.onmessage = (e) => {
    const line = typeof e.data === 'string' ? e.data : String(e.data)
    if (line === 'readyok') {
      workerReady = true
      const fn = pendingSearch
      pendingSearch = null
      fn?.()
    }
    messageListeners.forEach((fn) => fn(line))
  }
  worker.postMessage('uci')
  worker.postMessage('isready')
}

// Queue a search; if engine is ready, fire immediately.
// Any previous pending search is discarded (only the latest matters).
function queueSearch(fen: string, depth: number) {
  const doSearch = () => {
    worker!.postMessage('stop')
    worker!.postMessage(`position fen ${fen}`)
    worker!.postMessage(`go depth ${depth}`)
  }
  if (workerReady) {
    doSearch()
  } else {
    pendingSearch = doSearch
  }
}

function parseInfoCp(line: string, whiteToMove: boolean): number | null {
  const mate = line.match(/score mate (-?\d+)/)
  if (mate) {
    const m = parseInt(mate[1])
    const cp = m > 0 ? 9900 : -9900
    return whiteToMove ? cp : -cp
  }
  const cp = line.match(/score cp (-?\d+)/)
  if (!cp) return null
  const v = parseInt(cp[1])
  return whiteToMove ? v : -v
}

export function getBestMove(fen: string, depth = 12): Promise<string | null> {
  return new Promise((resolve) => {
    ensureWorker()
    let resolved = false
    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; messageListeners.delete(onLine); resolve(null) }
    }, 6000)
    function onLine(line: string) {
      if (line.startsWith('bestmove') && !resolved) {
        resolved = true
        clearTimeout(timeout)
        messageListeners.delete(onLine)
        const uciMove = line.split(' ')[1]
        resolve(!uciMove || uciMove === '(none)' ? null : uciMove)
      }
    }
    messageListeners.add(onLine)
    const doSearch = () => {
      worker!.postMessage('stop')
      worker!.postMessage(`position fen ${fen}`)
      worker!.postMessage(`go depth ${depth}`)
    }
    if (workerReady) doSearch()
    else pendingSearch = doSearch
  })
}

export function useStockfishEval(fen: string | null, depth = 14): number | null {
  const [evalCp, setEvalCp] = useState<number | null>(null)
  const activeFen = useRef<string | null>(null)

  useEffect(() => { ensureWorker() }, [])

  useEffect(() => {
    if (!fen) { setEvalCp(null); return }

    activeFen.current = fen
    setEvalCp(null)

    const white = fen.split(' ')[1] === 'w'
    const thisFen = fen

    queueSearch(thisFen, depth)

    function onLine(line: string) {
      if (activeFen.current !== thisFen) return
      if (!line.startsWith('info') || !line.includes('score')) return
      const cp = parseInfoCp(line, white)
      if (cp !== null) setEvalCp(cp)
    }

    messageListeners.add(onLine)
    return () => {
      messageListeners.delete(onLine)
      if (activeFen.current === thisFen) {
        worker?.postMessage('stop')
        activeFen.current = null
      }
    }
  }, [fen, depth])

  return evalCp
}
