import { test, expect, type Page } from "@playwright/test";

/**
 * Functional flow through arena setup: land on /arena, pick a difficulty,
 * start the match, confirm the 32-piece board renders.
 */

/** First-visit guests get the "Want a warm-up first?" soft-gate modal
 *  (centered MISSION-pattern since `10f62c88`) on top of the difficulty
 *  selector. E2E profiles are always fresh, so dismiss it when present —
 *  same gesture as a real guest tapping the ×. */
async function dismissSoftGateIfPresent(page: Page) {
  const closeButton = page.getByRole("button", { name: "Warm-up gate" });
  try {
    await closeButton.click({ timeout: 3000 });
  } catch {
    // Gate not shown (returning profile) — nothing to dismiss.
  }
}

test.describe("Arena — setup flow", () => {
  test("difficulty selector opens, PLAY CHESS starts a game with 32 pieces", async ({ page }) => {
    // The CTA has an infinite, decorative transform pulse after 4s. Exercise
    // the UI's real reduced-motion mode so Playwright can require normal
    // actionability without bypassing hit-testing or event reception.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/arena");
    await page.waitForLoadState("networkidle");
    await dismissSoftGateIfPresent(page);

    // Difficulty selector heading
    await expect(page.getByRole("heading", { name: "Arena" })).toBeVisible();
    // The three difficulty options
    await expect(page.getByRole("button", { name: /Easy/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Medium/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Hard/ })).toBeVisible();

    // Pick Easy (also the default) then start. CTA label is "PLAY"
    // since the CTA-token unification (was "PLAY CHESS").
    await page.getByRole("button", { name: /Easy/ }).click();
    const playButton = page.getByRole("button", { name: /^PLAY$/ });
    await expect(playButton).toBeVisible();
    await expect(playButton).toBeEnabled();
    await playButton.click();

    // Board renders with 32 pieces (16 white + 16 black) after the 400ms
    // "preparing AI" delay inside the arena page.
    const pieces = page.locator(".arena-piece-float");
    await expect(pieces).toHaveCount(32, { timeout: 5000 });

    // And the 64 cells are present
    const cells = page.locator("button[data-square]");
    await expect(cells).toHaveCount(64);
  });

  test("back button from difficulty selector returns to home", async ({ page }) => {
    await page.goto("/arena");
    await page.waitForLoadState("networkidle");
    await dismissSoftGateIfPresent(page);

    // Two "Back to Hub" controls exist on the panel — the × button in the
    // header (aria-labelled) and the underlined text link at the bottom.
    // Use the header × which is explicitly aria-labelled, picked via
    // getByLabel to avoid strict-mode collisions.
    await page.getByLabel("Back to Hub").click();
    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.locator(".hub-scaffold, .hub-v2-root")).toBeVisible();
  });
});
