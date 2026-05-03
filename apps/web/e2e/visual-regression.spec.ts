// CI-gated visual regression. This file uses `expect(page).toHaveScreenshot()`
// to compare against committed baselines under the spec's `-snapshots`
// directory. A diff above the per-test threshold fails the test and
// Playwright writes the diff alongside the baseline.
//
// Updating baselines requires `pnpm test:e2e:visual --update-snapshots`
// AND an explicit "visual change rationale" in the PR body. PRs that
// bump baselines silently are rejected at review.
//
// Step 1 coverage (sprint commit #5): 3 deterministic states. Step 2
// expansion (per-screen) lives in
// docs/reviews/visual-regression-plan-2026-05-02.md.
//
// Why these 3:
//  - hub-clean        — anonymous /hub, no overlays. Anchors the base layout.
//  - hub-daily-tactic — DailyTacticSheet open. Locks Z2/Z3/Z5 + sheet shell.
//                       Date is frozen via page.clock so the puzzle is
//                       deterministic regardless of run date.
//  - hub-shop-sheet   — ShopSheet open from the dock. Anchors Type-B sheet
//                       chrome. Substituted in for the originally-planned
//                       PRO sheet baseline (which requires a wallet fixture
//                       — anonymous mode does not render the Z1 PRO trigger).
//                       hub-pro-sheet-open is documented as a Step 2
//                       carry-forward.

import { test, expect, type Page } from "@playwright/test";

// Frozen UTC midpoint that locks getDailyPuzzle() to a deterministic
// puzzle index regardless of when the test runs. Pinned to a date that
// rotates the seed to a known-valid puzzle (mt-001..mt-007 are all
// validated post-commit-2). Any future change to DAILY_PUZZLES that
// shifts the rotation MUST update this date and re-baseline.
const FROZEN_DATE = new Date("2026-05-02T12:00:00.000Z");

const HUB_CLEAN_OPTS = { maxDiffPixelRatio: 0.005 } as const;
const HUB_SHEET_OPTS = { maxDiffPixelRatio: 0.01 } as const;

async function bypassFirstVisit(page: Page): Promise<void> {
  // Values match the existing canary specs (contextual-header.spec.ts,
  // global-status-bar.spec.ts). welcome-dismissed is "1", not "true" —
  // the overlay reads the literal "1".
  await page.addInitScript(() => {
    window.localStorage.setItem("chesscito:onboarded", "true");
    window.localStorage.setItem("chesscito:welcome-dismissed", "1");
  });
}

async function freezeDate(page: Page, date: Date): Promise<void> {
  // Lock Date constructors and Date.now() so getDailyPuzzle's todayUtc()
  // returns the same string on every run. Playwright's clock API is the
  // canonical way to do this without injecting test hooks into product code.
  await page.clock.install({ time: date });
}

async function settle(page: Page, ms: number = 400): Promise<void> {
  // Conservative wait for Radix Sheet open animation + any single-frame
  // settling. 400ms covers enter animations (300ms) plus a margin.
  await page.waitForTimeout(ms);
}

test.describe("visual regression — Step 1 baselines", () => {
  test("hub-clean — anonymous /hub, no overlays", async ({ page }) => {
    await bypassFirstVisit(page);
    await freezeDate(page, FROZEN_DATE);
    await page.goto("/hub", { waitUntil: "load", timeout: 30_000 });
    // Wait for splash to clear so the screenshot captures the resting hub.
    await expect(page.locator(".playhub-intro-overlay")).toBeHidden({
      timeout: 15_000,
    });
    await settle(page, 600);
    await expect(page).toHaveScreenshot("hub-clean.png", HUB_CLEAN_OPTS);
  });

  test("hub-daily-tactic-open — DailyTacticSheet over a deterministic puzzle", async ({
    page,
  }) => {
    await bypassFirstVisit(page);
    await freezeDate(page, FROZEN_DATE);
    await page.goto("/hub", { waitUntil: "load", timeout: 30_000 });
    await expect(page.locator(".playhub-intro-overlay")).toBeHidden({
      timeout: 15_000,
    });

    // Open the Daily Tactic from its slot. The slot exposes its trigger
    // via aria-label "Daily Tactic" (driven by editorial copy).
    const trigger = page.getByRole("button", { name: /Daily Tactic/i }).first();
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    await trigger.click();

    // Wait for the sheet to mount (Radix Sheet flips data-state="open").
    const sheet = page.locator('[data-testid="daily-tactic-sheet"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });
    await settle(page, 500);

    await expect(page).toHaveScreenshot(
      "hub-daily-tactic-open.png",
      HUB_SHEET_OPTS,
    );
  });

  test("hub-shop-sheet-open — ShopSheet from dock (anonymous, no wallet)", async ({
    page,
  }) => {
    await bypassFirstVisit(page);
    await freezeDate(page, FROZEN_DATE);
    await page.goto("/hub", { waitUntil: "load", timeout: 30_000 });
    await expect(page.locator(".playhub-intro-overlay")).toBeHidden({
      timeout: 15_000,
    });

    // Open Shop via its dock entry. Same selector pattern as the existing
    // visual-capture suite uses for sheet captures.
    await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Shop"]');
      if (btn) (btn as HTMLElement).click();
    });

    const sheet = page.locator('[role="dialog"][data-state="open"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });
    await settle(page, 500);

    await expect(page).toHaveScreenshot(
      "hub-shop-sheet-open.png",
      HUB_SHEET_OPTS,
    );
  });
});
