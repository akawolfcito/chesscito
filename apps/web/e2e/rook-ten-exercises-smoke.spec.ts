import { test, expect, type Page } from "@playwright/test";

/**
 * The ten rook exercises, played end to end.
 *
 * This is the net under the curriculum. For every exercise it proves three
 * separate things that used to be assumed:
 *
 *  1. **Resume works.** Seeding `currentId` opens EXACTLY that exercise. This is
 *     the browser-level proof of the resume fix — before it, a valid id landed the
 *     player on exercise 1 intermittently, and the flake was invisible to the
 *     tests because nothing checked which board had actually loaded.
 *
 *  2. **The board stages what the content promised.** Blockers appear, and they
 *     appear as the player's OWN pieces (A9) — never the labyrinth's stone wall.
 *
 *  3. **The exercise is solvable, by the route the BFS says is optimal.** The
 *     path below is not hand-written: it is the shortest path, and the game must
 *     award 3 stars for walking it. A content change that quietly makes an
 *     exercise longer, unsolvable, or free will fail here.
 *
 * Deliberately NOT asserted: the opening-move count. That is the curriculum's
 * shape rather than its function, it is argued about on purpose (plan §15.7.0),
 * and pinning it here would make every pedagogy tweak look like a broken build.
 */

type Slot = {
  slot: number;
  id: string;
  target: string;
  blockers: number;
  /** The shortest route. Walking it must be worth full marks. */
  path: string[];
};

const SLOTS: Slot[] = [
  { slot: 1, id: "rook-1", target: "h1", blockers: 0, path: ["h1"] },
  { slot: 2, id: "rook-2", target: "a8", blockers: 0, path: ["a8"] },
  { slot: 3, id: "rook-distance-1", target: "d6", blockers: 0, path: ["d6"] },
  { slot: 4, id: "rook-no-diagonal-1", target: "e5", blockers: 0, path: ["e4", "e5"] },
  { slot: 5, id: "rook-4", target: "b2", blockers: 0, path: ["b7", "b2"] },
  { slot: 6, id: "rook-9", target: "c3", blockers: 2, path: ["b1", "b3", "c3"] },
  { slot: 7, id: "rook-10", target: "d5", blockers: 4, path: ["f1", "f6", "d6", "d5"] },
  { slot: 8, id: "rook-8", target: "e5", blockers: 2, path: ["c4", "c6", "e6", "e5"] },
  { slot: 9, id: "rook-6", target: "d2", blockers: 7, path: ["f6", "f2", "d2"] },
  { slot: 10, id: "rook-7", target: "d5", blockers: 11, path: ["g1", "g4", "d4", "d5"] },
];

const POOL = SLOTS.map((s) => s.id);
const MOVER = ".playhub-board-piece-float:not(.is-friendly-blocker)";
const HIGHLIGHT = ".playhub-board-cell.is-highlighted";

/**
 * Tap the piece to pick it up.
 *
 * Retried on purpose. The sprite is the drag handle and it drops pointerdown
 * while `mountedRef` is still false — a rejection that leaves no trace in the
 * DOM, so Playwright's auto-wait cannot see it and a single tap is a race.
 * Retrying until the legal moves light up is the only honest signal that the
 * piece is actually in hand.
 */
async function pickUpRook(page: Page) {
  await expect(async () => {
    await page.locator(MOVER).first().click();
    await expect(page.locator(HIGHLIGHT).first()).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

for (const { slot, id, target, blockers, path } of SLOTS) {
  test(`exercise ${slot} (${id}) — opens, stages its blockers, and solves in ${path.length}`, async ({
    page,
  }) => {
    // Seed by id. `exerciseIndex` is the legacy shape and no longer certifies
    // anything, and deriving the exercise from an index is what the resume bug
    // was made of — naming the id is the contract the app actually keeps.
    const done = POOL.slice(0, slot - 1);
    await page.addInitScript(
      (s: { currentId: string; done: string[] }) => {
        window.localStorage.setItem("chesscito:onboarded", "true");
        window.localStorage.setItem(
          "chesscito:progress:rook",
          JSON.stringify({
            piece: "rook",
            currentId: s.currentId,
            // 3 stars each: mastery has to clear MEDIUM_UNLOCK_STARS, or the tier
            // the later exercises live in stays locked and the pool never shows.
            stars: Object.fromEntries(s.done.map((exId) => [exId, 3])),
          }),
        );
      },
      { currentId: id, done },
    );

    await page.goto("/en/exercises?piece=rook");
    await page.waitForLoadState("networkidle");

    // 1 — RESUME. The seeded id opened this exercise and not another. The mission
    // chip is the only exercise identity on screen, so it is what can prove it.
    await expect(page.getByText(new RegExp(`move to ${target}`, "i")).first()).toBeVisible({
      timeout: 15_000,
    });

    // 2 — THE BOARD STAGES THE CONTENT. Blockers are the player's own pieces here;
    // the maze's stone wall belongs to the maze and must never appear.
    await expect(page.locator(".playhub-board-piece-float.is-friendly-blocker")).toHaveCount(
      blockers,
    );
    await expect(page.locator(".playhub-board-cell.is-wall")).toHaveCount(0);

    // 3 — IT IS SOLVABLE, BY THE SHORTEST ROUTE.
    for (const square of path) {
      await pickUpRook(page);
      await page.getByRole("gridcell", { name: `Square ${square}` }).click();
    }

    // Success is asserted on the PERSISTED result, not on any of the things that
    // flash on screen. The "Well done!" toast is transient; the "You earned 3
    // stars" card is replaced by the badge flow on the last exercise, which also
    // advances the board — so every visible cue here is a race against an
    // animation that differs per slot. What the player keeps is the progress.
    //
    // Walking the optimal route IS the definition of 3 stars, so anything less
    // means the scoring has drifted from the BFS that authored the exercise.
    await expect
      .poll(
        async () =>
          page.evaluate((exId: string) => {
            const raw = window.localStorage.getItem("chesscito:progress:rook");
            if (!raw) return null;
            return (JSON.parse(raw) as { stars: Record<string, number> }).stars[exId] ?? 0;
          }, id),
        { timeout: 5_000 },
      )
      .toBe(3);
  });
}
