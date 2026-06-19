import { describe, it, expect } from 'vitest'
import { NativeEngine, nativeBinPath } from './native.js'

describe('NativeEngine', () => {
  it('rejects when the binary is missing, so the pool can fall back to WASM', async () => {
    await expect(NativeEngine.create('definitely-not-a-real-stockfish-xyz', 1500)).rejects.toBeTruthy()
  })

  it('uses STOCKFISH_PATH when set, else `stockfish` on PATH', () => {
    const prev = process.env.STOCKFISH_PATH
    process.env.STOCKFISH_PATH = '/opt/sf'
    expect(nativeBinPath()).toBe('/opt/sf')
    delete process.env.STOCKFISH_PATH
    expect(nativeBinPath()).toBe('stockfish')
    if (prev !== undefined) process.env.STOCKFISH_PATH = prev
  })
})
