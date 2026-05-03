// Artifact capture only. This file does NOT assert visual regressions.
// Use `e2e/visual-regression.spec.ts` for CI-gated screenshot assertions
// (`expect(page).toHaveScreenshot()`).
//
// This suite writes raw PNGs to e2e-results/snapshots/ for manual PR review.
// CI runs the regression spec instead. See
// docs/reviews/visual-regression-plan-2026-05-02.md for the rollout plan.

import { test, expect } from "@playwright/test";

const SNAPSHOT_DIR = "e2e-results/snapshots";

// Pages to capture. After the URL split, "/" is the public landing
// (snapshotted as `landing`) and "/hub" is the canonical play-hub
// URL (snapshotted as `play-hub`). The legacy /why path now redirects
// to / and is no longer captured.
const PAGES = [
  { path: "/", name: "landing" },
  { path: "/hub", name: "play-hub" },
  { path: "/arena", name: "arena" },
  { path: "/about", name: "about" },
  // Victory #1 — first on-chain mint on Celo mainnet. If the contract
  // read fails locally (missing NEXT_PUBLIC_VICTORY_NFT_ADDRESS), the
  // page hits notFound() and we still capture the migrated 404 chrome.
  { path: "/victory/1", name: "victory-page" },
];

// Bottom sheets opened from the play-hub dock
const SHEETS = [
  { label: "Badges", name: "sheet-badges" },
  { label: "Shop", name: "sheet-shop" },
  { label: "Trophies", name: "sheet-trophies" },
  { label: "Leaderboard", name: "sheet-leaderboard" },
];

async function waitForPlayHub(page: import("@playwright/test").Page) {
  await page.goto("/hub", { waitUntil: "load", timeout: 30_000 });
  // Wait for splash to disappear (assets loaded + wallet ready)
  await expect(page.locator(".playhub-intro-overlay")).toBeHidden({ timeout: 15_000 });
}

for (const pg of PAGES) {
  test(`snapshot: ${pg.name}`, async ({ page }) => {
    if (pg.path === "/hub") {
      await waitForPlayHub(page);
    } else {
      await page.goto(pg.path, { waitUntil: "load", timeout: 30_000 });
      await page.waitForTimeout(2_000);
    }
    await page.screenshot({ path: `${SNAPSHOT_DIR}/${pg.name}.png`, fullPage: true });
  });
}

for (const sheet of SHEETS) {
  test(`snapshot: ${sheet.name}`, async ({ page }) => {
    await waitForPlayHub(page);

    // Click the dock trigger (use JS click to bypass img pointer interception)
    await page.evaluate((label) => {
      const btn = document.querySelector(`button[aria-label="${label}"]`);
      if (btn) (btn as HTMLElement).click();
    }, sheet.label);

    // Wait for the Radix sheet to appear (not the mission briefing dialog)
    const sheetContent = page.locator('[role="dialog"][data-state="open"]');
    await expect(sheetContent).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(600);

    await page.screenshot({ path: `${SNAPSHOT_DIR}/${sheet.name}.png`, fullPage: true });
  });
}
