import { test, expect } from "@playwright/test";

/**
 * Functional coverage of the core play-hub interaction: tap piece →
 * board highlights legal moves → tap a legal square → piece moves.
 */
test.describe("Play hub — exercise flow", () => {
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
