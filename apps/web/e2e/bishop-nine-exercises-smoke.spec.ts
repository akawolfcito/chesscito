import { test, expect, type Page } from "@playwright/test";

/**
 * The nine bishop exercises (B4.3), played end to end — the net under the
 * curated curriculum, mirroring the rook smoke. For every exercise it proves:
 *   1. Resume: the seeded currentId opens exactly that exercise.
 *   2. The board stages its blockers as the player's OWN knights (never a wall).
 *   3. It is solvable by the BFS-optimal route, worth full marks.
 * bishop-9 is gone; bishop-10 is the ninth and last slot.
 */
type Slot = { slot: number; id: string; target: string; blockers: number; path: string[] };

const SLOTS: Slot[] = [
  { slot: 1, id: "bishop-1", target: "h8", blockers: 0, path: ["h8"] },
  { slot: 2, id: "bishop-2", target: "a8", blockers: 0, path: ["a8"] },
  { slot: 3, id: "bishop-3", target: "g7", blockers: 0, path: ["g7"] },
  { slot: 4, id: "bishop-4", target: "g1", blockers: 0, path: ["d4", "g1"] },
  { slot: 5, id: "bishop-5", target: "g3", blockers: 0, path: ["e5", "g3"] },
  { slot: 6, id: "bishop-6", target: "f2", blockers: 1, path: ["c3", "e1", "f2"] },
  { slot: 7, id: "bishop-7", target: "g3", blockers: 2, path: ["d4", "f2", "g3"] },
  { slot: 8, id: "bishop-8", target: "g7", blockers: 1, path: ["b2", "c1", "h6", "g7"] },
  { slot: 9, id: "bishop-10", target: "h8", blockers: 1, path: ["b2", "c1", "g5", "f6", "h8"] },
];

const POOL = SLOTS.map((s) => s.id);
const MOVER = ".playhub-board-piece-float:not(.is-friendly-blocker)";
const HIGHLIGHT = ".playhub-board-cell.is-highlighted";

async function pickUpBishop(page: Page) {
  await expect(async () => {
    await page.locator(MOVER).first().click();
    await expect(page.locator(HIGHLIGHT).first()).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

for (const { slot, id, target, blockers, path } of SLOTS) {
  test(`exercise ${slot} (${id}) — opens, stages its blockers, and solves in ${path.length}`, async ({
    page,
  }) => {
    const done = POOL.slice(0, slot - 1);
    await page.addInitScript(
      (s: { currentId: string; done: string[] }) => {
        window.localStorage.setItem("chesscito:onboarded", "true");
        window.localStorage.setItem(
          "chesscito:progress:bishop",
          JSON.stringify({
            piece: "bishop",
            currentId: s.currentId,
            stars: Object.fromEntries(s.done.map((exId) => [exId, 3])),
          }),
        );
      },
      { currentId: id, done },
    );

    await page.goto("/en/exercises?piece=bishop");
    await page.waitForLoadState("networkidle");

    // 1 — RESUME. The seeded id opened this exercise; the mission chip proves it.
    await expect(page.getByText(new RegExp(`move to ${target}`, "i")).first()).toBeVisible({
      timeout: 15_000,
    });

    // 2 — THE BOARD STAGES THE CONTENT. Bishop blockers are the player's own
    // knights (A9); the maze's stone wall must never appear.
    await expect(page.locator(".playhub-board-piece-float.is-friendly-blocker")).toHaveCount(
      blockers,
    );
    await expect(page.locator(".playhub-board-cell.is-wall")).toHaveCount(0);

    // 3 — SOLVABLE BY THE SHORTEST ROUTE.
    for (const square of path) {
      await pickUpBishop(page);
      await page.getByRole("gridcell", { name: `Square ${square}` }).click();
    }

    // Full marks for the optimal route — the persisted result, not a transient toast.
    await expect
      .poll(
        async () =>
          page.evaluate((exId: string) => {
            const raw = window.localStorage.getItem("chesscito:progress:bishop");
            if (!raw) return null;
            return (JSON.parse(raw) as { stars: Record<string, number> }).stars[exId] ?? 0;
          }, id),
        { timeout: 5_000 },
      )
      .toBe(3);
  });
}
