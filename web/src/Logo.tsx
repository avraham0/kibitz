// A friendly pawn mascot: green pawn with a bespectacled smiley face. Face features
// use the tile colour so they read as clean cutouts on the green. All in one 0–64
// coordinate system so the glasses sit exactly on the eyes.
function Pawn({ fill, face }: { fill: string; face: string }) {
  return (
    <g>
      <circle cx="32" cy="18" r="12" fill={fill} />
      <ellipse cx="32" cy="31" rx="10" ry="2.6" fill={fill} />
      <path d="M25 32 C21 39 19 46 17 51 L47 51 C45 46 43 39 39 32 Z" fill={fill} />
      <rect x="12" y="51" width="40" height="8" rx="3.5" fill={fill} />
      <g fill={face}>
        <circle cx="27.5" cy="17.5" r="1.5" />
        <circle cx="36.5" cy="17.5" r="1.5" />
      </g>
      <g fill="none" stroke={face} strokeWidth="1.5" strokeLinecap="round">
        <circle cx="27.5" cy="17.5" r="4.1" />
        <circle cx="36.5" cy="17.5" r="4.1" />
        <path d="M31.6 16.9 L32.4 16.9" />
        <path d="M23.4 16.9 L21.2 16.4" />
        <path d="M40.6 16.9 L42.8 16.4" />
        <path d="M27.2 23 Q32 26.6 36.8 23" />
      </g>
    </g>
  )
}

// Mark: green pawn on a dark rounded tile.
export function KibitzMark({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Kibitz logo">
      <rect x="1" y="1" width="62" height="62" rx="15" fill="#141a23" stroke="#2a313d" />
      <g transform="translate(6 2.5) scale(0.83)"><Pawn fill="#7bc47f" face="#141a23" /></g>
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
