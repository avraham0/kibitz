const FILES = 'abcdefgh'
const PROMO = ['', 'n', 'b', 'r', 'q']

function decodeMove(mv: number): { from: string; to: string; promotion?: string } {
  const toFile  = (mv >> 0) & 7
  const toRank  = (mv >> 3) & 7
  const fromFile = (mv >> 6) & 7
  const fromRank = (mv >> 9) & 7
  const promo   = (mv >> 12) & 7
  return {
    from: FILES[fromFile] + (fromRank + 1),
    to:   FILES[toFile]   + (toRank   + 1),
    promotion: promo ? PROMO[promo] : undefined,
  }
}

export type BookMove = { from: string; to: string; promotion?: string; weight: number }

export class PolyglotBook {
  private view: DataView
  private count: number

  constructor(buf: ArrayBuffer) {
    this.view = new DataView(buf)
    this.count = Math.floor(buf.byteLength / 16)
  }

  lookup(key: bigint): BookMove[] {
    let lo = 0, hi = this.count - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const k = this.readKey(mid)
      if (k === key) {
        let start = mid
        while (start > 0 && this.readKey(start - 1) === key) start--
        const moves: BookMove[] = []
        for (let i = start; i < this.count; i++) {
          if (this.readKey(i) !== key) break
          const mv = this.view.getUint16(i * 16 + 8, false)
          const weight = this.view.getUint16(i * 16 + 10, false)
          if (mv === 0) continue
          moves.push({ ...decodeMove(mv), weight })
        }
        return moves.sort((a, b) => b.weight - a.weight)
      }
      if (k < key) lo = mid + 1; else hi = mid - 1
    }
    return []
  }

  private readKey(i: number): bigint {
    const hi = BigInt(this.view.getUint32(i * 16,     false))
    const lo = BigInt(this.view.getUint32(i * 16 + 4, false))
    return (hi << 32n) | lo
  }
}
