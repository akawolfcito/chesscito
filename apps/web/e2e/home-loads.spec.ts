import { test, expect } from "@playwright/test";

/**
 * Smoke test for the play-hub landing. If any of these selectors go
 * missing it means the home composition broke — a regression that
 * would show as a broken first-load in MiniPay.
 *
 * Targets `/hub` (Play Hub). `/` is now the public landing page; wallet
 * WebViews redirect to `/hub` server-side, but Playwright's Pixel 5 UA
 * does not match the wallet table, so we navigate directly.
 */
test.describe("Play hub — home loads", () => {
  test("renders the board, mission panel, and persistent dock", async ({ page }) => {
    await page.goto("/hub");
    await page.waitForLoadState("networkidle");

    // Core game surface
    const board = page.locator(".playhub-board-hitgrid");
    await expect(board).toBeVisible();

    // 64 board cells (buttons) rendered on the hit-grid
    const cells = page.locator("button.playhub-board-cell");
    await expect(cells).toHaveCount(64);

    // Persistent dock (bottom nav)
    const dock = page.locator(".chesscito-dock");
    await expect(dock).toBeVisible();

    // Mission composition (the main interactive shell)
    const missionShell = page.locator("section.mission-shell-candy, .mission-panel, [data-testid='mission-panel']").first();
    await expect(missionShell).toBeVisible();
  });

  test("renders the starting piece on the board", async ({ page }) => {
    await page.goto("/hub");
    await page.waitForLoadState("networkidle");

    // At least one floating piece visible (rook for the default exercise)
    const piece = page.locator(".playhub-board-piece-float").first();
    await expect(piece).toBeVisible();
  });
});
