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

  test("arena loss modal (forced via invalid fen restore)", async ({ page }) => {
    // Seed a saved arena game where it's the player's turn in a hopeless
    // state — fastest path to surface the loss modal without playing a
    // full AI match. Forces status to "checkmate" against the player by
    // hand-setting the useChessGame persistence payload the hook rehydrates.
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "chesscito:arena-game",
        JSON.stringify({
          fen: "4k3/4Q3/4K3/8/8/8/8/8 b - - 0 1", // black king mated by white queen
          difficulty: "easy",
          playerColor: "b",
          moveHistory: [],
          elapsedMs: 3000,
          startedAt: Date.now(),
        })
      );
    });

    await page.goto("/arena", { waitUntil: "load", timeout: 30_000 });
    await page.waitForTimeout(1500);

    // The loss modal is role=alert (not dialog). Look for its title text.
    const loss = page.getByRole("alert").filter({ hasText: /wins|draw|stalemate|resigned/i });
    // Best-effort: if the restore path didn't trigger checkmate evaluation,
    // we'll just capture the current arena state. The visual sweep still
    // documents what the user sees in the post-game path.
    const lossVisible = await loss.isVisible().catch(() => false);
    if (!lossVisible) {
      // Arena state without the loss modal — still a valid capture target
      // since the error banner + arena-bg migration should show here.
      await page.waitForTimeout(500);
    }

    await page.screenshot({
      path: `${SNAPSHOT_DIR}/arena-loss-or-state.png`,
      fullPage: true,
    });
  });

  test("root error boundary", async ({ page }) => {
    // Force the Next.js app-level error boundary by navigating to a
    // route that throws. The production `/victory/[id]` endpoint renders
    // an error boundary if the on-chain data read fails; use a clearly
    // bogus id to surface it without dependence on wallet state.
    await page.goto("/victory/not-a-valid-id", { waitUntil: "load", timeout: 30_000 });
    await page.waitForTimeout(1_000);

    await page.screenshot({
      path: `${SNAPSHOT_DIR}/error-boundary-victory.png`,
      fullPage: true,
    });
  });
});
