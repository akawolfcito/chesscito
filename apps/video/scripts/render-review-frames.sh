#!/usr/bin/env bash
# Render the v2 review stills before any MP4 export.
# 9 horizontal frames covering the A-Cut narrative + 1 horizontal
# frame of the reduced B-Cut disclaimer for legibility check.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUT_DIR="${APP_ROOT}/out/review"

mkdir -p "${OUT_DIR}"
cd "${APP_ROOT}"

echo "[review] rendering v2 stills (9 A-Cut horizontal + 1 B-Cut disclaimer) into ${OUT_DIR}"

# A-Cut horizontal (1920×1080) — premium / startup-game v2.
# Frame numbers correspond to scene "fully-loaded" points (= scene end
# minus 30 frames) under the 15-frame transition overlap. This captures
# every scene with all elements animated in and before the fade-out.
pnpm exec remotion still src/index.ts ChesscitoPitch16x9 \
  "${OUT_DIR}/h01-hook.png" --frame=90
pnpm exec remotion still src/index.ts ChesscitoPitch16x9 \
  "${OUT_DIR}/h02-problem.png" --frame=255
pnpm exec remotion still src/index.ts ChesscitoPitch16x9 \
  "${OUT_DIR}/h03-capability.png" --frame=450
pnpm exec remotion still src/index.ts ChesscitoPitch16x9 \
  "${OUT_DIR}/h04-solution.png" --frame=615
pnpm exec remotion still src/index.ts ChesscitoPitch16x9 \
  "${OUT_DIR}/h05-coach.png" --frame=810
pnpm exec remotion still src/index.ts ChesscitoPitch16x9 \
  "${OUT_DIR}/h06-arena.png" --frame=975
pnpm exec remotion still src/index.ts ChesscitoPitch16x9 \
  "${OUT_DIR}/h07-celebration.png" --frame=1110
pnpm exec remotion still src/index.ts ChesscitoPitch16x9 \
  "${OUT_DIR}/h08-origin.png" --frame=1245
pnpm exec remotion still src/index.ts ChesscitoPitch16x9 \
  "${OUT_DIR}/h09-cta.png" --frame=1380

# B-Cut horizontal — reduced disclaimer (fine-print) fully-loaded.
pnpm exec remotion still src/index.ts ChesscitoPitchCaregiver16x9 \
  "${OUT_DIR}/b-disclaimer-fineprint.png" --frame=1755

echo "[review] done. Inspect ${OUT_DIR} before approving the MP4 render."
