import { test, expect } from "@playwright/test";

/**
 * Smoke test for the canonical Hub. If any of these selectors go
 * missing it means the home composition broke — a regression that
 * would show as a broken first-load in MiniPay.
 *
 * Targets `/`, the canonical Hub for both Lite and Full deployments.
 */
test.describe("Play hub — home loads", () => {
  test("renders the Hub shell, training path, and primary actions", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("main", { name: "Chesscito Hub" })).toBeVisible();
    await expect(page.getByText("TRAINING PATH")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /practice individual chess pieces/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /enter arena: full chess vs ai/i }),
    ).toBeVisible();
  });

  test("renders the kingdom anchor on direct root entry", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL((url) => url.pathname === "/");
    await expect(
      page.getByRole("img", {
        name: /chesscito kingdom: wolfcito the wizard/i,
      }),
    ).toBeVisible();
  });

  test("root practice action reaches the complete exercise surface", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /practice individual chess pieces/i })
      .click();
    await expect(page).toHaveURL((url) => url.pathname === "/exercises");

    await expect(page.getByRole("grid", { name: "Chess board" })).toBeVisible();
    await expect(page.getByRole("gridcell")).toHaveCount(64);
    await expect(page.getByRole("img", { name: "White rook" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Game navigation" }),
    ).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: /move your rook to h1/i }),
    ).toBeVisible();
  });
});
