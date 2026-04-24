#!/usr/bin/env bash
set -euo pipefail

# Build each MCP app as a self-contained inline HTML file.
# Output: dist-inline/{kit}/{app}.html

APPS=(
  "crm/pipeline"
  "crm/contacts"
  "crm/contact-detail"
  "crm/dashboard"
  "crm/proposal"
  "expense/expense-table"
  "expense/category-dashboard"
  "expense/import-review"
  "expense/steuerberater-export"
  "outreach/sequence-builder"
  "outreach/prospect-list"
  "outreach/email-preview"
  "meeting/meeting-summary"
  "meeting/action-tracker"
  "meeting/meeting-history"
)

OUTDIR="dist-inline"
TMPDIR_BASE=".build-tmp"
rm -rf "$OUTDIR" "$TMPDIR_BASE"
mkdir -p "$OUTDIR"

echo "Building ${#APPS[@]} inline apps..."

for app in "${APPS[@]}"; do
  kit="${app%%/*}"
  appname="${app##*/}"
  mkdir -p "$OUTDIR/$kit"

  APP_ENTRY="$app" npx vite build --outDir "$TMPDIR_BASE/$app" 2>/dev/null

  # Move the nested index.html to flat location
  cp "$TMPDIR_BASE/$app/src/$app/index.html" "$OUTDIR/$kit/$appname.html"
  echo "  $kit/$appname.html"
done

rm -rf "$TMPDIR_BASE"

# Build the universal app shell (uses separate vite config for flat entry)
echo ""
echo "Building app shell..."
npx vite build \
  --config vite.shell.config.ts \
  --outDir "$TMPDIR_BASE/shell" 2>/dev/null
cp "$TMPDIR_BASE/shell/src/app-shell.html" "$OUTDIR/app-shell.html"
rm -rf "$TMPDIR_BASE"
echo "  app-shell.html"

echo ""
echo "Done. Output:"
ls -lhS "$OUTDIR"/*.html "$OUTDIR"/*/*.html 2>/dev/null | awk '{print "  " $5 "  " $9}'
