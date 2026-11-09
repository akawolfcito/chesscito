import { test, expect, type Page } from "@playwright/test";

import { GENERATED_EXERCISES } from "@/lib/game/generated/puzzles.generated";
import { computeExerciseBfsPath } from "@/lib/game/exercise-bfs";
import { exerciseTargets } from "@/lib/game/targets";
import type { BoardPosition, Exercise } from "@/lib/game/types";

/**
 * The bishop curriculum, played end to end — the net under the curated pool.
 *
 * ⛔ WHY EVERYTHING HERE IS DERIVED AND NOTHING IS TYPED OUT
 * ---------------------------------------------------------
 * This file used to carry a hand-written table: ten rows of id, target square
 * and the exact route to walk. It rotted in silence. By 2026-08-11 it claimed
 * `bishop-2` sent the player to a8 while the content had said h1 for weeks, and
 * `bishop-5` and `bishop-6` were wrong too — every row a photograph of a board
 * that no longer existed. A spec that pins authored content does not protect the
 * content, it only fails at the author.
 *
 * So the catalog IS the fixture: ids, order, blockers, goals and the optimal
 * route all come out of GENERATED_EXERCISES, and the route is computed by the
 * same BFS that authored `optimalMoves`. Reordering the curriculum, converting a
 * board to a Star Sweep or authoring a new one stays green here — while an
 * exercise that becomes unsolvable, stops staging its blockers or stops paying
 * full marks for the best route still fails.
 *
 * What it proves, per exercise:
 *   1. Resume: the seeded currentId opens exactly that board (its title says so).
 *   2. The board stages its blockers as the player's OWN knights, never a wall.
 *   3. It is solvable by the optimal route, and that route is worth full marks.
 */

const POOL = GENERATED_EXERCISES.bishop;
const IDS = POOL.map((ex) => ex.id);
const MOVER = ".playhub-board-piece-float:not(.is-friendly-blocker)";
const HIGHLIGHT = ".playhub-board-cell.is-highlighted";
const FILES = "abcdefgh";

const label = (p: BoardPosition) => `${FILES[p.file]}${p.rank + 1}`;

/**
 * The cheapest route that collects every goal, as squares to tap.
 *
 * A Star Sweep is collected in ANY order and the cheap order IS the level, so
 * the legs are searched over every permutation — summing the authored order
 * would walk a longer route and the test would then demand 3 stars for it.
 * Legs are measured with `computeExerciseBfsPath`, the same expansion gameplay
 * uses, so the route offered here is a route the board actually allows.
 */
function optimalRoute(exercise: Exercise): string[] {
  const goals = exerciseTargets(exercise);
  type Route = { cost: number; squares: string[] };
  let best: Route | null = null;

  const walk = (from: BoardPosition, remaining: BoardPosition[], sofar: string[], cost: number) => {
    if (best && cost >= best.cost) return;
    if (remaining.length === 0) {
      best = { cost, squares: sofar };
      return;
    }
    for (let i = 0; i < remaining.length; i += 1) {
      const to = remaining[i];
      const leg = computeExerciseBfsPath("bishop", {
        ...exercise,
        startPos: from,
        targetPos: to,
      });
      if (!leg) continue; // this leg is impossible; another order may not be
      walk(
        to,
        [...remaining.slice(0, i), ...remaining.slice(i + 1)],
        // `path` includes its own start square, which the previous leg already
        // walked onto — tapping it again would waste a move and cost a star.
        [...sofar, ...leg.path.slice(1).map(label)],
        cost + leg.optimalMoves,
      );
    }
  };
  walk(exercise.startPos, goals, [], 0);

  const route = best as Route | null;
  if (!route) throw new Error(`${exercise.id}: no route collects every goal`);
  return route.squares;
}

/**
 * Tap the piece to pick it up.
 *
 * Retried on purpose. The sprite is the drag handle and it drops pointerdown
 * while `mountedRef` is still false — a rejection that leaves no trace in the
 * DOM, so Playwright's auto-wait cannot see it and a single tap is a race.
 */
async function pickUpBishop(page: Page) {
  await expect(async () => {
    await page.locator(MOVER).first().click();
    await expect(page.locator(HIGHLIGHT).first()).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

POOL.forEach((exercise, index) => {
  const route = optimalRoute(exercise);
  const blockers = exercise.obstacles?.length ?? 0;

  test(`exercise ${index + 1} (${exercise.id}) — opens, stages its blockers, and solves in ${route.length}`, async ({
    page,
  }) => {
    // Seed by id. Deriving the exercise from an index is what the old resume bug
    // was made of — naming the id is the contract the app actually keeps.
    //
    // ⛔ Every OTHER board is seeded solved, not just the earlier ones. The daily
    // rotation only surfaces five exercises, ordered by stars ascending and then
    // by a hash of `seed + UTC DATE + piece` — so "the previous ones are done"
    // leaves which of the six unsolved boards is visible up to today's date, and
    // the spec passes or fails depending on the day it runs. It did: seeding only
    // the earlier ones opened bishop-6 for a test that asked for bishop-7.
    // Leaving exactly one board at 0★ puts it first in that ordering on every
    // date. (27★ also clears MEDIUM_UNLOCK_STARS, so no tier is locked.)
    const done = IDS.filter((id) => id !== exercise.id);
    await page.addInitScript(
      (s: { currentId: string; done: string[] }) => {
        window.localStorage.setItem("chesscito:onboarded", "true");
        window.localStorage.setItem(
          "chesscito:progress:bishop",
          JSON.stringify({
            piece: "bishop",
            currentId: s.currentId,
            // 3 stars each: mastery has to clear MEDIUM_UNLOCK_STARS or the tier
            // the later boards live in stays locked and the pool never shows.
            stars: Object.fromEntries(s.done.map((exId) => [exId, 3])),
          }),
        );
      },
      { currentId: exercise.id, done },
    );

    await page.goto("/en/exercises?piece=bishop");
    await page.waitForLoadState("networkidle");

    // 1 — RESUME. The curated title is the exercise's identity on screen, and it
    // is unique per board, so it can prove WHICH one opened. (The mission chip
    // names the target square, which several boards share.)
    await expect(page.getByText(exercise.title!, { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });

    // 2 — THE BOARD STAGES THE CONTENT. Bishop blockers are the player's own
    // knights; the maze's stone wall belongs to the maze and must never appear.
    await expect(page.locator(".playhub-board-piece-float.is-friendly-blocker")).toHaveCount(
      blockers,
    );
    await expect(page.locator(".playhub-board-cell.is-wall")).toHaveCount(0);

    // 3 — IT IS SOLVABLE, BY THE OPTIMAL ROUTE.
    for (const square of route) {
      await pickUpBishop(page);
      await page.getByRole("gridcell", { name: `Square ${square}` }).click();
    }

    // Success is asserted on the PERSISTED result, not on anything that flashes:
    // the toast is transient and the last board hands over to the badge flow.
    // Walking the optimal route IS the definition of 3 stars, so anything less
    // means the scoring drifted from the BFS that authored the exercise.
    await expect
      .poll(
        async () =>
          page.evaluate((exId: string) => {
            const raw = window.localStorage.getItem("chesscito:progress:bishop");
            if (!raw) return null;
            return (JSON.parse(raw) as { stars: Record<string, number> }).stars[exId] ?? 0;
          }, exercise.id),
        { timeout: 5_000 },
      )
      .toBe(3);
  });
});
