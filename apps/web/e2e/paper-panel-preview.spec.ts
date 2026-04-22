import { test, expect } from "@playwright/test";

/**
 * One-off captures for the two new paper-panel surfaces so we can eyeball
 * the migration without manual clicks: Mission Detail (trivial) and Badge
 * Earned (pre-seeded progress + two board taps to cross the threshold).
 */

const SNAPSHOT_DIR = "e2e-results/snapshots";

test.describe("Paper panel previews", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("chesscito:onboarded", "true");
      // rook exercise 5 pending, first four each 3★ → total 12
      window.localStorage.setItem(
        "chesscito:progress:rook",
        JSON.stringify({ piece: "rook", exerciseIndex: 4, stars: [3, 3, 3, 3, 0] })
      );
    });
  });

  test("mission detail sheet", async ({ page }) => {
    await page.goto("/", { waitUntil: "load", timeout: 30_000 });
    await expect(page.locator(".playhub-intro-overlay")).toBeHidden({ timeout: 15_000 });

    await page.getByRole("button", { name: "Open mission details" }).click();
    await page.waitForTimeout(600);

    await page.screenshot({
      path: `${SNAPSHOT_DIR}/paper-panel-mission-detail.png`,
      fullPage: true,
    });
  });

  test("badge earned prompt", async ({ page }) => {
    await page.goto("/", { waitUntil: "load", timeout: 30_000 });
    await expect(page.locator(".playhub-intro-overlay")).toBeHidden({ timeout: 15_000 });

    // rook-5: start h8, target b3, capture, optimalMoves=2. Path h8→h3→b3.
    await page.getByRole("gridcell", { name: "Square h8" }).click();
    await page.getByRole("gridcell", { name: "Square h3" }).click();
    await page.waitForTimeout(250);
    await page.getByRole("gridcell", { name: "Square h3" }).click();
    await page.getByRole("gridcell", { name: "Square b3" }).click();

    // BadgeEarnedPrompt appears after the winning move — look for the paper
    // ribbon text instead of matching on opaque classes.
    await expect(page.getByText("Badge Earned", { exact: true })).toBeVisible({
      timeout: 5_000,
    });
    await page.waitForTimeout(1_500); // let stars stagger in

    await page.screenshot({
      path: `${SNAPSHOT_DIR}/paper-panel-badge-earned.png`,
      fullPage: true,
    });
  });

  test("piece complete prompt", async ({ page }) => {
    await page.goto("/", { waitUntil: "load", timeout: 30_000 });
    await expect(page.locator(".playhub-intro-overlay")).toBeHidden({ timeout: 15_000 });

    // Same rook-5 completion as above. After BadgeEarned appears, click Later
    // to reveal the PieceComplete prompt below.
    await page.getByRole("gridcell", { name: "Square h8" }).click();
    await page.getByRole("gridcell", { name: "Square h3" }).click();
    await page.waitForTimeout(250);
    await page.getByRole("gridcell", { name: "Square h3" }).click();
    await page.getByRole("gridcell", { name: "Square b3" }).click();

    await expect(page.getByText("Badge Earned", { exact: true })).toBeVisible({
      timeout: 5_000,
    });
    // Close badge-earned via the visible "Later" text link. (The × pin
    // carries the same "Later" aria-label, so we pick the text node to
    // disambiguate.)
    await page.getByText("Later", { exact: true }).click();

    await expect(page.getByText("All Exercises Complete!", { exact: true })).toBeVisible({
      timeout: 5_000,
    });
    await page.waitForTimeout(1_500);

    await page.screenshot({
      path: `${SNAPSHOT_DIR}/paper-panel-piece-complete.png`,
      fullPage: true,
    });
  });

  test("arena selector with dock", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("chesscito:onboarded", "true");
    });
    await page.goto("/arena", { waitUntil: "load", timeout: 30_000 });
    await page.waitForTimeout(1_500);

    await page.screenshot({
      path: `${SNAPSHOT_DIR}/arena-selector-with-dock.png`,
      fullPage: true,
    });
  });
});
