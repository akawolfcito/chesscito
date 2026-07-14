import { test, expect } from "@playwright/test";

/**
 * Capturing an enemy piece — the pawn, because the pawn is the only piece that
 * captures. (The rook models everything blocking its path as an obstacle it must
 * go around; capture is a pawn mechanic, see fen-puzzle.ts.) This used to point at
 * a "rook capture exercise" that no longer exists — a dead premise on a dead URL
 * (`/` is the hub now) — so it was red while looking like coverage. It now exercises
 * the real thing.
 *
 * pawn-3 is the first capture in the pawn curriculum: c5 × d6 in a single diagonal
 * move. It proves:
 *  - the mission chip reads "Capture", not a bare coordinate;
 *  - taking the target sets phase=success and persists 3 stars for the exercise.
 *
 * Progress is seeded in the shape the app actually stores — `currentId` + an
 * id-keyed stars map — not the legacy positional array, which no longer credits
 * stars at all (it is ambiguous after the A6 reorder; see
 * use-exercise-progress-migration.test.ts). Seeding legacy here would hand the test
 * a zero-star player and quietly test less than it claims to.
 */

// pawn-3 in the pawn curriculum, and the three exercises before it (pawn-1,
// pawn-2), so mastery is non-trivial and the resume lands on the right board.
const POOL_BEFORE = ["pawn-1", "pawn-2"];
const TARGET_ID = "pawn-3";

test.describe("Play hub — pawn capture exercise", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      (seed: { currentId: string; done: string[] }) => {
        window.localStorage.setItem("chesscito:onboarded", "true");
        window.localStorage.setItem(
          "chesscito:progress:pawn",
          JSON.stringify({
            piece: "pawn",
            currentId: seed.currentId,
            stars: Object.fromEntries(seed.done.map((id) => [id, 3])),
          }),
        );
      },
      { currentId: TARGET_ID, done: POOL_BEFORE },
    );
  });

  test("mission chip reads Capture on a capture exercise", async ({ page }) => {
    await page.goto("/en/exercises?piece=pawn");
    await page.waitForLoadState("networkidle");

    // The mission peek chip shows "Capture" for capture exercises rather than a
    // target coordinate — see mission-panel-candy.tsx.
    const missionChip = page.getByRole("button", {
      name: /open mission details.*capture/i,
    });
    await expect(missionChip).toBeVisible({ timeout: 15_000 });
  });

  test("c5 × d6 captures the target and marks the exercise complete", async ({ page }) => {
    await page.goto("/en/exercises?piece=pawn");
    await page.waitForLoadState("networkidle");

    // Confirm we resumed onto pawn-3 and not another board.
    await expect(page.getByText(/capture/i).first()).toBeVisible({ timeout: 15_000 });

    // Pick up the pawn. Retried because the sprite drops pointerdown while
    // `mountedRef` is still false — a rejection with no DOM trace, so a single tap
    // is a race. Retry until the legal moves light up.
    const pawn = page.locator(
      ".playhub-board-piece-float:not(.is-friendly-blocker)",
    ).first();
    const highlights = page.locator(".playhub-board-cell.is-highlighted");
    await expect(async () => {
      await pawn.click();
      await expect(highlights.first()).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });

    // c5 × d6 — the diagonal capture, one move, worth full marks.
    await page.getByRole("gridcell", { name: "Square d6" }).click();

    // Asserted on the persisted result, not the transient "Well done!" flash.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const raw = window.localStorage.getItem("chesscito:progress:pawn");
            if (!raw) return null;
            return (JSON.parse(raw) as { stars: Record<string, number> }).stars["pawn-3"] ?? 0;
          }),
        { timeout: 5_000 },
      )
      .toBe(3);
  });
});
