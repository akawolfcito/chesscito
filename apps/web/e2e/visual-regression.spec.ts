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
//  - hub-clean        — anonymous /hub legacy, no overlays. Anchors the
//                       base layout.
//  - hub-daily-tactic — DailyTacticSheet open. Locks Z2/Z3/Z5 + sheet shell.
//                       Date is frozen via page.clock so the puzzle is
//                       deterministic regardless of run date.
//  - hub-shop-sheet   — ShopSheet open from the dock. Anchors Type-B sheet
//                       chrome. Substituted in for the originally-planned
//                       PRO sheet baseline (which requires a wallet fixture
//                       — anonymous mode does not render the Z1 PRO trigger).
//                       hub-pro-sheet-open is documented as a Step 2
//                       carry-forward.
//
// Note (2026-05-09): exercises moved from `/hub?legacy=1` to its own
// canonical `/exercises` route. The 3 baselines below now navigate
// to `/exercises` directly (DOM identical — same <ExercisesScreen>
// component, just different URL).
//
// Note (2026-05-10): `hub-shop-sheet-open` re-enabled. Original
// failure was a race against RainbowKitGate's intentional Fragment→
// Provider remount in `wallet-provider.tsx`. See the per-test comment
// for details.

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
    await page.goto("/exercises", { waitUntil: "load", timeout: 30_000 });
    // Wait for splash to clear so the screenshot captures the resting hub.
    await expect(page.locator(".playhub-intro-overlay")).toBeHidden({
      // 30s covers cold dev-server compile (Next.js first request to a
      // route can take 15-25s) + the bounded ~5s splash (asset preload
      // + non-MiniPay walletReady). Steady-state runs settle in under 5s.
      timeout: 30_000,
    });
    await settle(page, 600);
    await expect(page).toHaveScreenshot("hub-clean.png", HUB_CLEAN_OPTS);
  });

  test("hub-daily-tactic-open — DailyTacticSheet over a deterministic puzzle", async ({
    page,
  }) => {
    await bypassFirstVisit(page);
    await freezeDate(page, FROZEN_DATE);
    await page.goto("/exercises", { waitUntil: "load", timeout: 30_000 });
    await expect(page.locator(".playhub-intro-overlay")).toBeHidden({
      // 30s covers cold dev-server compile (Next.js first request to a
      // route can take 15-25s) + the bounded ~5s splash (asset preload
      // + non-MiniPay walletReady). Steady-state runs settle in under 5s.
      timeout: 30_000,
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

  // Re-enabled 2026-05-10. Prior failure was caused by a synchronous
  // `page.evaluate(() => document.querySelector(...)?.click())` racing
  // RainbowKitGate's intentional Fragment→Provider remount (see
  // `wallet-provider.tsx`). The native click landed in the ~300ms gap
  // when the dock subtree was briefly unmounted and silently no-op'd,
  // leaving the dialog never opened. Fixed by switching to a
  // Playwright locator with auto-wait — same pattern as
  // `hub-daily-tactic-open` above.
  test("hub-shop-sheet-open — ShopSheet from dock (anonymous, no wallet)", async ({
    page,
  }) => {
    await bypassFirstVisit(page);
    await freezeDate(page, FROZEN_DATE);
    await page.goto("/exercises", { waitUntil: "load", timeout: 30_000 });
    await expect(page.locator(".playhub-intro-overlay")).toBeHidden({
      // 30s covers cold dev-server compile (Next.js first request to a
      // route can take 15-25s) + the bounded ~5s splash (asset preload
      // + non-MiniPay walletReady). Steady-state runs settle in under 5s.
      timeout: 30_000,
    });

    // Open Shop via its dock entry. Auto-waiting locator survives the
    // RainbowKitGate remount window that toggled the dock subtree at
    // ~50–350ms post-splash-hide.
    const trigger = page.locator('button[aria-label="Shop"]');
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    await trigger.click();

    const sheet = page.locator('[role="dialog"][data-state="open"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });
    await settle(page, 500);

    await expect(page).toHaveScreenshot(
      "hub-shop-sheet-open.png",
      HUB_SHEET_OPTS,
    );
  });
});

// Step 2 baselines — static legal/info pages. No wallet, no clock,
// no overlay gating. The risk profile is editorial drift: a copy edit
// in SUPPORT_COPY / ABOUT_COPY that accidentally breaks the layout
// (wrap, overflow, icon misalign) would slip through without these.
//
// Both pages use <LegalPageShell> which mounts on the natural background.
// We wait for `document.fonts.ready` (the fantasy-title font on /about
// drives meaningful pixel shifts if it streams in late) and a short
// settle for paper-tray hover transitions to land at rest.
const STATIC_PAGE_OPTS = { maxDiffPixelRatio: 0.005 } as const;

test.describe("visual regression — Step 2 baselines", () => {
  test("support-page — Telegram + Email + GitHub channels", async ({ page }) => {
    await bypassFirstVisit(page);
    await page.goto("/support", { waitUntil: "networkidle", timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 400);
    await expect(page).toHaveScreenshot("support-page.png", STATIC_PAGE_OPTS);
  });

  test("about-page — identity + methodology + cognitive disclaimer", async ({
    page,
  }) => {
    await bypassFirstVisit(page);
    await page.goto("/about", { waitUntil: "networkidle", timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 400);
    await expect(page).toHaveScreenshot("about-page.png", STATIC_PAGE_OPTS);
  });
});
