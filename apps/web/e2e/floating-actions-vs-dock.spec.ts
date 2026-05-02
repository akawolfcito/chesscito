import { test, expect, type Page } from "@playwright/test";

/**
 * Floating actions vs dock destinations.
 *
 * Background: an earlier visual audit assumed the trophy floating
 * button on the play-hub was a duplicate of the dock Trophies
 * destination and recommended deleting it. Manual validation showed
 * the trophy floating button actually opens the Mini Arena bridge
 * (K+R vs K endgame challenge) — a completely different surface.
 *
 * This spec locks in that distinction so a future "let's tidy up
 * the floating buttons" PR can't silently delete a feature.
 *
 * Regression target:
 *   - Trophy floating (MiniArenaBridgeSlot) opens the K+R vs K sheet,
 *     NOT the dock Trophies sheet.
 *   - Daily Tactic (DailyTacticSlot) opens its own Type-B sheet.
 *   - The dock Trophies destination opens the trophies sheet, NOT
 *     the mini-arena sheet.
 *
 * Source-of-truth references:
 *   - apps/web/src/app/hub/page.tsx                     (route mounts PlayHubRoot)
 *   - apps/web/src/components/play-hub/play-hub-root.tsx:1162-1183
 *   - apps/web/src/components/mini-arena/mini-arena-bridge-slot.tsx
 *   - apps/web/src/components/daily/daily-tactic-slot.tsx
 *   - apps/web/src/lib/game/mini-arena.ts                (K+R vs K setup)
 *   - apps/web/src/hooks/use-splash-loader.ts            (chesscito:onboarded key)
 *   - apps/web/src/hooks/use-exercise-progress.ts        (chesscito:progress:* shape)
 *
 * Audit doc: docs/reviews/ui-floating-actions-functional-audit-2026-05-01.md
 */

const HUB_ROUTE = "/hub";

/** Skip the splash + first-visit briefing AND the 3-card welcome overlay so
 *  the play-hub mounts straight to the interactive surface. Mirrors the
 *  localStorage flags written by:
 *   - `useSplashLoader.markOnboarded()` → `chesscito:onboarded = "true"`
 *   - `dismissWelcome()`               → `chesscito:welcome-dismissed = "1"` */
async function bypassFirstVisitBriefing(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("chesscito:onboarded", "true");
    window.localStorage.setItem("chesscito:welcome-dismissed", "1");
  });
}

test.describe("Floating actions vs dock — regression contract", () => {
  test("daily-tactic-card opens DailyTacticSheet (not the trophies sheet)", async ({
    page,
  }) => {
    await bypassFirstVisitBriefing(page);
    await page.goto(HUB_ROUTE);
    await page.waitForLoadState("networkidle");

    const dailyCard = page.getByTestId("daily-tactic-card");
    await expect(dailyCard).toBeVisible();

    // The card has two states. Only the "pending" variant is
    // clickable. If we land on a fresh session the state should be
    // pending; if it's completed (e.g., reused storage), skip.
    const state = await dailyCard.getAttribute("data-state");
    test.skip(
      state === "completed",
      "Daily tactic already completed today; skipping click test",
    );

    await dailyCard.click();

    // Daily Tactic sheet opens as a Radix Dialog. Confirm the dialog
    // is up AND that we're not in the K+R vs K surface (which would
    // mean the wrong floating button was wired).
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("mini-arena-sheet")).toHaveCount(0);
  });

  test("dock Trophies opens trophies sheet (not the mini-arena sheet)", async ({
    page,
  }) => {
    await bypassFirstVisitBriefing(page);
    await page.goto(HUB_ROUTE);
    await page.waitForLoadState("networkidle");

    const trophiesDockItem = page.locator('[data-dock-id="trophies"]');
    await expect(trophiesDockItem).toBeVisible();
    await trophiesDockItem.click();

    // Trophies sheet should open. Mini-arena sheet must NOT appear.
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByTestId("mini-arena-sheet")).toHaveCount(0);
  });

  test("trophy floating button (MiniArenaBridgeSlot) is gated and opens K+R vs K when unlocked", async ({
    page,
  }) => {
    // Inject 12 stars on rook progress so the bridge slot's
    // unlock condition (`selectedPiece === "rook" && totalStars >= 12`)
    // is met without playing through the exercises in the test.
    // Storage shape mirrors apps/web/src/hooks/use-exercise-progress.ts.
    await bypassFirstVisitBriefing(page);
    await page.addInitScript(() => {
      const progress = {
        piece: "rook",
        exerciseIndex: 0,
        stars: [3, 3, 3, 3, 0], // total = 12, badge threshold met
      };
      window.localStorage.setItem(
        "chesscito:progress:rook",
        JSON.stringify(progress),
      );
    });

    await page.goto(HUB_ROUTE);
    await page.waitForLoadState("networkidle");

    const bridge = page.getByTestId("mini-arena-bridge");
    await expect(
      bridge,
      "bridge slot must render once rook ≥ 12 stars",
    ).toBeVisible();

    await bridge.click();

    // Mini-arena sheet should be visible AND should NOT be the
    // trophies sheet. We verify the sheet's role + the K+R vs K
    // setup name shows up in the title.
    const sheet = page.getByTestId("mini-arena-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("K+R vs K");

    // Status line should reference the par moves (16 in the
    // K+R vs K setup) — fingerprints this as the right setup.
    const status = sheet.getByTestId("mini-arena-status");
    await expect(status).toContainText("/ 16");
  });

  test("trophy floating button is hidden when not unlocked", async ({ page }) => {
    // Default fresh session: no progress recorded. The bridge slot
    // returns null when unlocked is false.
    await bypassFirstVisitBriefing(page);
    await page.goto(HUB_ROUTE);
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("mini-arena-bridge")).toHaveCount(0);
  });
});
