import { test, expect } from "@playwright/test";

/**
 * On first visit the play-hub mounts a mission-briefing dialog that
 * sits at z-index 40 and, due to a one-shot useState on isFirstVisit,
 * never actually unmounts in the current session even after
 * handleDismiss fires (it only flips a local `exiting` class + writes
 * localStorage). That blocks genuine pointer-event dispatch onto the
 * board. We side-step by writing the onboarded flag BEFORE navigation
 * so showBriefing is false on mount — the briefing is out of the DOM
 * entirely and the board is the top element under the cursor.
 */
test.describe("Play hub — exercise flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("chesscito:onboarded", "true");
    });
  });

  test("selecting the piece surfaces is-highlighted cells for its legal moves", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Find the square that currently owns the floating piece — use
    // aria-label since cells are stable-identified by their square.
    const pieceSrc = await page.locator(".playhub-board-piece-float img").first().getAttribute("src");
    expect(pieceSrc).toBeTruthy();

    // Baseline: no cells are highlighted before any interaction.
    await expect(page.locator(".playhub-board-cell.is-highlighted")).toHaveCount(0);

    // Tap the lower-left square (a1) — default rook exercise starts there.
    await page.getByRole("gridcell", { name: "Square a1" }).click();

    // Now at least one cell should be highlighted.
    const highlighted = page.locator(".playhub-board-cell.is-highlighted");
    await expect(highlighted.first()).toBeVisible();
    const count = await highlighted.count();
    expect(count).toBeGreaterThan(0);
  });

  test("tapping a non-legal square does not highlight it", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click a far square with no piece — should not surface move highlights
    // (the click lands on an empty, non-legal cell).
    await page.getByRole("gridcell", { name: "Square d4" }).click();

    // No selection → no highlights.
    await expect(page.locator(".playhub-board-cell.is-selected")).toHaveCount(0);
  });
});
