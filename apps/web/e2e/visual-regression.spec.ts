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
import { decodeFunctionData, encodeFunctionResult, multicall3Abi } from "viem";

import { shopAbi } from "../src/lib/contracts/shop";

// $0.99 in USD-6. Fixed on purpose: the shop baseline must not move when a
// real on-chain price changes, and must not depend on the public RPC being
// reachable from wherever the suite runs.
const STUB_PRICE_USD6 = 990_000n;

/** Answers the shop catalog's `getItem` reads locally.
 *
 *  Without this the test depends on live mainnet: `useReadContracts` calls
 *  the public Celo RPC, so an unreachable network or a repriced SKU turns a
 *  visual baseline red for reasons that have nothing to do with pixels.
 *  wagmi batches the N reads through multicall3 when the chain supports it,
 *  so both shapes are handled — the batched one is detected by decoding, not
 *  by a hand-written selector (hashing a literal is how you get garbage). */
async function stubShopCatalogRpc(page: Page): Promise<void> {
  const itemResult = encodeFunctionResult({
    abi: shopAbi,
    functionName: "getItem",
    result: [STUB_PRICE_USD6, true],
  });

  await page.route(
    (url) => url.hostname !== "localhost" && url.hostname !== "127.0.0.1",
    async (route) => {
      const request = route.request();
      if (request.method() !== "POST") return route.continue();

      let payload: unknown;
      try {
        payload = JSON.parse(request.postData() ?? "");
      } catch {
        return route.continue();
      }

      const answer = (msg: { id?: unknown; method?: string; params?: unknown[] }) => {
        if (msg.method !== "eth_call") {
          return { jsonrpc: "2.0", id: msg.id ?? null, result: "0x" };
        }
        const data = (msg.params?.[0] as { data?: `0x${string}` } | undefined)?.data;
        if (data) {
          try {
            const decoded = decodeFunctionData({ abi: multicall3Abi, data });
            if (decoded.functionName === "aggregate3") {
              const calls = decoded.args?.[0] as readonly unknown[];
              return {
                jsonrpc: "2.0",
                id: msg.id ?? null,
                result: encodeFunctionResult({
                  abi: multicall3Abi,
                  functionName: "aggregate3",
                  result: calls.map(() => ({ success: true, returnData: itemResult })),
                }),
              };
            }
          } catch {
            /* not a multicall — fall through to the direct shape */
          }
        }
        return { jsonrpc: "2.0", id: msg.id ?? null, result: itemResult };
      };

      const body = Array.isArray(payload) ? payload.map(answer) : answer(payload as never);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    },
  );
}

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

  // Re-enabled 2026-05-10. The 2026-05 failure was a synchronous
  // `page.evaluate(() => document.querySelector(...)?.click())` racing a
  // provider remount: the native click landed in a ~300ms gap when the dock
  // subtree was briefly unmounted and silently no-op'd. Fixed by switching to
  // a Playwright locator with auto-wait — same pattern as
  // `hub-daily-tactic-open` above.
  // ⚠️ That remount was RainbowKitGate's, and RainbowKit was DELETED in the
  // P2 JS cluster (2026-06-12, see `wallet-provider.tsx`). The component named
  // in the old comment no longer exists; the auto-waiting locator stays
  // because it is the right pattern, not because that gate is still there.
  //
  // The long-standing red here was NOT this race and NOT a missing treasury:
  // it was an inherited `NEXT_PUBLIC_CHAIN_ID` from the operator's shell.
  // See the `webServer.env` comment in `playwright.config.ts`.
  test("hub-shop-sheet-open — ShopSheet from dock (anonymous, no wallet)", async ({
    page,
  }) => {
    await bypassFirstVisit(page);
    await freezeDate(page, FROZEN_DATE);
    await stubShopCatalogRpc(page);
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

  // The public landing now lives in apps/landing. apps/web owns the root Hub,
  // whose visual baselines are covered above; do not duplicate it here.
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

  // Covers the `--triple` secondary row (Play again + Share + full-width
  // Save again) — the real post-save layout, since production always re-arms
  // `onSaveAgain` for unlimited re-save (#71).
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

  // No win-cancelled screenshot: cancelling no longer has a screen of its own.
  // It leaves win-celebration standing (already covered) and raises a toast that
  // self-dismisses at 3200ms — a timer is a bad subject for a screenshot. The
  // behaviour is pinned in arena-end-state.test.tsx with fake timers instead.

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

  // F8 phase (b) — Save (mint) on the loss/draw/resign popup. A resign with
  // moves>0 surfaces the inline Save tile + its lifecycle (ready / claiming /
  // success toast / error retry row). Coach stays the primary CTA.
  test("vr9-arena-end-state-loss-save — Save match tile on a loss", async ({ page }) => {
    await page.goto("/dev/arena-end-state?variant=loss-save", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr9-arena-end-state-loss-save.png",
      FIXTURE_OPTS,
    );
  });

  test("vr9-arena-end-state-loss-save-claiming — Save TX in flight", async ({ page }) => {
    await page.goto("/dev/arena-end-state?variant=loss-save-claiming", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr9-arena-end-state-loss-save-claiming.png",
      FIXTURE_OPTS,
    );
  });

  test("vr9-arena-end-state-loss-save-success — neutral Saved toast", async ({ page }) => {
    await page.goto("/dev/arena-end-state?variant=loss-save-success", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr9-arena-end-state-loss-save-success.png",
      FIXTURE_OPTS,
    );
  });

  test("vr9-arena-end-state-loss-save-error — inline retry row", async ({ page }) => {
    await page.goto("/dev/arena-end-state?variant=loss-save-error", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr9-arena-end-state-loss-save-error.png",
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

  test("vr10-coach-viewer-loss — Play Again + Save match + Share + Ask Coach (F8)", async ({
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

  // vr13 — Exercises completion popups (2026-06-05 vocabulary migration).
  // Smaller successor to the 8-variant sweep reverted in `120a42e9`. Locks
  // the three end-of-cascade surfaces that now read in the arena-end-state
  // vocabulary: King "All Exercises Complete!" with Choose Piece primary,
  // King labyrinth solved with Enter Arena swap (gated by the
  // `areAllLabyrinthsSolved` helper), and the on-chain Score Saved
  // receipt with the CeloScan chip.
  test("vr13-piece-complete-final — King no-next-piece + Choose primary", async ({
    page,
  }) => {
    await page.goto("/dev/exercises-popups?variant=piece-complete-final", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr13-piece-complete-final.png",
      FIXTURE_OPTS,
    );
  });

  test("vr13-labyrinth-king-solved — Enter Arena primary swap", async ({
    page,
  }) => {
    await page.goto("/dev/exercises-popups?variant=labyrinth-king-solved", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr13-labyrinth-king-solved.png",
      FIXTURE_OPTS,
    );
  });

  /* The consequence line's worst case: personal record AND consequence, the
   * longest of the six lines, on the King finale's two-button stack. Its pair
   * is the variant above, which passes NO consequence — together they are the
   * proof of AC-2 (without one, the overlay does not move) and of AC-11 (with
   * one, the CTA stays in view at 390px). */
  test("vr13-labyrinth-consequence — record + consequence, CTA still in view", async ({
    page,
  }) => {
    await page.goto(
      "/dev/exercises-popups?variant=labyrinth-consequence-worst-case",
      { waitUntil: "load", timeout: 45_000 },
    );
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr13-labyrinth-consequence.png",
      FIXTURE_OPTS,
    );
  });

  // vr13 — SaveScore off-chain (Slice 5). The base save now POSTs
  // /api/scores/save: no tx, no CeloScan chip. Two states: a free save and
  // a paid save (1 Peón past the 5 free saves, cost pill beside the stars).
  test("vr13-score-saved — off-chain free save (no receipt)", async ({
    page,
  }) => {
    await page.goto("/dev/exercises-popups?variant=score-saved", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr13-score-saved.png",
      FIXTURE_OPTS,
    );
  });

  test("vr13-score-saved-peones — off-chain paid save (1 Peón pill)", async ({
    page,
  }) => {
    await page.goto("/dev/exercises-popups?variant=score-saved-peones", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr13-score-saved-peones.png",
      FIXTURE_OPTS,
    );
  });

  // vr14 — ResultOverlay non-score variants (badge / shop / error). These
  // still render through CandyGlassShell pre-migration. The baseline
  // captures the pre-migration state so the upcoming arena-end-state
  // vocabulary migration produces a diff PNG that reads as the before/after.
  test("vr14-result-badge — badge claim celebration", async ({ page }) => {
    await page.goto("/dev/exercises-popups?variant=result-badge", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr14-result-badge.png",
      FIXTURE_OPTS,
    );
  });

  test("vr14-result-shop — shop purchase confirmation", async ({ page }) => {
    await page.goto("/dev/exercises-popups?variant=result-shop", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr14-result-shop.png",
      FIXTURE_OPTS,
    );
  });

  test("vr14-result-error — transaction error with retry", async ({ page }) => {
    await page.goto("/dev/exercises-popups?variant=result-error", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr14-result-error.png",
      FIXTURE_OPTS,
    );
  });

  // vr15 — /victory/[id] public challenge landing. The production page
  // is a server component that fetches from the Celo chain via viem at
  // request time, so direct VR against the live route is flaky
  // (network + token-id dependent). These baselines exercise the same
  // <VictoryLandingCard> shell with static VictoryLandingInfo payloads
  // for the three difficulty tiers, so the layout has CI regression
  // coverage without requiring a live token. Backed by the
  // /dev/victory-landing fixture.
  test("vr15-victory-landing-easy — Complete in 18 moves", async ({ page }) => {
    await page.goto("/dev/victory-landing?variant=easy", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr15-victory-landing-easy.png",
      FIXTURE_OPTS,
    );
  });

  test("vr15-victory-landing-medium — Checkmate in 24 moves", async ({ page }) => {
    await page.goto("/dev/victory-landing?variant=medium", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr15-victory-landing-medium.png",
      FIXTURE_OPTS,
    );
  });

  test("vr15-victory-landing-hard — Checkmate in 51 moves", async ({ page }) => {
    await page.goto("/dev/victory-landing?variant=hard", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr15-victory-landing-hard.png",
      FIXTURE_OPTS,
    );
  });

  // vr16 — arena player rails. Added 2026-07-13 to close a real hole: no
  // baseline in this file reached a `PlayerAvatar`, so a border-radius change
  // to `.player-card-img` (c63b34fc) shipped with all 5107 unit tests and all
  // 50 VR baselines green. The rails are the sole consumer of the redesign
  // PlayerAvatar, so these five lock that surface. Backed by /dev/arena-rails.
  test("vr16-arena-rail-rival-idle — rival rail, not to move", async ({ page }) => {
    await page.goto("/dev/arena-rails?variant=rival-idle", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr16-arena-rail-rival-idle.png",
      FIXTURE_OPTS,
    );
  });

  // The "thinking" Lottie renders to a canvas and never settles, so masking it
  // is the only way to keep this deterministic. The mask still locks the
  // animation's position and footprint — only its current frame is ignored.
  test("vr16-arena-rail-rival-thinking — active rival, thinking anim masked", async ({
    page,
  }) => {
    await page.goto("/dev/arena-rails?variant=rival-thinking", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot("vr16-arena-rail-rival-thinking.png", {
      ...FIXTURE_OPTS,
      mask: [page.locator(".arena-rail-thinking")],
    });
  });

  test("vr16-arena-rail-you-active — player rail, to move, with nickname", async ({
    page,
  }) => {
    await page.goto("/dev/arena-rails?variant=you-active", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr16-arena-rail-you-active.png",
      FIXTURE_OPTS,
    );
  });

  // Both rails stacked: with nickname and without. They must be the SAME
  // height — a visitor session must not shift the board vertically.
  test("vr16-arena-rail-you-no-meta — visitor rail keeps its height", async ({
    page,
  }) => {
    await page.goto("/dev/arena-rails?variant=you-no-meta", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr16-arena-rail-you-no-meta.png",
      FIXTURE_OPTS,
    );
  });

  // PRO is an ornamental PNG frame behind the avatar, never a CSS ring — and
  // it draws on BOTH rails, the rival's included, when the player subscribes.
  test("vr16-arena-rails-pro — ornament frame on both rails", async ({ page }) => {
    await page.goto("/dev/arena-rails?variant=rails-pro", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot(
      "vr16-arena-rails-pro.png",
      FIXTURE_OPTS,
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // vr17 — PLAY hub home. Added 2026-07-13 to close the last big hole.
  //
  // The PLAY hub had NO visual coverage at all. `hub-clean — anonymous /hub`
  // (line 73) navigates to `/exercises`, and every other `hub-*` baseline
  // belongs to LEARN — so the play hub's HUD, mascot, Kingdom panel, PLAY CHESS
  // CTA and CHESS TOOLS dock had never been photographed. The Coach tile lost
  // its PRO badge that same week with 5000+ tests green and nothing watching.
  //
  // Backed by /dev/play-hub, which forced the Peones chip to stop reading the
  // wallet on its own (it called wagmi's useAccount two levels below a scaffold
  // that advertised itself as presentational). The scaffold takes the balance as
  // a prop now, so these are photographs of the hub — not of a Next.js error
  // overlay, which is what the arena rails silently captured first.
  // ──────────────────────────────────────────────────────────────────────────

  test("vr17-play-hub-guest — no wallet: Connect chip, no Peones, PRO locked", async ({
    page,
  }) => {
    await page.goto("/dev/play-hub?variant=guest", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot("vr17-play-hub-guest.png", FIXTURE_OPTS);
  });

  // The Peones chip appears ONLY here. Its absence in the guest shot above and
  // its presence in this one is the pair that locks the wallet gate: a chip that
  // leaks to guests, or vanishes for holders, breaks one of the two images.
  test("vr17-play-hub-connected — wallet, no PRO: Peones chip + trophies", async ({
    page,
  }) => {
    await page.goto("/dev/play-hub?variant=connected", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot("vr17-play-hub-connected.png", FIXTURE_OPTS);
  });

  // PRO flips three things at once, in lockstep: the HUD badge (UNLOCK → 12D),
  // the mascot (wizard → PRO wizard), and the Kingdom panel chip (PRO → PRO
  // active). One of them drifting out of step is invisible to a unit test and
  // obvious in this image.
  test("vr17-play-hub-pro — PRO active: badge, PRO mascot, panel chip", async ({
    page,
  }) => {
    await page.goto("/dev/play-hub?variant=pro", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot("vr17-play-hub-pro.png", FIXTURE_OPTS);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // vr18 — LEARN hub home. The mirror of vr17, unblocked once HubLiteScaffold
  // took `dailySlot` as a prop (its daily tile called wagmi's useAccount, and
  // /dev mounts no provider).
  //
  // /dev/challenge-card already photographs the card as a leaf, one state per
  // section. What had NO coverage is the hub AROUND it: the HUD row, the mascot
  // block, where the card sits in the vertical stack, and the Training Path
  // underneath. The one baseline named after the hub — `hub-clean` — navigates
  // to /exercises.
  //
  // Immune to the catalog by construction: the reward tiles are a literal, not
  // deriveRewardTiles(), which defaults to the shipping EXERCISES catalog and
  // would hand ownership of these photos to the content authors.
  //
  // ⚠️ Tighter than FIXTURE_OPTS on purpose. At the shared 0.01 these photos
  // did NOT notice the metrics row re-flowing from
  //   "12 of 21 Focus Days · 10 days left" / "12-day streak"    to
  //   "12 of 21 Focus Days" / "10 days left · 12-day streak"
  // — a full re-layout of the one row this shot exists to guard came in under
  // 1% of a 390x844 frame, so `--update-snapshots` left the stale baseline in
  // place and the run went green. Text re-flow is a small fraction of a phone
  // screen; a threshold sized for antialiasing cannot see it.
  // ──────────────────────────────────────────────────────────────────────────

  const LEARN_HUB_OPTS = { maxDiffPixelRatio: 0.002 } as const;

  test("vr18-learn-hub-guest — no wallet: Connect chip, no Peones, card in offer", async ({
    page,
  }) => {
    await page.goto("/dev/learn-hub?variant=guest", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot("vr18-learn-hub-guest.png", LEARN_HUB_OPTS);
  });

  // The widest ordinary case, and the reason this shot exists: progress,
  // countdown and streak are three different two-digit numbers on ONE row at
  // 390px. A unit test reads each of them and sees nothing when they collide.
  test("vr18-learn-hub-active — 12 of 21, 10 days left, streak 12", async ({
    page,
  }) => {
    await page.goto("/dev/learn-hub?variant=active", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot("vr18-learn-hub-active.png", LEARN_HUB_OPTS);
  });

  // PRO reaches the challenge without buying a window, so no countdown renders
  // at all — the crowned badge is the single place that says why. A number
  // appearing here would read as an expired pass to a subscriber who has none.
  // The finished 21-day challenge. This state used to spend the CTA slot
  // announcing itself, and `completed` is terminal — so the most committed
  // player lost their next action permanently. The shot proves both halves of
  // the fix at once: the chip says COMPLETED, and the slot still offers work.
  test("vr18-learn-hub-completed — chip says COMPLETED and the CTA still offers work", async ({
    page,
  }) => {
    await page.goto("/dev/learn-hub?variant=completed", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot("vr18-learn-hub-completed.png", LEARN_HUB_OPTS);
  });

  test("vr18-learn-hub-pro — unbounded window: the crowned badge, and no countdown", async ({
    page,
  }) => {
    await page.goto("/dev/learn-hub?variant=pro", {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 800);
    await expect(page).toHaveScreenshot("vr18-learn-hub-pro.png", LEARN_HUB_OPTS);
  });
});
