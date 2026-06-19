const SYMBOL_FONT = '"Segoe UI Symbol","Apple Symbols","Noto Sans Symbols2","DejaVu Sans",serif'

// Round spectacles perched on the knight — the studious onlooker. Amber so they
// read against both the dark knight and the green bubble.
function Glasses() {
  return (
    <g fill="none" stroke="#e0b15a" strokeWidth="2.4" strokeLinecap="round">
      <circle cx="26" cy="25" r="5.3" />
      <circle cx="38" cy="25" r="5.3" />
      <path d="M31.3 25 h1.4" />
      <path d="M43.2 24 q3.5 -1 4.6 2.2" />
    </g>
  )
}

// Concept A: a knight inside a speech bubble — the kibitzer commenting on your game.
export function KibitzMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Kibitz logo">
      <rect x="6" y="6" width="52" height="44" rx="13" fill="#7bc47f" />
      <path d="M16 50 l-8 9 v-9 z" fill="#7bc47f" />
      <text x="32" y="43" textAnchor="middle" fontSize="40" fill="#0b0e13" style={{ fontFamily: SYMBOL_FONT }}>&#9822;</text>
      <Glasses />
    </svg>
  )
}

// Mark + wordmark, for the app header.
export function KibitzLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <KibitzMark size={44} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
        <span style={{ fontSize: 30, fontWeight: 750, letterSpacing: '-0.02em' }}>
          kib<span style={{ color: '#7bc47f' }}>i</span>tz
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>see your game like a master would</span>
      </div>
    </div>
  )
}
