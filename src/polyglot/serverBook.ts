import { readFile } from 'node:fs/promises'
import { polyglotHash } from './hash.js'
import { PolyglotBook } from './reader.js'

export type BookLookup = (fen: string) => { from: string; to: string; promotion?: string }[]

// Promise-level cache: the 170MB book file is read once per path; concurrent
// requests during first load all await the same promise instead of each
// spawning their own disk read.
const _cache = new Map<string, Promise<BookLookup | null>>()

export function loadBook(binPath: string): Promise<BookLookup | null> {
  if (!_cache.has(binPath)) {
    _cache.set(binPath, _load(binPath))
  }
  return _cache.get(binPath)!
}

async function _load(binPath: string): Promise<BookLookup | null> {
  try {
    const buf = await readFile(binPath)
    const book = new PolyglotBook(buf.buffer as ArrayBuffer)
    return (fen: string) => book.lookup(polyglotHash(fen))
  } catch {
    return null
  }
}
