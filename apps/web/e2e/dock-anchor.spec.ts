import { test, expect } from "@playwright/test";

/**
 * Verifies the persistent dock anchors flush with the viewport bottom on
 * the play-hub. Regression test for the gap-below-dock issue where parents
 * stretched past 100dvh and exposed body bg below the dock.
 */
test.describe("Play hub dock anchoring", () => {
  test("dock bottom equals viewport height (no gap below)", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Wait for the dock to mount.
    const dock = page.locator(".chesscito-dock");
    await expect(dock).toBeVisible();

    const measurements = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      const main = document.querySelector("main");
      const section = document.querySelector("section.mission-shell-candy");
      const dock = document.querySelector(".chesscito-dock") as HTMLElement | null;
      const dockRect = dock?.getBoundingClientRect();
      return {
        viewportHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        documentScrollHeight: html.scrollHeight,
        bodyHeight: body.getBoundingClientRect().height,
        mainHeight: main?.getBoundingClientRect().height ?? null,
        sectionHeight: section?.getBoundingClientRect().height ?? null,
        dockBottom: dockRect ? dockRect.bottom : null,
        dockTop: dockRect ? dockRect.top : null,
        canScroll: html.scrollHeight > window.innerHeight,
        scrollDelta: html.scrollHeight - window.innerHeight,
      };
    });

    console.log("Layout measurements:", JSON.stringify(measurements, null, 2));

    // Tolerance: 1px subpixel rounding.
    expect(measurements.dockBottom).not.toBeNull();
    expect(measurements.dockBottom!).toBeGreaterThan(measurements.viewportHeight - 4);
    expect(measurements.dockBottom!).toBeLessThan(measurements.viewportHeight + 4);
    // No vertical scroll past the viewport.
    expect(measurements.scrollDelta).toBeLessThanOrEqual(2);
  });
});
