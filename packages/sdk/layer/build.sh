#!/bin/bash
# Build the KitRuntime Lambda layer zip.
# Lambda layers expect node_modules at nodejs/node_modules/
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
STAGE="$DIR/.stage"

rm -rf "$STAGE"
mkdir -p "$STAGE/nodejs"

cp "$DIR/package.json" "$STAGE/nodejs/package.json"
cd "$STAGE/nodejs"
npm install --omit=dev --ignore-scripts 2>/dev/null

# Remove unnecessary files to keep layer small
find . -name "*.d.ts" -delete 2>/dev/null || true
find . -name "*.map" -delete 2>/dev/null || true
find . -name "README*" -delete 2>/dev/null || true
find . -name "LICENSE*" -delete 2>/dev/null || true
find . -name "CHANGELOG*" -delete 2>/dev/null || true

cd "$STAGE"
zip -qr "$DIR/layer.zip" nodejs/

SIZE=$(du -h "$DIR/layer.zip" | cut -f1)
echo "Built layer.zip ($SIZE)"

rm -rf "$STAGE"
