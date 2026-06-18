export function writeSse(write: (chunk: string) => void, event: string, data: unknown): void {
  write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}
