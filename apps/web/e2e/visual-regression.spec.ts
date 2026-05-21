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

// Step 3 baselines — fixture-driven component isolation. Backed by the
// /dev/* routes added 2026-05-21 (see apps/web/src/app/dev/). Each
// fixture mounts a single primitive with controlled props so we can
// lock the visual contract of states that require either a real wallet
// (VR-8) or in-flight async work (VR-5, VR-7) to reach via the natural
// flow. The /dev/* routes 404 in production (NODE_ENV gate).
//
// VR coverage notes:
//  - VR-5 (TxProgressSteps pills × 4 step states) — mint-victory flow.
//    Locks the visual contract of the pills variant that the Victory
//    mint surface will adopt. Captures sign / send / wait / done. The
//    "failed" terminal is captured separately for the error chrome.
//  - VR-7 (PersistOverlay × 2 states) — persisting (toast) + failed
//    (warning + Retry/Dismiss). idle/dismissed render null, no baseline.
//  - VR-8 (/coach/history mixed-chronological with Analyze chip) —
//    1 analyzed entry + 2 unanalyzed entries; /api/coach/history and
//    /api/games are mocked via page.route() with deterministic seed.
//
// First-pass coverage is minipay viewport only. Desktop deferred until
// the harness proves stable.
const FIXTURE_OPTS = { maxDiffPixelRatio: 0.01 } as const;

// Mocks for VR-8. The page fetches both endpoints in parallel; the
// seed shape mirrors CoachAnalysisRecord + GameRecord from
// apps/web/src/lib/coach/types.ts. The wallet param comes from the
// fixture (/dev/coach-history); these mocks accept any wallet value
// since the page.route() glob matches by path only.
const FROZEN_NOW_MS = new Date("2026-05-02T12:00:00.000Z").getTime();

const SEED_GAMES = [
  {
    gameId: "11111111-1111-4111-8111-111111111111",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"],
    result: "win" as const,
    difficulty: "medium" as const,
    totalMoves: 38,
    elapsedMs: 4 * 60_000,
    timestamp: FROZEN_NOW_MS - 2 * 60 * 60_000, // 2h ago
  },
  {
    gameId: "22222222-2222-4222-8222-222222222222",
    moves: ["d4", "d5"],
    result: "lose" as const,
    difficulty: "hard" as const,
    totalMoves: 22,
    elapsedMs: 3 * 60_000,
    timestamp: FROZEN_NOW_MS - 24 * 60 * 60_000, // 1d ago
  },
  {
    gameId: "33333333-3333-4333-8333-333333333333",
    moves: ["e4"],
    result: "draw" as const,
    difficulty: "easy" as const,
    totalMoves: 65,
    elapsedMs: 7 * 60_000,
    timestamp: FROZEN_NOW_MS - 3 * 24 * 60 * 60_000, // 3d ago
  },
];

const SEED_ANALYSES = [
  {
    gameId: SEED_GAMES[0].gameId,
    provider: "server" as const,
    model: "deepseek-chat",
    analysisVersion: "v1",
    createdAt: FROZEN_NOW_MS - 2 * 60 * 60_000,
    response: {
      kind: "full" as const,
      summary: "Solid Italian opening; lost the thread in the middlegame.",
      mistakes: [
        {
          moveNumber: 14,
          played: "Nxe5",
          better: "Bxc6",
          explanation: "Forfeits the bishop pair without compensation.",
        },
      ],
      lessons: ["Trade pieces only when you gain structure or tempo."],
      praise: ["Confident opening principles."],
    },
    game: SEED_GAMES[0],
  },
];

test.describe("visual regression — Step 3 fixture-driven baselines", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "darwin-only baselines");

  test("vr5-mint-pills-sign — pills variant, current=sign", async ({ page }) => {
    await page.goto(
      "/dev/tx-progress?variant=pills&flow=mint-victory&steps=sign,send,wait&current=sign",
      { waitUntil: "load", timeout: 45_000 },
    );
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 400);
    await expect(page).toHaveScreenshot("vr5-mint-pills-sign.png", FIXTURE_OPTS);
  });

  test("vr5-mint-pills-send — pills variant, current=send", async ({ page }) => {
    await page.goto(
      "/dev/tx-progress?variant=pills&flow=mint-victory&steps=sign,send,wait&current=send",
      { waitUntil: "load", timeout: 45_000 },
    );
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 400);
    await expect(page).toHaveScreenshot("vr5-mint-pills-send.png", FIXTURE_OPTS);
  });

  test("vr5-mint-pills-wait — pills variant, current=wait", async ({ page }) => {
    await page.goto(
      "/dev/tx-progress?variant=pills&flow=mint-victory&steps=sign,send,wait&current=wait",
      { waitUntil: "load", timeout: 45_000 },
    );
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 400);
    await expect(page).toHaveScreenshot("vr5-mint-pills-wait.png", FIXTURE_OPTS);
  });

  test("vr5-mint-pills-done — pills variant, current=done (pre-unmount)", async ({
    page,
  }) => {
    // The primitive holds the "done" terminal for 1500ms before
    // self-unmounting. Settling at 300ms captures the held state.
    await page.goto(
      "/dev/tx-progress?variant=pills&flow=mint-victory&steps=sign,send,wait&current=done",
      { waitUntil: "load", timeout: 45_000 },
    );
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 300);
    await expect(page).toHaveScreenshot("vr5-mint-pills-done.png", FIXTURE_OPTS);
  });

  test("vr6-save-toast-wait — toast variant, save-score flow, current=wait", async ({
    page,
  }) => {
    // Toast variant is what the SAVE button adopts on click (Cluster C).
    // Single-line banner, ~40-50px tall. Locks the chrome that the Save
    // flow expects to render alongside the existing CTA row.
    await page.goto(
      "/dev/tx-progress?variant=toast&flow=save-score&steps=wait&current=wait",
      { waitUntil: "load", timeout: 45_000 },
    );
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 400);
    await expect(page).toHaveScreenshot("vr6-save-toast-wait.png", FIXTURE_OPTS);
  });

  test("vr7-persist-overlay-persisting — saving-match toast", async ({ page }) => {
    await page.goto("/dev/persist-overlay?state=persisting", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 400);
    await expect(page).toHaveScreenshot(
      "vr7-persist-overlay-persisting.png",
      FIXTURE_OPTS,
    );
  });

  test("vr7-persist-overlay-failed — warning row with Retry/Dismiss", async ({
    page,
  }) => {
    await page.goto("/dev/persist-overlay?state=failed", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 400);
    await expect(page).toHaveScreenshot(
      "vr7-persist-overlay-failed.png",
      FIXTURE_OPTS,
    );
  });

  test("vr8-coach-history-mixed — 1 analyzed + 2 unanalyzed entries", async ({
    page,
  }) => {
    // Freeze Date.now() so relative timestamps ("2h ago" / "1d ago" / "3d ago")
    // stay deterministic regardless of run date.
    await page.clock.install({ time: new Date(FROZEN_NOW_MS) });

    await page.route("**/api/coach/history**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SEED_ANALYSES),
      });
    });
    await page.route("**/api/games**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SEED_GAMES),
      });
    });

    await page.goto("/dev/coach-history?credits=3", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    // Allow the parallel fetch + state update + telemetry latch effect
    // to settle. The component flips loading false on Promise.all resolve.
    await settle(page, 600);
    await expect(page).toHaveScreenshot(
      "vr8-coach-history-mixed.png",
      FIXTURE_OPTS,
    );
  });
});
