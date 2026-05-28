#!/usr/bin/env bash
# Generate an .icns file from a square PNG source (macOS only)
# Usage: ./scripts/generate_icns.sh [source-png] [output-icns]

set -euo pipefail

SRC=${1:-electron/assets/icon256.png}
OUT=${2:-electron/assets/icon.icns}
ICON_DIR=$(dirname "$OUT")
ICONSET="$ICON_DIR/icon.iconset"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script must be run on macOS (requires sips and iconutil)."
  exit 2
fi

if [[ ! -f "$SRC" ]]; then
  echo "Source PNG not found: $SRC"
  exit 2
fi

mkdir -p "$ICONSET"

echo "Generating iconset from $SRC..."
sips -z 16 16     "$SRC" --out "$ICONSET/icon_16x16.png"
sips -z 32 32     "$SRC" --out "$ICONSET/icon_16x16@2x.png"
sips -z 32 32     "$SRC" --out "$ICONSET/icon_32x32.png"
sips -z 64 64     "$SRC" --out "$ICONSET/icon_32x32@2x.png"
sips -z 128 128   "$SRC" --out "$ICONSET/icon_128x128.png"
sips -z 256 256   "$SRC" --out "$ICONSET/icon_128x128@2x.png"
sips -z 256 256   "$SRC" --out "$ICONSET/icon_256x256.png"
sips -z 512 512   "$SRC" --out "$ICONSET/icon_256x256@2x.png"
sips -z 512 512   "$SRC" --out "$ICONSET/icon_512x512.png"
sips -z 1024 1024 "$SRC" --out "$ICONSET/icon_512x512@2x.png"

echo "Packaging .icns -> $OUT"
iconutil -c icns "$ICONSET" -o "$OUT"

echo "Cleaning up"
rm -rf "$ICONSET"

echo "Wrote $OUT"
