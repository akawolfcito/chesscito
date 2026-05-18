import { test, expect } from "@playwright/test";

/**
 * SPEC 1 D8 — /trophies page candy port smoke. Confirms the standalone
 * route still renders the back-to-hub link and that the candy palette
 * wrapper (`.trophies-candy-page`) is applied so the page reads as
 * part of the candy aesthetic rather than as off-line legacy chrome.
 */
test("trophies page renders with candy palette + back button", async ({ page }) => {
  await page.goto("/trophies");
  await expect(page.getByRole("link", { name: /back to hub/i })).toBeVisible();
  await expect(page.locator(".trophies-candy-page")).toBeVisible();
});
