/**
 * Captures the four screenshots used by the Chesscito pitch video.
 * Run with: pnpm --filter video capture
 *
 * Prereqs:
 *  - Web dev server running on http://localhost:3000
 *  - playwright installed (devDep) + browsers (`pnpm exec playwright install chromium`)
 *
 * Outputs to apps/video/public/screenshots/<key>.png
 *
 * The Composition consumes these via PhoneFrame; missing assets fall
 * back gracefully thanks to the Img onError guard.
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

// Run from apps/video/ via `pnpm --filter video capture`. cwd === that dir.
const OUT_DIR = resolve(process.cwd(), "public", "screenshots");
const BASE_URL = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000";
const VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_FOR_NETWORK_IDLE_MS = 1500;

interface CaptureSpec {
  key: string;
  path: string;
  label: string;
  /** Optional setup function — clicks, scrolls, localStorage seeds. */
  prepare?: (page: import("playwright").Page) => Promise<void>;
}

const SPECS: CaptureSpec[] = [
  {
    key: "play-hub",
    path: "/play-hub",
    label: "Play Hub home",
  },
  {
    key: "exercise-rook-pattern",
    path: "/play-hub",
    label: "Rook exercise (mid-tutorial)",
    prepare: async (page) => {
      // Best-effort: scroll the board into view. If the level requires a tap
      // the user can re-capture manually; the fallback PhoneFrame handles
      // missing assets without crashing the studio preview.
      await page
        .locator('[data-testid="board"], .playhub-board-canvas')
        .first()
        .scrollIntoViewIfNeeded()
        .catch(() => {
          // ignore — selector may differ between builds
        });
    },
  },
  {
    key: "arena",
    path: "/arena",
    label: "Arena vs AI (initial state)",
  },
  {
    key: "victory-state",
    path: "/arena",
    label: "Arena post-victory (TODO: requires manual capture after a win)",
    prepare: async () => {
      // Reaching a real victory state requires playing a full game. We
      // capture the arena entry as a placeholder; user replaces with a
      // real victory screenshot from a dev session. Logged so it shows
      // up in the run output.
      console.warn(
        "[capture] victory-state is a placeholder — replace manually with a real victory screenshot from /arena.",
      );
    },
  },
];

async function captureOne(
  page: import("playwright").Page,
  spec: CaptureSpec,
): Promise<void> {
  const url = `${BASE_URL}${spec.path}`;
  console.log(`[capture] ${spec.key} → ${url}  (${spec.label})`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(WAIT_FOR_NETWORK_IDLE_MS);
  await spec.prepare?.(page);
  const outPath = resolve(OUT_DIR, `${spec.key}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`[capture]   wrote ${outPath}`);
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    for (const spec of SPECS) {
      await captureOne(page, spec);
    }
  } finally {
    await context.close();
    await browser.close();
  }
  console.log(`[capture] done — ${SPECS.length} screenshots in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error("[capture] FAILED:", err);
  process.exit(1);
});
