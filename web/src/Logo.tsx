// Custom-drawn chess knight (facing left) so the glasses lock to the eye and it
// stays crisp at any size — no font/glyph dependency.
const KNIGHT_PATH =
  'M14 58 L52 58 L52 54 C50 52 47 51 46 49 C55 45 56 33 51 23 C50 19 50 17 47 14 ' +
  'L45 7 L40 13 L35 7 C32 11 29 13 27 17 C22 19 17 24 13 30 L8 37 C7 39 8 41 11 41 ' +
  'L18 41 C22 42 23 46 21 50 C20 53 17 55 16 58 Z'

// The knight, its eye, and round spectacles, all in one coordinate system (0–64)
// so the glasses sit exactly on the eye. `ink` = knight fill, `eye` = bubble/tile
// colour showing through the carved eye.
function Knight({ ink, eye }: { ink: string; eye: string }) {
  return (
    <g>
      <path d={KNIGHT_PATH} fill={ink} />
      <circle cx="25" cy="25.5" r="1.9" fill={eye} />
      <g fill="none" stroke="#e0b15a" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="24.5" cy="25.5" r="5.6" />
        <circle cx="13.5" cy="30" r="4.8" />
        <path d="M18.7 26.6 L18.1 29.2" />
        <path d="M30 24.6 Q34.5 21.8 36.5 23.4" />
      </g>
    </g>
  )
}

// Concept A: the knight inside a speech bubble — the kibitzer commenting on your game.
export function KibitzMark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Kibitz logo">
      <rect x="2" y="2" width="60" height="50" rx="13" fill="#7bc47f" />
      <path d="M14 52 l-7 9 v-9 z" fill="#7bc47f" />
      <g transform="translate(6 1) scale(0.82)">
        <Knight ink="#0b0e13" eye="#7bc47f" />
      </g>
    </svg>
  )
}

// Mark + wordmark, for the app header.
export function KibitzLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <KibitzMark size={48} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
        <span style={{ fontSize: 30, fontWeight: 750, letterSpacing: '-0.02em' }}>
          kib<span style={{ color: '#7bc47f' }}>i</span>tz
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>see your game like a master would</span>
      </div>
    </div>
  )
}
