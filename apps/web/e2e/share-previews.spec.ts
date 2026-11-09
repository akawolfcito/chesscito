import { test, expect } from "@playwright/test";

/**
 * Visual captures for surfaces migrated in Commit V and for the
 * Duolingo-style ShareModal (portrait 1080×1350 OG card + candy
 * bottom sheet). These cover the flows that the main visual spec
 * can't reach without user interaction.
 */

const SNAPSHOT_DIR = "e2e-results/snapshots";

test.describe("Share + migrated-surface previews", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("chesscito:onboarded", "true");
    });
  });

  test("share modal — invite from play-hub (board context)", async ({ page }) => {
    await page.goto("/", { waitUntil: "load", timeout: 30_000 });
    await expect(page.locator(".playhub-intro-overlay")).toBeHidden({ timeout: 15_000 });

    // Tap the dock invite button (aria-label matches INVITE_COPY.button = "Invite").
    await page.getByRole("button", { name: "Invite" }).click();

    // The ShareModal is a role=dialog with aria-label "Invite".
    const modal = page.getByRole("dialog", { name: "Invite" });
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Wait for the OG card <img> to finish loading so the preview is real
    // and not a spinner. onLoad flips the internal imgLoaded state, but we
    // key on naturalWidth > 0 which is what the browser reports after load.
    // Soft-wait: give the OG endpoint up to 30s, but if Satori is slow
    // on cold-start we still capture the loading spinner state rather
    // than flaking the test.
    await page.waitForFunction(() => {
      const img = document.querySelector('img[alt="Share preview"]') as HTMLImageElement | null;
      return Boolean(img && img.complete && img.naturalWidth > 0);
    }, { timeout: 30_000 }).catch(() => {
      /* timeout — proceed with whatever is painted */
    });

    await page.screenshot({
      path: `${SNAPSHOT_DIR}/share-modal-invite.png`,
      fullPage: true,
    });
  });

  test("share modal — badge earned variant", async ({ page }) => {
    // Pre-seed rook progress so a single exercise completion triggers badge.
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "chesscito:progress:rook",
        JSON.stringify({ piece: "rook", exerciseIndex: 4, stars: [3, 3, 3, 3, 0] })
      );
    });

    await page.goto("/", { waitUntil: "load", timeout: 30_000 });
    await expect(page.locator(".playhub-intro-overlay")).toBeHidden({ timeout: 15_000 });

    // rook-5 winning path.
    await page.getByRole("gridcell", { name: "Square h8" }).click();
    await page.getByRole("gridcell", { name: "Square h3" }).click();
    await page.waitForTimeout(250);
    await page.getByRole("gridcell", { name: "Square h3" }).click();
    await page.getByRole("gridcell", { name: "Square b3" }).click();

    await expect(page.getByText("Badge Earned", { exact: true })).toBeVisible({
      timeout: 5_000,
    });

    // The Share button is inside the BadgeEarnedPrompt CandyGlassShell.
    await page.getByRole("button", { name: "Share", exact: true }).click();

    const modal = page.getByRole("dialog", { name: "Share" });
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Soft-wait: give the OG endpoint up to 30s, but if Satori is slow
    // on cold-start we still capture the loading spinner state rather
    // than flaking the test.
    await page.waitForFunction(() => {
      const img = document.querySelector('img[alt="Share preview"]') as HTMLImageElement | null;
      return Boolean(img && img.complete && img.naturalWidth > 0);
    }, { timeout: 30_000 }).catch(() => {
      /* timeout — proceed with whatever is painted */
    });

    await page.screenshot({
      path: `${SNAPSHOT_DIR}/share-modal-badge.png`,
      fullPage: true,
    });
  });

  test("arena loss modal (resign path)", async ({ page }) => {
    // Seed a mid-game save so we land directly on the board, then click
    // the Resign button twice (first arms confirm, second commits) to
    // flip game.status → "resigned" and surface the loss modal.
    //
    // Black-to-move defensive position — player has legal moves but we
    // never make any; resign is immediate once armed.
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "chesscito:arena-game",
        JSON.stringify({
          fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
          difficulty: "easy",
          playerColor: "b",
          moveHistory: ["e4"],
          moveCount: 1,
          elapsedMs: 3000,
          savedAt: Date.now(),
        })
      );
    });

    await page.goto("/arena", { waitUntil: "load", timeout: 30_000 });
    await page.waitForTimeout(1_500); // let the board + action bar settle

    // Resign is a two-tap confirm. First click arms the confirm state,
    // second click finalizes. Both land on the same button.
    const resign = page.getByRole("button", { name: /resign/i }).first();
    await resign.click();
    await page.waitForTimeout(200);
    await resign.click();

    const loss = page.getByRole("alert").filter({ hasText: /resigned|ai wins|draw|stalemate/i });
    await expect(loss).toBeVisible({ timeout: 10_000 });

    await page.screenshot({
      path: `${SNAPSHOT_DIR}/arena-loss-modal.png`,
      fullPage: true,
    });
  });
});
