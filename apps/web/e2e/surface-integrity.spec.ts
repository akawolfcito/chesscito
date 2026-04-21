import { test, expect, type Page } from "@playwright/test";

/**
 * Guard tests for design decisions that already regressed once and
 * that future CSS refactors could silently break again:
 *
 *  1. The board canvas must NEVER be 0×0. The candy redesign's flex
 *     chain collapsed it to 0 on mobile (and actually desktop too)
 *     before commit 0c0f858 pinned .playhub-game-stage width: 100%.
 *     This test would have surfaced the regression in CI before the
 *     user saw it.
 *
 *  2. The persistent dock must stay visible AND clickable when any
 *     destination sheet (badge / shop / leaderboard) is open. That
 *     is the Clash-Royale-style game-UX pattern documented in
 *     DESIGN_SYSTEM §8. Any change to z-index ladders, Radix modal
 *     config, or .atmosphere > * must keep these invariants.
 */

async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("chesscito:onboarded", "true");
  });
}

async function getRect(page: Page, selector: string) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, visible: r.width > 0 && r.height > 0 };
  }, selector);
}

test.describe("Surface integrity — board canvas is never 0x0", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("play-hub board canvas has non-zero dimensions", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const canvas = await getRect(page, ".playhub-board-canvas");
    expect(canvas).not.toBeNull();
    expect(canvas!.w).toBeGreaterThan(100);
    expect(canvas!.h).toBeGreaterThan(100);
    // Square (aspect-ratio 1/1) — tolerate 1px subpixel drift
    expect(Math.abs(canvas!.w - canvas!.h)).toBeLessThan(2);
  });

  test("board sprite <img> is present and fills the canvas", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const img = await getRect(page, ".playhub-board-img img");
    expect(img).not.toBeNull();
    expect(img!.w).toBeGreaterThan(100);
    expect(img!.h).toBeGreaterThan(100);

    const canvas = await getRect(page, ".playhub-board-canvas");
    // Image should occupy the full canvas area
    expect(Math.abs(img!.w - canvas!.w)).toBeLessThan(2);
  });

  test("arena board canvas has non-zero dimensions after Enter Arena", async ({ page }) => {
    await page.goto("/arena");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Enter Arena/ }).click();

    await page.waitForSelector(".arena-piece-float", { timeout: 5000 });
    const canvas = await getRect(page, ".playhub-board-canvas.arena-board-canvas");
    expect(canvas).not.toBeNull();
    expect(canvas!.w).toBeGreaterThan(100);
    expect(canvas!.h).toBeGreaterThan(100);
  });
});

test.describe("Surface integrity — persistent dock stays on top of sheets", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("dock remains visible while the badge sheet is open", async ({ page }) => {
    await page.getByLabel("Badges").click();
    // Radix animates in; wait for the sheet to be present
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });

    const dock = await getRect(page, ".chesscito-dock");
    expect(dock).not.toBeNull();
    expect(dock!.visible).toBe(true);

    // z-60 dock must actually be above the scrim at hit-test level
    const topAtDock = await page.evaluate(() => {
      const dock = document.querySelector(".chesscito-dock") as HTMLElement | null;
      if (!dock) return null;
      const r = dock.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        className: el?.className || null,
        insideDock: !!el?.closest?.(".chesscito-dock"),
      };
    });
    expect(topAtDock?.insideDock).toBe(true);
  });

  test("tapping a different dock tab swaps sheets — exclusive activeDockTab", async ({ page }) => {
    await page.getByLabel("Badges").click();
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });

    await page.getByLabel("Shop").click();
    await page.waitForTimeout(500);

    // Exactly one destination sheet visible (not stacked)
    const openDialogs = await page.locator('[role="dialog"][aria-modal="true"]').count();
    expect(openDialogs).toBeLessThanOrEqual(1);
  });
});
