import { readFile } from 'node:fs/promises'
import { polyglotHash } from './hash.js'
import { PolyglotBook } from './reader.js'

export type BookLookup = (fen: string) => { from: string; to: string; promotion?: string }[]

// Load a Polyglot .bin book from disk. Returns null silently if the file doesn't exist
// (analysis continues without book skipping). Caches the book in memory after first load.
export async function loadBook(binPath: string): Promise<BookLookup | null> {
  try {
    const buf = await readFile(binPath)
    const book = new PolyglotBook(buf.buffer as ArrayBuffer)
    return (fen: string) => {
      const key = polyglotHash(fen)
      return book.lookup(key)
    }
  } catch {
    return null
  }
}
