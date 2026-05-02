import { test, expect, type Page } from "@playwright/test";

/**
 * Locks the Phase-2 ContextualHeader contract on the play-hub canary.
 * Per spec docs/specs/ui/contextual-header-spec-2026-05-01.md §13.
 *
 * Targets `/hub` directly (Pixel 5 UA does not match the wallet table;
 * the public landing at `/` does not render the play-hub).
 */

/** Skip the splash + first-visit briefing AND the 3-card welcome overlay
 *  so the play-hub mounts straight to the interactive surface. Same
 *  pattern as floating-actions-vs-dock.spec.ts. */
async function bypassFirstVisit(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("chesscito:onboarded", "true");
    window.localStorage.setItem("chesscito:welcome-dismissed", "1");
  });
}

test.describe("ContextualHeader — play-hub canary", () => {
  test("Z2 strip mounts with the correct contract", async ({ page }) => {
    await bypassFirstVisit(page);
    await page.goto("/hub");
    await page.waitForLoadState("networkidle");

    const header = page.locator('[data-component="contextual-header"]').first();
    await expect(header).toBeVisible();
    await expect(header).toHaveAttribute("data-variant", "title-control");

    // Spec §2: Z2 height envelope is 52–64px. Allow ±1px subpixel slack.
    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(51);
    expect(box!.height).toBeLessThanOrEqual(65);
  });

  test("piece-picker trigger opens the picker sheet", async ({ page }) => {
    await bypassFirstVisit(page);
    await page.goto("/hub");
    await page.waitForLoadState("networkidle");

    const header = page.locator('[data-component="contextual-header"]').first();
    const trigger = header.getByRole("button", { name: /Switch piece/i });
    await expect(trigger).toBeVisible();

    await trigger.click();

    // PiecePickerSheet renders 3-col piece grid; one of them is the
    // current selection (Rook by default on first visit).
    await expect(
      page.getByRole("button", { name: "Rook", pressed: true }),
    ).toBeVisible();
  });

  test("MissionDetailSheet entry is preserved (transitional sibling)", async ({
    page,
  }) => {
    await bypassFirstVisit(page);
    await page.goto("/hub");
    await page.waitForLoadState("networkidle");

    // The mission peek button still lives below the header as a TODO
    // sibling per spec §8 Phase-2 carry-forward. It opens the mission
    // detail sheet.
    const missionPeek = page.getByRole("button", {
      name: /Open mission details/i,
    });
    await expect(missionPeek).toBeVisible();

    await missionPeek.click();

    // The mission detail sheet has a distinct heading. The exact copy can
    // shift with editorial work; we settle for "any dialog opened."
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("Z2 contains no live timer and no monetization", async ({ page }) => {
    await bypassFirstVisit(page);
    await page.goto("/hub");
    await page.waitForLoadState("networkidle");

    const header = page.locator('[data-component="contextual-header"]').first();
    await expect(header).toBeVisible();

    // No element under Z2 may carry a "timer" / "elapsed" hook.
    expect(
      await header.locator("[data-timer], .timer, .arena-timer").count(),
    ).toBe(0);

    // No PRO / shop / monetization chips inside Z2.
    expect(
      await header
        .locator(".pro-chip, .shop-promo, [data-monetization]")
        .count(),
    ).toBe(0);
  });

  test("Z3 board still mounts with 64 cells (no Z2 overlap)", async ({
    page,
  }) => {
    await bypassFirstVisit(page);
    await page.goto("/hub");
    await page.waitForLoadState("networkidle");

    const board = page.locator(".playhub-board-hitgrid");
    await expect(board).toBeVisible();
    await expect(page.locator("button.playhub-board-cell")).toHaveCount(64);

    // The board's bounding box must sit BELOW the Z2 strip, never overlap.
    const headerBox = await page
      .locator('[data-component="contextual-header"]')
      .first()
      .boundingBox();
    const boardBox = await board.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(boardBox).not.toBeNull();
    // Subtract 1px for subpixel rounding.
    expect(boardBox!.y).toBeGreaterThanOrEqual(
      headerBox!.y + headerBox!.height - 1,
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
    expect(dockBox!.y + dockBox!.height).toBeGreaterThan(
      viewport!.height - 4,
    );
  });
});
