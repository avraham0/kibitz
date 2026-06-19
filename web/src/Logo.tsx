const AMBER = '#e0b15a'
const TILE = '#141a23'

// A bishop — the "advisor" piece — in amber, with a dark mitre slit. Distinct from
// the green/white pawn every chess site uses.
function Bishop({ fill, slit }: { fill: string; slit: string }) {
  return (
    <g>
      <g fill={fill}>
        <circle cx="32" cy="9" r="3.4" />
        <path d="M32 12 C25 16 25 25 32 30 C39 25 39 16 32 12 Z" />
        <ellipse cx="32" cy="32" rx="8.5" ry="2.4" />
        <path d="M25 33 C21 40 19 47 17 52 L47 52 C45 47 43 40 39 33 Z" />
        <rect x="12" y="52" width="40" height="8" rx="3.5" />
      </g>
      <path d="M30 20 L36 27" stroke={slit} strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </g>
  )
}

// Mark: amber bishop on a dark rounded tile.
export function KibitzMark({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Kibitz logo">
      <rect x="1" y="1" width="62" height="62" rx="15" fill={TILE} stroke="#2a313d" />
      <g transform="translate(3.2 2.5) scale(0.9)"><Bishop fill={AMBER} slit={TILE} /></g>
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
          kib<span style={{ color: AMBER }}>i</span>tz
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Always watching. Always reviewing.</span>
      </div>
    </div>
  )
}
