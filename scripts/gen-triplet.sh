#!/usr/bin/env bash
# gen-triplet.sh — Generate .png + .webp + .avif from any source image.
#
# Usage:
#   scripts/gen-triplet.sh <source-image> [output-dir]
#
# Examples:
#   scripts/gen-triplet.sh design/wallpapers/wallpaper-exercises.png apps/web/public/art/redesign/bg/
#   scripts/gen-triplet.sh ~/Downloads/hero.jpg apps/web/public/art/
#   scripts/gen-triplet.sh apps/web/public/art/panel-bg1.png   # outputs next to source
#
# Requirements: cwebp, avifenc (brew install webp libavif)

set -euo pipefail

# ── args ──────────────────────────────────────────────────────────────────────
if [[ $# -lt 1 ]]; then
  echo "Usage: $(basename "$0") <source-image> [output-dir]" >&2
  exit 1
fi

SOURCE="$1"

if [[ ! -f "$SOURCE" ]]; then
  echo "Error: file not found: $SOURCE" >&2
  exit 1
fi

# Resolve output directory (default: same dir as source)
if [[ $# -ge 2 ]]; then
  OUT_DIR="${2%/}"
  mkdir -p "$OUT_DIR"
else
  OUT_DIR="$(dirname "$SOURCE")"
fi

# Derive base name without extension
BASENAME="$(basename "${SOURCE%.*}")"

OUT_PNG="$OUT_DIR/$BASENAME.png"
OUT_WEBP="$OUT_DIR/$BASENAME.webp"
OUT_AVIF="$OUT_DIR/$BASENAME.avif"

# ── dependency check ──────────────────────────────────────────────────────────
for cmd in cwebp avifenc; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' not found. Install with: brew install webp libavif" >&2
    exit 1
  fi
done

# ── convert ───────────────────────────────────────────────────────────────────
echo "Source : $SOURCE"
echo "Output : $OUT_DIR/"
echo ""

# PNG — copy if source is already PNG, otherwise convert via sips (macOS) or ffmpeg
EXT="${SOURCE##*.}"
EXT_LOWER="$(echo "$EXT" | tr '[:upper:]' '[:lower:]')"
if [[ "$EXT_LOWER" == "png" && "$SOURCE" != "$OUT_PNG" ]]; then
  cp "$SOURCE" "$OUT_PNG"
elif [[ "$EXT_LOWER" != "png" ]]; then
  if command -v ffmpeg &>/dev/null; then
    ffmpeg -y -i "$SOURCE" "$OUT_PNG" -loglevel error
  elif command -v sips &>/dev/null; then
    sips -s format png "$SOURCE" --out "$OUT_PNG" &>/dev/null
  else
    echo "Error: source is not PNG and neither ffmpeg nor sips is available." >&2
    exit 1
  fi
fi

# WebP
cwebp -quiet -q 85 -m 6 -mt "$OUT_PNG" -o "$OUT_WEBP"

# AVIF
avifenc --speed 6 -q 42 "$OUT_PNG" "$OUT_AVIF" >/dev/null

# ── report ────────────────────────────────────────────────────────────────────
echo "Generated triplet:"
for f in "$OUT_PNG" "$OUT_WEBP" "$OUT_AVIF"; do
  size=$(du -sh "$f" 2>/dev/null | cut -f1)
  printf "  %-6s  %s\n" "$size" "$f"
done
