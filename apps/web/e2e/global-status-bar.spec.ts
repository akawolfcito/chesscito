import { test, expect, type Page } from "@playwright/test";

/**
 * Locks the Phase-2 GlobalStatusBar (Z1) contract on the play-hub canary.
 * Per spec docs/specs/ui/global-status-bar-spec-2026-05-02.md §13.
 *
 * Targets `/hub` directly (Pixel 5 UA does not match the wallet table;
 * the public landing at `/` does not render the play-hub).
 *
 * Most assertions cover the anonymous variant — Playwright in MiniPay
 * project has no wallet adapter, so `address` resolves to undefined and
 * Z1 mounts as `variant="anonymous"`. Connected-state coverage lives in
 * the unit suite (`global-status-bar.test.tsx`).
 */

const Z1_MAX = 40; // Spec §2: Z1 ≤ 40px content height (excl. safe-area-top).
const Z2_MIN = 52; // Z2 envelope (per ContextualHeader spec §2).
const Z2_MAX = 64;
const Z1_Z2_MAX = 104; // Spec §11 #11 + DESIGN_SYSTEM.md §10.1.

async function bypassFirstVisit(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("chesscito:onboarded", "true");
    window.localStorage.setItem("chesscito:welcome-dismissed", "1");
  });
}

/** Returns content height of an element (clientHeight − vertical padding),
 *  matching the spec §11 #11 enforcement convention. Excludes
 *  safe-area-inset-top so the budget reads consistently across devices. */
async function contentHeight(page: Page, selector: string): Promise<number> {
  return await page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const style = getComputedStyle(el);
      const pt = parseFloat(style.paddingTop) || 0;
      const pb = parseFloat(style.paddingBottom) || 0;
      return el.clientHeight - pt - pb;
    });
}

test.describe("GlobalStatusBar — play-hub canary", () => {
  test("Z1 mounts at the top of /hub with the correct attributes", async ({
    page,
  }) => {
    await bypassFirstVisit(page);
    await page.goto("/hub");
    await page.waitForLoadState("networkidle");

    const z1 = page.locator('[data-component="global-status-bar"]');
    await expect(z1).toBeVisible();
    // Anonymous variant is the default in test (no wallet adapter).
    await expect(z1).toHaveAttribute("data-variant", "anonymous");
    await expect(z1).toHaveAttribute("dir", "ltr");
  });

  test("Z1 content height stays within the 40px budget", async ({ page }) => {
    await bypassFirstVisit(page);
    await page.goto("/hub");
    await page.waitForLoadState("networkidle");

    const height = await contentHeight(page, '[data-component="global-status-bar"]');
    expect(height).toBeLessThanOrEqual(Z1_MAX);
  });

  test("Z1 + Z2 combined content height stays within the 104px budget", async ({
    page,
  }) => {
    await bypassFirstVisit(page);
    await page.goto("/hub");
    await page.waitForLoadState("networkidle");

    const z1Height = await contentHeight(
      page,
      '[data-component="global-status-bar"]',
    );
    const z2Height = await contentHeight(
      page,
      '[data-component="contextual-header"]',
    );
    expect(z1Height + z2Height).toBeLessThanOrEqual(Z1_Z2_MAX);
  });

  test("Z2 envelope (52–64px) survives the mr-[140px] drop", async ({
    page,
  }) => {
    await bypassFirstVisit(page);
    await page.goto("/hub");
    await page.waitForLoadState("networkidle");

    const z2Box = await page
      .locator('[data-component="contextual-header"]')
      .first()
      .boundingBox();
    expect(z2Box).not.toBeNull();
    // Spec halt criteria: Z2 must stay inside its envelope after dropping
    // the legacy right-margin reservation.
    expect(z2Box!.height).toBeGreaterThanOrEqual(Z2_MIN - 1);
    expect(z2Box!.height).toBeLessThanOrEqual(Z2_MAX + 1);
  });

  test("Z1 anonymous variant displays the Guest label", async ({ page }) => {
    await bypassFirstVisit(page);
    await page.goto("/hub");
    await page.waitForLoadState("networkidle");

    const z1 = page.locator('[data-component="global-status-bar"]');
    await expect(z1.getByText("Guest")).toBeVisible();
  });

  test("Z1 contains no monetization promo, live timer, or level chip", async ({
    page,
  }) => {
    await bypassFirstVisit(page);
    await page.goto("/hub");
    await page.waitForLoadState("networkidle");

    const z1 = page.locator('[data-component="global-status-bar"]');
    // Forbidden inhabitants per spec §3 (non-goals).
    expect(
      await z1.locator('[data-testid*="promo"], .pro-promo, .shop-promo').count(),
    ).toBe(0);
    expect(
      await z1.locator('[data-testid*="timer"], .timer, .arena-timer').count(),
    ).toBe(0);
    expect(
      await z1.locator('[data-testid*="level"], .level-chip').count(),
    ).toBe(0);
  });

  test("Z1 is not duplicated — only one instance mounts", async ({ page }) => {
    await bypassFirstVisit(page);
    await page.goto("/hub");
    await page.waitForLoadState("networkidle");

    const count = await page
      .locator('[data-component="global-status-bar"]')
      .count();
    expect(count).toBe(1);
  });

  test("legacy ProChip is no longer rendered alongside Z1", async ({ page }) => {
    await bypassFirstVisit(page);
    await page.goto("/hub");
    await page.waitForLoadState("networkidle");

    // The legacy chip used `aria-label="Get Chesscito PRO"` on the
    // inactive variant. Z1 now exposes the inactive treatment via
    // `aria-label="View Chesscito PRO"`. With no wallet, no PRO indicator
    // renders at all — assert no legacy "Get" label is present.
    const legacy = page.getByLabel(/^Get Chesscito PRO$/);
    await expect(legacy).toHaveCount(0);
  });

  test("Z3 board mounts below Z1 + Z2 with no overlap", async ({ page }) => {
    await bypassFirstVisit(page);
    await page.goto("/hub");
    await page.waitForLoadState("networkidle");

    const board = page.locator(".playhub-board-hitgrid");
    await expect(board).toBeVisible();
    await expect(page.locator("button.playhub-board-cell")).toHaveCount(64);

    const z1Box = await page
      .locator('[data-component="global-status-bar"]')
      .boundingBox();
    const z2Box = await page
      .locator('[data-component="contextual-header"]')
      .first()
      .boundingBox();
    const boardBox = await board.boundingBox();
    expect(z1Box).not.toBeNull();
    expect(z2Box).not.toBeNull();
    expect(boardBox).not.toBeNull();
    // Board must sit below the bottom of Z2 (which sits below Z1).
    // Subtract 1px for subpixel rounding.
    expect(boardBox!.y).toBeGreaterThanOrEqual(
      z2Box!.y + z2Box!.height - 1,
    );
    // And board must sit below Z1 (sanity).
    expect(boardBox!.y).toBeGreaterThanOrEqual(
      z1Box!.y + z1Box!.height - 1,
    );
  });

  test("Z5 dock keeps its place at the viewport bottom", async ({ page }) => {
    await bypassFirstVisit(page);
    await page.goto("/hub");
    await page.waitForLoadState("networkidle");

    const dock = page.locator(".chesscito-dock");
    await expect(dock).toBeVisible();
    const dockBox = await dock.boundingBox();
    const viewport = page.viewportSize();
    expect(dockBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    // Dock bottom should sit within ~120px of the viewport bottom
    // (accounts for safe-area-inset-bottom on mobile fixtures).
    const dockBottom = dockBox!.y + dockBox!.height;
    expect(viewport!.height - dockBottom).toBeLessThanOrEqual(120);
  });
});
