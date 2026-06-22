#!/usr/bin/env bash
# Build a standalone Mac binary: kibitz-mac
# Requirements: Node.js 20+, npm, and (at runtime) stockfish via `brew install stockfish`
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$ROOT/.sea-build"

echo "==> Building web frontend..."
(cd "$ROOT/web" && npm run build)

echo "==> Generating embedded assets..."
node "$ROOT/scripts/generate-assets.mjs"

echo "==> Installing postject (SEA injector)..."
npm install --no-save postject 2>/dev/null | tail -1

echo "==> Bundling server with esbuild..."
mkdir -p "$BUILD_DIR"
"$ROOT/node_modules/.bin/esbuild" "$ROOT/src/server/serve-sea.ts" \
  --bundle \
  --platform=node \
  --format=cjs \
  --outfile="$BUILD_DIR/main.cjs" \
  --log-level=warning

echo "==> Creating Node SEA config..."
cat > "$BUILD_DIR/sea-config.json" <<JSON
{
  "main": "$BUILD_DIR/main.cjs",
  "output": "$BUILD_DIR/sea-prep.blob",
  "disableExperimentalSEAWarning": true
}
JSON

echo "==> Generating SEA blob..."
node --experimental-sea-config "$BUILD_DIR/sea-config.json"

echo "==> Copying node binary..."
OUT="$ROOT/kibitz-mac"
cp "$(command -v node)" "$OUT"

echo "==> Injecting blob..."
"$ROOT/node_modules/.bin/postject" "$OUT" NODE_SEA_BLOB "$BUILD_DIR/sea-prep.blob" \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
  --macho-segment-name NODE_SEA

echo "==> Signing binary (ad-hoc)..."
codesign --sign - "$OUT" 2>/dev/null || true

rm -rf "$BUILD_DIR"

SIZE=$(du -sh "$OUT" | cut -f1)
echo ""
echo "✓ Done! Binary: $OUT ($SIZE)"
echo ""
echo "Send 'kibitz-mac' to your friend. They run:"
echo "  chmod +x kibitz-mac && ./kibitz-mac"
echo ""
echo "Requires: brew install stockfish  (once, for analysis engine)"
echo "Optional: ~/.kibitz/book.bin      (Cerebellum opening book)"
