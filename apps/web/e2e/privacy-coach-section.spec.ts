import { test, expect } from "@playwright/test";

/**
 * Regression guard for PR 5 (Coach session memory) — the /privacy
 * page must render the new "Coach Match History" disclosure section
 * with all 4 paragraphs from PRIVACY_COACH_COPY.
 *
 * Prevents a recurrence of accidental copy removal during refactors.
 */
test.describe("/privacy — Coach Match History section", () => {
  test("renders heading + 4 disclosure paragraphs", async ({ page }) => {
    await page.goto("/privacy");
    await page.waitForLoadState("networkidle");

    // Heading
    await expect(page.getByText(/Coach Match History/i)).toBeVisible();

    // Para 1 — retention disclosure (365 days)
    await expect(page.getByText(/365 days from creation/i)).toBeVisible();

    // Para 2 — user control
    await expect(page.getByText(/Your control:/i)).toBeVisible();
    await expect(
      page.getByText(/Deletion is permanent and immediate/i),
    ).toBeVisible();

    // Para 3 — what's stored (with the explicit "not the move list" guarantee)
    await expect(page.getByText(/What's stored:/i)).toBeVisible();
    await expect(
      page.getByText(/We do NOT store your full move list/i),
    ).toBeVisible();

    // Para 4 — lost wallet recourse
    await expect(page.getByText(/Lost wallet access:/i)).toBeVisible();
    await expect(page.getByText(/support@chesscito\.app/i)).toBeVisible();
  });
});
