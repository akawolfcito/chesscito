import { test, expect } from "@playwright/test";

/**
 * Ensures the non-hub secondary routes boot cleanly without 404s or
 * broken chrome. These routes are small, but a missing layout wrapper
 * or a crashed server component would be invisible from a hub-only
 * smoke test — this covers that gap.
 */
test.describe("Secondary pages — boot cleanly", () => {
  for (const [path, expectedHeading] of [
    ["/about", /About/i],
    ["/support", /Support/i],
    ["/trophies", /Trophies|Hall of Fame/i],
    ["/privacy", /Privacy/i],
    ["/terms", /Terms/i],
  ] as const) {
    test(`${path} renders a heading and no React error boundary`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await page.goto(path);
      await page.waitForLoadState("networkidle");

      await expect(page.getByRole("heading", { name: expectedHeading }).first()).toBeVisible();

      // Next.js default error page has a specific structure
      expect(page.url()).toContain(path);
      await expect(page.getByText("This page could not be found.")).toHaveCount(0);

      expect(errors).toEqual([]);
    });
  }
});
