type FetchFn = typeof fetch

const BASE = 'https://api.chess.com/pub/player'

export function monthsSince(sinceYYYYMM: string, nowISO: string): string[] {
  const [sy, sm] = sinceYYYYMM.split('-').map(Number)
  const now = new Date(nowISO)
  const ey = now.getUTCFullYear()
  const em = now.getUTCMonth() + 1
  const out: string[] = []
  let y = sy, m = sm
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}/${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}

async function getJson(url: string, fetchFn: FetchFn, user: string): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetchFn(url)
    if (res.status === 404) throw new Error(`Unknown chess.com user: ${user}`)
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      continue
    }
    if (!res.ok) throw new Error(`chess.com request failed (${res.status}): ${url}`)
    return res.json()
  }
  throw new Error(`chess.com rate-limited after retries: ${url}`)
}

export async function archiveUrls(user: string, fetchFn: FetchFn = fetch): Promise<string[]> {
  const data = await getJson(`${BASE}/${encodeURIComponent(user)}/games/archives`, fetchFn, user)
  return data.archives ?? []
}

export async function fetchArchive(url: string, fetchFn: FetchFn = fetch, user = ''): Promise<any[]> {
  const data = await getJson(url, fetchFn, user)
  return data.games ?? []
}

export async function fetchGamesSince(
  user: string,
  sinceYYYYMM: string,
  nowISO: string,
  fetchFn: FetchFn = fetch,
): Promise<any[]> {
  const wanted = new Set(monthsSince(sinceYYYYMM, nowISO))
  const all: any[] = []
  for (const ym of wanted) {
    const games = await fetchArchive(`${BASE}/${encodeURIComponent(user)}/games/${ym}`, fetchFn, user)
    all.push(...games)
  }
  return all
}
