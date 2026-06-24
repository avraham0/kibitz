// Group specific opening lines into the family a player thinks in terms of —
// "Italian Game", "Sicilian Defense" — regardless of ECO code or sub-variation.
//
// chess.com opening names (derived from the ECOUrl slug) always lead with the
// family, e.g. "Italian Game Giuoco Piano", "Sicilian Defense Najdorf Variation".
// So we match each name against a curated list of family prefixes, longest match
// first. Anything unmatched falls back to its own full name as its group.

// Display names. Matching is done on a normalised form (lowercase, no punctuation),
// and we prefer the LONGEST matching prefix so "King's Indian Attack" wins over a
// bare "King's Indian" fallback.
const FAMILIES: string[] = [
  // 1.e4 e5
  'Ruy Lopez', 'Italian Game', 'Scotch Game', 'Vienna Game', "King's Gambit",
  'Four Knights Game', 'Two Knights Defense', 'Giuoco Piano', "Petrov's Defense",
  'Philidor Defense', 'Russian Game', 'Bishop\'s Opening', 'Ponziani Opening',
  // 1.e4 other
  'Sicilian Defense', 'French Defense', 'Caro-Kann Defense', 'Pirc Defense',
  'Modern Defense', 'Scandinavian Defense', 'Alekhine Defense', 'Nimzowitsch Defense',
  // 1.d4 d5
  "Queen's Gambit Declined", "Queen's Gambit Accepted", "Queen's Gambit",
  'Slav Defense', 'Semi-Slav Defense', 'Catalan Opening', 'London System',
  'Colle System', 'Trompowsky Attack', 'Torre Attack',
  // 1.d4 Nf6 (Indian)
  'Nimzo-Indian Defense', "Queen's Indian Defense", "King's Indian Defense",
  "King's Indian Attack", 'Grünfeld Defense', 'Gruenfeld Defense', 'Bogo-Indian Defense',
  'Benoni Defense', 'Benko Gambit', 'Old Indian Defense', 'Indian Game', 'Grunfeld Defense',
  // flank / other
  'English Opening', 'Réti Opening', 'Reti Opening', "Bird's Opening",
  'Dutch Defense', "Queen's Pawn Game", "King's Pawn Game", 'Englund Gambit',
]

// chess.com opening slugs drop apostrophes ("King's" → "Kings"), so strip them
// rather than turning them into a word break, then collapse other punctuation to
// spaces. This makes "King's Indian Defense" match "Kings Indian Defense ...".
function normalize(s: string): string {
  return s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

// Family prefixes paired with their normalised key, sorted longest-key-first so the
// most specific family wins (e.g. "kings indian attack" before "kings indian defense").
const FAMILY_KEYS: { display: string; key: string }[] = FAMILIES
  .map((display) => ({ display, key: normalize(display) }))
  .sort((a, b) => b.key.length - a.key.length)

export function openingFamily(openingName: string): string {
  if (!openingName || openingName === 'Unknown') return 'Unknown'
  const n = normalize(openingName)
  for (const { display, key } of FAMILY_KEYS) {
    if (n === key || n.startsWith(key + ' ')) return display
  }
  // No curated family — keep the full name as its own group.
  return openingName
}
