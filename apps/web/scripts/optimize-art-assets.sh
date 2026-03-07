#!/usr/bin/env bash
set -euo pipefail

ART_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../public/art" && pwd)"

if [[ ! -d "$ART_DIR" ]]; then
  echo "Art directory not found: $ART_DIR" >&2
  exit 1
fi

assets=(
  "bg-playhub-forest-mobile"
  "bg-playhub-forest-desktop"
  "panel-frame-rune"
  "shop-slot-frame"
  "reward-glow"
)

echo "Optimizing art assets in: $ART_DIR"

for asset in "${assets[@]}"; do
  input_png="$ART_DIR/$asset.png"
  output_webp="$ART_DIR/$asset.webp"
  output_avif="$ART_DIR/$asset.avif"

  if [[ ! -f "$input_png" ]]; then
    echo "Skipping missing file: $input_png"
    continue
  fi

  cwebp -quiet -q 82 -m 6 -mt "$input_png" -o "$output_webp"
  avifenc --speed 6 -q 42 "$input_png" "$output_avif" >/dev/null

  echo "Generated:"
  ls -lh "$input_png" "$output_webp" "$output_avif" | awk '{print "  " $9 ": " $5}'
done

echo "Done."
