import { test, expect } from "@playwright/test";

/**
 * Reproduction probe — iPhone 17 Pro Max field report 2026-05-31.
 *
 * User feedback: tapping the rook visually shows no movement dots; board
 * "feels locked". Existing exercise-flow.spec uses Playwright's
 * getByRole().click() which routes through the accessibility tree and
 * always hits the underlying <button>, so it cannot reproduce a hit-test
 * regression caused by a sibling <picture> with no pointer-events: none.
 *
 * This test taps EXACTLY at the visual center pixel of the rook sprite,
 * the same way a real fingertip would. If the dot count stays 0, the
 * floating-piece <picture> is intercepting the click and the underlying
 * cell <button> never fires onClick.
 */
test.describe("Board hit-test — pixel tap on piece sprite", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("chesscito:onboarded", "true");
      window.localStorage.setItem("chesscito:welcome-dismissed", "1");
    });
  });

  test("pixel tap on rook sprite shows movement dots", async ({ page }) => {
    await page.goto("/exercises");
    await page.waitForLoadState("networkidle");

    const piece = page.locator(".playhub-board-piece-float").first();
    await expect(piece).toBeVisible();

    const box = await piece.boundingBox();
    expect(box, "piece bounding box must resolve").not.toBeNull();
    if (!box) throw new Error("no bbox");

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Sanity log for diagnosis
    console.log(`[probe] piece bbox=${JSON.stringify(box)} centre=(${cx}, ${cy})`);

    await expect(page.locator(".playhub-board-cell.is-highlighted")).toHaveCount(0);

    // Real pointer tap at the visual centre — routes via elementFromPoint.
    await page.mouse.click(cx, cy);

    // Give React a beat to settle.
    await page.waitForTimeout(120);

    const dotCount = await page.locator(".playhub-board-dot").count();
    const highlightedCount = await page.locator(".playhub-board-cell.is-highlighted").count();
    const selectedCount = await page.locator(".playhub-board-cell.is-selected").count();

    console.log(`[probe] after-tap dots=${dotCount} highlighted=${highlightedCount} selected=${selectedCount}`);

    // The diagnostic assertion — if this fails, the hit-test hypothesis is confirmed.
    expect(dotCount, "expected ≥1 movement dot after tapping rook sprite").toBeGreaterThan(0);
  });
});
