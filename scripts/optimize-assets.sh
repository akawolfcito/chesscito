#!/usr/bin/env bash
# optimize-assets.sh — idempotent asset optimizer for apps/web/public/
#
# Per PNG/JPG > MIN_SIZE_KB:
#   1. Resize down to target max-width (heuristic by path) — PNG only
#   2. Run pngquant (lossy PNG) — PNG only
#   3. Generate .webp sibling (cwebp -q 80)
#   4. Generate .avif sibling (avifenc)
# Idempotent: safe to re-run, regenerates siblings every time.
#
# JPG handling: dimensions and the JPG file itself are left intact
# (e.g. og:image cards need 1200x630 — social scrapers don't read
# AVIF/WebP). Only siblings are generated for in-app <picture> use.
#
# Requires: sips (macOS), pngquant, cwebp, avifenc

set -euo pipefail

PUBLIC_DIR="apps/web/public"
MIN_SIZE_KB=10
REPORT_FILE="docs/audits/2026-05-19-asset-optim-report.md"

# Heuristic: max-width by directory + filename (PNG only)
target_max_width() {
  local path="$1"
  case "$path" in
    *new-icons-chesscito*|*/hub/*|*redesign/icons*|*redesign/pieces*|*action-row*) echo 256 ;;
    *bg-*|*splash*|*hero*|*board*|*hall*|*portal-centered*|*panel-frame*|*shop-magic*|*reward-glow*|*target-circle*) echo 1024 ;;
    *) echo 512 ;;
  esac
}

KB() { echo $(( $(stat -f%z "$1" 2>/dev/null || stat -c%s "$1" 2>/dev/null || echo 0) / 1024 )); }

SAVINGS_BEFORE=0
SAVINGS_AFTER=0
PROCESSED=0

mkdir -p "$(dirname "$REPORT_FILE")"
cat > "$REPORT_FILE" <<EOF
# Asset Optimization Report — $(date +%Y-%m-%d)

Processed PNG + JPG files >${MIN_SIZE_KB}KB. JPG kept at original size
and format (siblings only). PNG resized + pngquant + siblings.

| File | Before (KB) | After source (KB) | WebP (KB) | AVIF (KB) | Saved |
|------|-----------:|------------------:|----------:|----------:|------:|
EOF

process_file() {
  local src="$1"
  local ext
  ext=$(echo "${src##*.}" | tr '[:upper:]' '[:lower:]')
  local base="${src%.*}"
  local before_kb
  before_kb=$(KB "$src")
  [ "$before_kb" -lt "$MIN_SIZE_KB" ] && return

  local webp="${base}.webp"
  local avif="${base}.avif"

  if [ "$ext" = "png" ]; then
    local max_w
    max_w=$(target_max_width "$src")
    local width
    width=$(sips -g pixelWidth "$src" 2>/dev/null | tail -1 | awk '{print $2}')
    if [ -n "$width" ] && [ "$width" -gt "$max_w" ]; then
      sips --resampleWidth "$max_w" "$src" --out "$src" >/dev/null 2>&1
    fi
    pngquant --quality=70-90 --skip-if-larger --strip --force --ext .png "$src" 2>/dev/null || true
  fi
  # JPG: leave the file itself untouched

  cwebp -q 80 -quiet "$src" -o "$webp" 2>/dev/null || true
  avifenc --min 24 --max 32 --speed 4 "$src" "$avif" >/dev/null 2>&1 || true

  local after_kb webp_kb avif_kb smallest
  after_kb=$(KB "$src")
  webp_kb=$(KB "$webp")
  avif_kb=$(KB "$avif")
  smallest=$avif_kb
  [ "$webp_kb" -gt 0 ] && [ "$webp_kb" -lt "$smallest" ] && smallest=$webp_kb
  [ "$smallest" -eq 0 ] && smallest=$after_kb

  local saved=$(( before_kb - smallest ))
  SAVINGS_BEFORE=$(( SAVINGS_BEFORE + before_kb ))
  SAVINGS_AFTER=$(( SAVINGS_AFTER + smallest ))
  PROCESSED=$(( PROCESSED + 1 ))

  local rel="${src#./}"
  echo "| $rel | $before_kb | $after_kb | $webp_kb | $avif_kb | ${saved}KB |" >> "$REPORT_FILE"
  printf "  ✓ %-60s %5d → src:%4d webp:%4d avif:%4d KB\n" "$rel" "$before_kb" "$after_kb" "$webp_kb" "$avif_kb"
}

while IFS= read -r f; do
  process_file "$f"
done < <(find "$PUBLIC_DIR" -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" \) | sort)

cat >> "$REPORT_FILE" <<EOF

## Totals

- **Processed:** $PROCESSED files (>${MIN_SIZE_KB}KB)
- **Before:** ${SAVINGS_BEFORE} KB
- **After (smallest variant):** ${SAVINGS_AFTER} KB
- **Saved:** $(( SAVINGS_BEFORE - SAVINGS_AFTER )) KB (best-case, browser picks lightest)
EOF

echo ""
echo "=== Summary ==="
echo "Processed: $PROCESSED files"
echo "Before:    ${SAVINGS_BEFORE} KB"
echo "After:     ${SAVINGS_AFTER} KB (smallest sibling)"
echo "Saved:     $(( SAVINGS_BEFORE - SAVINGS_AFTER )) KB"
echo ""
echo "Report:    $REPORT_FILE"
