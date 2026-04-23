import { test, expect } from "@playwright/test";

/**
 * First-visit onboarding — MissionBriefing modal. Gated by localStorage
 * key `chesscito:onboarded`. On first visit the briefing renders at
 * z-40 over the board; the Play button (or a scrim tap) flips the key
 * and unmounts the modal via `setIsFirstVisit(false)` in
 * use-splash-loader.ts.
 *
 * Regression signals if this spec fails:
 *  - Briefing never shows for new users (onboarded key read wrong)
 *  - Briefing lingers in the DOM after dismissal (unmount bug regressed)
 *  - Briefing shows on every visit (markOnboarded / writeOnboarded broken)
 */
test.describe("Play hub — mission briefing first-visit", () => {
  test("first visit shows the briefing modal", async ({ page }) => {
    // Ensure the onboarded flag is absent before navigating.
    await page.addInitScript(() => {
      window.localStorage.removeItem("chesscito:onboarded");
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Briefing scrim + dialog must render.
    const scrim = page.locator(".mission-briefing-scrim");
    await expect(scrim).toBeVisible();

    const dialog = page.getByRole("dialog", { name: /./ });
    await expect(dialog).toBeVisible();
  });

  test("returning visit does not show the briefing", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("chesscito:onboarded", "true");
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".mission-briefing-scrim")).toHaveCount(0);
  });

  test("tapping Play dismisses the briefing and sets the onboarded flag", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem("chesscito:onboarded");
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const scrim = page.locator(".mission-briefing-scrim");
    await expect(scrim).toBeVisible();

    // Play button is the autoFocus CTA inside the modal.
    await page.getByRole("button", { name: /play/i }).click();

    // Exit animation runs ~400ms, then the modal unmounts.
    await expect(scrim).toHaveCount(0, { timeout: 2_000 });

    const onboarded = await page.evaluate(() =>
      window.localStorage.getItem("chesscito:onboarded"),
    );
    expect(onboarded).toEqual("true");
  });
});
