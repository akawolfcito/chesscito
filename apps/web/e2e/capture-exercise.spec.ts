import { test, expect } from "@playwright/test";

/**
 * Capture exercise (rook exercise 4) — the first on-board interaction
 * where the target square contains an enemy instead of an empty cell.
 * Validates that:
 *  - The mission chip reads "Capture" instead of a coordinate.
 *  - The 2-move capture path (a1 → h1 → h8) registers as success:
 *    phase flash appears AND progress stars[3] updates in localStorage.
 *
 * Regression signals if this spec fails:
 *  - Capture copy regressed to coordinate-only.
 *  - Rook's 2-move capture doesn't set phase="success".
 *  - Progress doesn't persist after completion.
 */
test.describe("Play hub — rook capture exercise", () => {
  test.beforeEach(async ({ page }) => {
    // Onboarded + rook progress jumped to exercise index 3 (first capture)
    // with 3 prior exercises marked as completed.
    await page.addInitScript(() => {
      window.localStorage.setItem("chesscito:onboarded", "true");
      window.localStorage.setItem(
        "chesscito:progress:rook",
        JSON.stringify({
          piece: "rook",
          exerciseIndex: 3,
          stars: [1, 1, 1, 0, 0],
        }),
      );
    });
  });

  test("mission chip reads Capture on a capture exercise", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The mission peek chip in the header shows "Capture" for capture
    // exercises (sentence case) — see mission-panel-candy.tsx.
    const missionChip = page.getByRole("button", {
      name: /open mission details.*capture/i,
    });
    await expect(missionChip).toBeVisible();
  });

  test("a1 → h1 → h8 captures the target and marks the exercise complete", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Select the rook at a1 → legal moves highlight.
    await page.getByRole("gridcell", { name: "Square a1" }).click();
    await expect(page.locator(".playhub-board-cell.is-highlighted").first()).toBeVisible();

    // First move: a1 → h1 (along the rank). Not the target, no reset.
    await page.getByRole("gridcell", { name: "Square h1" }).click();

    // Second select — rook is now at h1.
    await page.getByRole("gridcell", { name: "Square h1" }).click();
    await expect(page.locator(".playhub-board-cell.is-highlighted").first()).toBeVisible();

    // Second move: h1 → h8 (along the file). This captures the target.
    await page.getByRole("gridcell", { name: "Square h8" }).click();

    // Phase flash text appears — "Well done!" (PHASE_FLASH_COPY.success).
    await expect(page.getByText(/well done!/i)).toBeVisible({ timeout: 2_000 });

    // Progress persisted: stars[3] > 0 after completion.
    await page.waitForFunction(() => {
      try {
        const raw = window.localStorage.getItem("chesscito:progress:rook");
        if (!raw) return false;
        const parsed = JSON.parse(raw) as { stars: number[] };
        return Array.isArray(parsed.stars) && parsed.stars[3] > 0;
      } catch {
        return false;
      }
    });
  });
});
