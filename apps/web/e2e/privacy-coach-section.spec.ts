import { test, expect } from "@playwright/test";

/** Smoke assertion for the existing privacy disclosure.
 * Run only against an authorized QA instance; legal-page accessibility is C7. */
test.describe("/privacy — Coach analysis and history disclosure", () => {
  test("renders heading + 4 disclosure paragraphs", async ({ page }) => {
    await page.goto("/privacy");
    await page.waitForLoadState("networkidle");

    // Heading
    await expect(page.getByText(/Coach Analysis and Match History/i)).toBeVisible();

    // Main notice distinguishes expiry settings from blanket deletion deadlines.
    await expect(page.getByText(/one-year expiry setting/i)).toBeVisible();

    // Para 2 — user control
    await expect(page.getByText(/Deleting Coach history:/i)).toBeVisible();
    await expect(
      page.getByText(/If a storage service fails during deletion, some targeted data may remain/i),
    ).toBeVisible();

    // Coach storage includes saved move lists associated with the wallet.
    await expect(page.getByText(/What Coach stores:/i)).toBeVisible();
    await expect(
      page.getByText(/Saved game records include the move list/i),
    ).toBeVisible();

    // Para 4 — lost wallet recourse
    await expect(page.getByText(/Other requests and lost wallet access:/i)).toBeVisible();
    await expect(page.getByText(/We may need evidence that you control the relevant wallet or account/i)).toBeVisible();
  });
});
