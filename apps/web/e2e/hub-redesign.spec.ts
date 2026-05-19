import { test, expect } from "@playwright/test";

/**
 * SPEC 1 — Hub redesign priority smoke. Covers the destination
 * deep-links + new Hero/Secondary CTA shape + dock taxonomy that
 * Phases 4–7 introduced. Trophies candy port has its own spec
 * (trophies-candy.spec.ts); this one focuses on the hub surface.
 */
test.describe("Hub redesign", () => {
  test("first-visit onboarding card visible + dismiss persists", async ({
    page,
  }) => {
    await page.goto("/hub");
    await expect(page.getByText(/welcome to chesscito/i)).toBeVisible();
    await page.getByRole("button", { name: /got it/i }).click();
    await page.reload();
    await expect(page.getByText(/welcome to chesscito/i)).not.toBeVisible();
  });

  test("secondary Enter Arena navigates to /arena", async ({ page }) => {
    await page.goto("/hub");
    await page.getByRole("button", { name: /enter arena/i }).click();
    await expect(page).toHaveURL(/\/arena/);
  });

  // The avatar HUD chip is deferred — Task 5.5 explicitly skipped the
  // `notifDotCount` + `onAvatarTap` props because HubScaffold does not
  // yet expose an avatar slot. When that follow-up lands, flip
  // `test.fixme` back to `test` and verify the data-testid below.
  test.fixme("avatar tap opens Profile sheet", async ({ page }) => {
    await page.goto("/hub");
    await page.locator('[data-testid="hub-avatar"]').click();
    await expect(page.getByText(/general stats/i)).toBeVisible();
  });

  test("/trophies renders the candy page with back button", async ({
    page,
  }) => {
    await page.goto("/trophies");
    await expect(
      page.getByRole("link", { name: /back to hub/i }),
    ).toBeVisible();
  });

  test("/hub?sheet=profile deep-links into the Profile sheet", async ({
    page,
  }) => {
    await page.goto("/hub?sheet=profile");
    await expect(page.getByText(/general stats/i)).toBeVisible();
  });

  test("?hub=v2 query is ignored (V2 retired)", async ({ page }) => {
    await page.goto("/hub?hub=v2");
    // V1-specific structure must render — the dock's Home slot is the
    // cheapest unambiguous signal the user is on the V1 surface.
    await expect(page.getByRole("button", { name: /home/i })).toBeVisible();
  });
});
