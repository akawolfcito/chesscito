import { test, expect } from "@playwright/test";

/**
 * Regression guard for B4 (2026-05-07 feedback): the user-cancelled
 * claim copy must read empathetic ("Saved for later" / "No transaction
 * was made.") rather than accusatory ("You declined the wallet prompt").
 *
 * Hits the editorial layer via a runtime probe: imports the constants
 * from a public surface (we expose them on /api/_dev/copy in test, or
 * inline the assertion against the bundle). For now the simplest
 * approach is to assert the constants haven't drifted by importing
 * VICTORY_CLAIM_COPY directly into a Vitest unit test — but to keep
 * the safety net visible at the E2E layer too, we render the modal
 * via a future test harness or a query-param-driven storybook page.
 *
 * STATE: skeleton only — needs a victory-claim-error preview route
 * (e.g. `/dev/preview/claim-cancel`) before this can run end-to-end.
 * Tracked as a follow-up; the unit-level guard already lives in
 * `apps/web/src/components/arena/__tests__/victory-claim-error.test.tsx`
 * (or will be added in the next pass).
 */
test.describe("Victory claim — user-cancelled copy", () => {
  test.skip("renders 'Saved for later' + amber tone (needs preview route)", async ({ page }) => {
    await page.goto("/dev/preview/claim-cancel");
    await expect(page.getByText(/Saved for later/i)).toBeVisible();
    await expect(
      page.getByText(/No transaction was made/i),
    ).toBeVisible();
    // Old accusatory copy must not leak back in
    await expect(
      page.getByText(/You declined the wallet prompt/i),
    ).toHaveCount(0);
  });
});
