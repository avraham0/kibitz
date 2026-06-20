import { PolyglotBook, type BookMove } from './polyglot/reader.js'
import { polyglotHash } from './polyglot/hash.js'

export type { BookMove }

let bookPromise: Promise<PolyglotBook | null> | null = null

export function loadBook(): Promise<PolyglotBook | null> {
  if (!bookPromise) {
    bookPromise = fetch('/book.bin')
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((buf) => new PolyglotBook(buf))
      .catch(() => null)
  }
  return bookPromise
}

export async function lookupFen(fen: string): Promise<BookMove[]> {
  const book = await loadBook()
  if (!book) return []
  return book.lookup(polyglotHash(fen))
}
