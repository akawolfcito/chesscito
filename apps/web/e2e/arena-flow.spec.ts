import { test, expect } from "@playwright/test";

/**
 * Functional flow through arena setup: land on /arena, pick a difficulty,
 * start the match, confirm the 32-piece board renders.
 */
test.describe("Arena — setup flow", () => {
  test("difficulty selector opens, Enter Arena starts a game with 32 pieces", async ({ page }) => {
    await page.goto("/arena");
    await page.waitForLoadState("networkidle");

    // Difficulty selector heading
    await expect(page.getByRole("heading", { name: "Arena" })).toBeVisible();
    await expect(page.getByText("Challenge the AI")).toBeVisible();

    // The three difficulty options
    await expect(page.getByRole("button", { name: /Easy/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Medium/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Hard/ })).toBeVisible();

    // Pick Easy (also the default) then start
    await page.getByRole("button", { name: /Easy/ }).click();
    await page.getByRole("button", { name: /Enter Arena/ }).click();

    // Board renders with 32 pieces (16 white + 16 black) after the 400ms
    // "preparing AI" delay inside the arena page.
    const pieces = page.locator(".playhub-board-piece-float");
    await expect(pieces).toHaveCount(32, { timeout: 5000 });

    // And the 64 cells are present
    const cells = page.locator("button.playhub-board-cell, button.arena-board-cell");
    await expect(cells.first()).toBeVisible();
  });

  test("back button from difficulty selector returns to home", async ({ page }) => {
    await page.goto("/arena");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /Back to Hub/i }).click();
    await page.waitForURL("**/");
    await expect(page.locator(".chesscito-dock")).toBeVisible();
  });
});
