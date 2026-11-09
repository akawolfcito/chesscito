/**
 * Capture-only spec for the PR artifacts of the Peones visibility slice
 * (2026-07-21). NOT a visual-regression test: it asserts nothing about
 * pixels and owns no baseline, so it can never go red on font drift.
 *
 * Writes PNGs to `e2e-results/peones-ux/` for human review.
 */

import { test, expect } from "@playwright/test";

const OUT = "e2e-results/peones-ux";

test.describe("Peones UX — PR capture", () => {
  test("balance chip at rest", async ({ page }) => {
    await page.goto("/dev/peones-chip?variant=balance", { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const chip = page.getByTestId("peones-balance-chip");
    await expect(chip).toBeVisible();
    await page.waitForTimeout(400);
    await chip.screenshot({ path: `${OUT}/01-balance.png` });
  });

  test("earn delta", async ({ page }) => {
    await page.goto("/dev/peones-chip?variant=earn", { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    // Wait for the badge the bus + balance move produce, then shoot the
    // region around the chip so the floating delta is included.
    await expect(page.getByTestId("peones-balance-delta")).toBeVisible();
    await page.getByTestId("peones-chip-fixture").screenshot({
      path: `${OUT}/02-delta-earn.png`,
    });
  });

  test("shield rescue cost ribbon", async ({ page }) => {
    await page.goto("/dev/rescue-modal?variant=D&shields=0", {
      waitUntil: "load",
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/04-shield-rescue-ribbon.png` });
  });

  test("spend delta", async ({ page }) => {
    await page.goto("/dev/peones-chip?variant=spend", { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByTestId("peones-balance-delta")).toBeVisible();
    await page.getByTestId("peones-chip-fixture").screenshot({
      path: `${OUT}/03-delta-spend.png`,
    });
  });
});
