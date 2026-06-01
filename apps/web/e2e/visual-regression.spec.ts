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

    // Wait for the on-chain catalog read (`useReadContracts` →
    // `getItem`) to resolve. Until it does, every buy pill renders
    // its "Coming soon" copy; once resolved it flips to the USD
    // price label (`formatUsd(...)` → `$X.XX`). Snapshotting in
    // between produced the 2026-05-30 flake — see handoff and
    // `use-shop-sheet-state.ts:211-254`.
    //
    // Filter out the WelcomePackTile (pinned at the top of the
    // catalog as of 2026-05-31) — its buy pill renders "Connect
    // to claim" / "Claim free" rather than a USD price, so we
    // wait specifically for the FIRST regular SKU pill instead.
    await expect(
      page
        .locator(".shop-item-tile:not(.welcome-pack-tile) .shop-item-tile-buy-pill--green")
        .first(),
    ).toContainText("$", { timeout: 10_000 });
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

  // 2026-05-30: legal page baselines added to cover the em-dash sweep
  // pass on these surfaces (chunks 8-12). Pairs with about/support so
  // the LegalPageShell family is locked end-to-end.
  test("terms-page — Terms of Service body + footer", async ({ page }) => {
    await bypassFirstVisit(page);
    await page.goto("/terms", { waitUntil: "networkidle", timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 400);
    await expect(page).toHaveScreenshot("terms-page.png", STATIC_PAGE_OPTS);
  });

  test("privacy-page — Privacy Policy body + footer", async ({ page }) => {
    await bypassFirstVisit(page);
    await page.goto("/privacy", { waitUntil: "networkidle", timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 400);
    await expect(page).toHaveScreenshot("privacy-page.png", STATIC_PAGE_OPTS);
  });

  // Landing tagline first-fold. The route SSR-redirects MiniPay UAs to
  // /hub via `detectWalletFromUserAgent`; Playwright's default Pixel 5
  // UA does NOT include "MiniPay", so the redirect doesn't fire and the
  // landing renders. The client-side `useMiniPay` fallback also stays
  // false because the browser has no `window.ethereum.isMinipay`. Closes
  // the em-dash chunks 8-12 coverage gap for `/`.
  test("landing-page — tagline + hero first-fold", async ({ page }) => {
    await bypassFirstVisit(page);
    await page.goto("/", { waitUntil: "networkidle", timeout: 30_000 });
    // Sanity: confirm we did not get redirected to /hub.
    await expect(page).toHaveURL(/\/(?:en|es)?\/?$/);
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 400);
    await expect(page).toHaveScreenshot("landing-page.png", STATIC_PAGE_OPTS);
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

  // vr9 — Arena end-state popups (Sally polish 2026-05-27). Baselines the
  // win-* claim flow + the resigned loss popup that the win popups mirror.
  // Each variant renders via /dev/arena-end-state. Animations (sparkles
  // lottie, trophy lottie) are not loop:true on these states, so the
  // settle() wait captures the held final frame.
  test("vr9-arena-end-state-resigned — loss popup reference", async ({ page }) => {
    await page.goto("/dev/arena-end-state?variant=resigned", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr9-arena-end-state-resigned.png",
      FIXTURE_OPTS,
    );
  });

  // 2026-05-30: loss/draw variants added to lock the remaining
  // ArenaEndState terminal branches that the em-dash sweep (chunks 8-12)
  // touched. The win-* family was already covered; these three close the
  // matrix so any future copy or layout drift surfaces here instead of in
  // production.
  test("vr9-arena-end-state-checkmate — opponent mates the player", async ({
    page,
  }) => {
    await page.goto("/dev/arena-end-state?variant=checkmate", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr9-arena-end-state-checkmate.png",
      FIXTURE_OPTS,
    );
  });

  test("vr9-arena-end-state-stalemate — draw by stalemate", async ({ page }) => {
    await page.goto("/dev/arena-end-state?variant=stalemate", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr9-arena-end-state-stalemate.png",
      FIXTURE_OPTS,
    );
  });

  test("vr9-arena-end-state-draw — agreed draw", async ({ page }) => {
    await page.goto("/dev/arena-end-state?variant=draw", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr9-arena-end-state-draw.png",
      FIXTURE_OPTS,
    );
  });

  test("vr9-arena-end-state-win-celebration — Save Victory + Coach section", async ({
    page,
  }) => {
    await page.goto("/dev/arena-end-state?variant=win-celebration", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr9-arena-end-state-win-celebration.png",
      FIXTURE_OPTS,
    );
  });

  test("vr9-arena-end-state-win-claiming — TX in flight", async ({ page }) => {
    await page.goto("/dev/arena-end-state?variant=win-claiming", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr9-arena-end-state-win-claiming.png",
      FIXTURE_OPTS,
    );
  });

  test("vr9-arena-end-state-win-success — Victory Saved", async ({ page }) => {
    await page.goto("/dev/arena-end-state?variant=win-success", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr9-arena-end-state-win-success.png",
      FIXTURE_OPTS,
    );
  });

  test("vr9-arena-end-state-win-error — TX failed", async ({ page }) => {
    await page.goto("/dev/arena-end-state?variant=win-error", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr9-arena-end-state-win-error.png",
      FIXTURE_OPTS,
    );
  });

  test("vr9-arena-end-state-win-cancelled — user cancelled (paused)", async ({
    page,
  }) => {
    await page.goto("/dev/arena-end-state?variant=win-cancelled", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr9-arena-end-state-win-cancelled.png",
      FIXTURE_OPTS,
    );
  });

  test("vr9-arena-end-state-win-timeout — still confirming (hang tight)", async ({
    page,
  }) => {
    await page.goto("/dev/arena-end-state?variant=win-timeout", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr9-arena-end-state-win-timeout.png",
      FIXTURE_OPTS,
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // #119 — VR10 coach-viewer surface (`/coach/[gameId]` post-game review).
  //
  // Locks the GameViewer (board + slider + SAN list + partial-replay banner)
  // + GameActionsBar (result-aware CTA matrix). Mounts both via a fixture
  // under /dev/coach-viewer/ — no wagmi / no server fetch, deterministic
  // moves drive useGameReplay.
  //
  // Coverage: 4 variants × minipay viewport. Desktop deferred — minipay is
  // the production target per `feedback_vr_baseline_discipline.md`.
  // ──────────────────────────────────────────────────────────────────────────

  test("vr10-coach-viewer-win-unminted — Ask Coach + Mint Victory + Play Again", async ({
    page,
  }) => {
    await page.goto("/dev/coach-viewer?variant=viewer-win-unminted", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 600);
    await expect(page).toHaveScreenshot(
      "vr10-coach-viewer-win-unminted.png",
      FIXTURE_OPTS,
    );
  });

  test("vr10-coach-viewer-win-minted — Ask Coach Again + View NFT + Share + Play Again", async ({
    page,
  }) => {
    await page.goto("/dev/coach-viewer?variant=viewer-win-minted", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 600);
    await expect(page).toHaveScreenshot(
      "vr10-coach-viewer-win-minted.png",
      FIXTURE_OPTS,
    );
  });

  test("vr10-coach-viewer-loss — Ask Coach + Play Again (no mint surface)", async ({
    page,
  }) => {
    await page.goto("/dev/coach-viewer?variant=viewer-loss", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 600);
    await expect(page).toHaveScreenshot(
      "vr10-coach-viewer-loss.png",
      FIXTURE_OPTS,
    );
  });

  test("vr10-coach-viewer-partial-replay — illegal SAN surfaces error banner + disabled Ask Coach", async ({
    page,
  }) => {
    await page.goto("/dev/coach-viewer?variant=viewer-partial-replay", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 600);
    await expect(page).toHaveScreenshot(
      "vr10-coach-viewer-partial-replay.png",
      FIXTURE_OPTS,
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // #2 hint-variant baselines — point-of-use hints under the Ask Coach tile.
  //
  // Locks the two hint states GameActionsBar renders when the wallet has
  // either paid credits (`coachCredits > 0`) or an active PRO pass
  // (`proActive=true`). Both share the win-unminted base so the Ask Coach
  // tile is reachable and the hint actually renders.
  // ──────────────────────────────────────────────────────────────────────────

  test("vr10-coach-viewer-win-credits-hint — Uses 1 credit · N left under Ask Coach", async ({
    page,
  }) => {
    await page.goto("/dev/coach-viewer?variant=viewer-win-credits-hint", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 600);
    await expect(page).toHaveScreenshot(
      "vr10-coach-viewer-win-credits-hint.png",
      FIXTURE_OPTS,
    );
  });

  test("vr10-coach-viewer-win-pro-hint — Unlimited · PRO active under Ask Coach", async ({
    page,
  }) => {
    await page.goto("/dev/coach-viewer?variant=viewer-win-pro-hint", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 600);
    await expect(page).toHaveScreenshot(
      "vr10-coach-viewer-win-pro-hint.png",
      FIXTURE_OPTS,
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // VR11 — Arena shields chip.
  //
  // Locks the point-of-use shields callout that arena renders under the HUD
  // when the wallet has shields ready. `useShieldsCount()` reads from
  // `chesscito:shields:credited-cache`; we seed it via addInitScript before
  // navigation so the chip mounts with a known count > 0. The fixture mounts
  // the chip in isolation (no wagmi) so the baseline locks only the chip's
  // intrinsic pixels.
  // ──────────────────────────────────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────────────────────
  // VR12 — Hub PRO chip (active + inactive variants).
  //
  // HubProBadge already takes its truth as props (no wagmi inside), so the
  // fixture just controls `active` + `daysLabel`. Locks the panel-pro art
  // + the active vs inactive subline swap.
  // ──────────────────────────────────────────────────────────────────────────

  test("vr12-pro-chip-active — PRO active, 7 days remaining", async ({
    page,
  }) => {
    await page.goto("/dev/pro-chip?variant=active", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 600);
    await expect(page).toHaveScreenshot(
      "vr12-pro-chip-active.png",
      FIXTURE_OPTS,
    );
  });

  test("vr12-pro-chip-inactive — discovery state with promo subline", async ({
    page,
  }) => {
    await page.goto("/dev/pro-chip?variant=inactive", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 600);
    await expect(page).toHaveScreenshot(
      "vr12-pro-chip-inactive.png",
      FIXTURE_OPTS,
    );
  });

  test("vr11-arena-shields-chip — 3 shields available, in-play state", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem(
          "chesscito:shields:credited-cache",
          "3",
        );
      } catch {
        /* storage unavailable — chip falls back to count=0 (off state) */
      }
    });
    await page.goto("/dev/arena-shields-chip", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 600);
    await expect(page).toHaveScreenshot(
      "vr11-arena-shields-chip.png",
      FIXTURE_OPTS,
    );
  });

  /* vr12 — Fail Rescue Modal (4 variants) — spec section 3.3 state
     matrix. Standalone fixture at /dev/rescue-modal renders the
     modal over a PhaseFlash-equivalent scrim. Commit 10 of shield-
     rescue cluster. */

  test("vr12-rescue-modal-a — with-shields, first encounter (primer)", async ({
    page,
  }) => {
    await page.goto("/dev/rescue-modal?variant=A&shields=8", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 400);
    await expect(page).toHaveScreenshot(
      "vr12-rescue-modal-a.png",
      FIXTURE_OPTS,
    );
  });

  test("vr12-rescue-modal-b — with-shields, recurring (compact)", async ({
    page,
  }) => {
    await page.goto("/dev/rescue-modal?variant=B&shields=2", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 400);
    await expect(page).toHaveScreenshot(
      "vr12-rescue-modal-b.png",
      FIXTURE_OPTS,
    );
  });

  test("vr12-rescue-modal-c — without-shields, pre-claim (welcome pitch)", async ({
    page,
  }) => {
    await page.goto("/dev/rescue-modal?variant=C&shields=0", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 400);
    await expect(page).toHaveScreenshot(
      "vr12-rescue-modal-c.png",
      FIXTURE_OPTS,
    );
  });

  test("vr12-rescue-modal-d — without-shields, post-claim (paid upsell)", async ({
    page,
  }) => {
    await page.goto("/dev/rescue-modal?variant=D&shields=0", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 400);
    await expect(page).toHaveScreenshot(
      "vr12-rescue-modal-d.png",
      FIXTURE_OPTS,
    );
  });
});
