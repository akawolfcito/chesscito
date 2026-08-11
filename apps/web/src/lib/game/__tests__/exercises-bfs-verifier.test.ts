import { afterAll, describe, expect, it } from "vitest";
import { EXERCISES, PLAYABLE_PIECES } from "@/lib/game/exercises";
import { computeSweepOptimal } from "@/lib/game/sweep-optimal";
import { isSweep } from "@/lib/game/targets";
import { bfsOptimal } from "@/test-utils/bfs-optimal";

/**
 * BFS verifier for exercise `optimalMoves` declarations.
 *
 * Sprint 2 commit A (Training Economy Alpha 2026-06-06) — promoted
 * from warning mode to **hard fail**. Sprint 1 cleared every legacy
 * mismatch (knight-5 a1→e5 → a1→e4 fix in commit 25fdfbee) and the
 * Sprint 1 closure run was 34/34 green, so the warning collector is
 * removed and each exercise's optimalMoves is now a hard assertion.
 *
 * From this point forward, ANY new authored exercise whose declared
 * `optimalMoves` disagrees with the BFS minimum breaks the suite. The
 * test name is the exercise ID, so vitest output points the author
 * directly at the offending entry.
 *
 * BFS protocol: see `@/test-utils/bfs-optimal` — extracted to a shared
 * helper in Slice 3A so the labyrinths verifier
 * (labyrinths-bfs-verifier.test.ts) runs the exact same solver.
 */

let allPassed = true;

describe("BFS verifier — exercise optimalMoves", () => {
  for (const piece of PLAYABLE_PIECES) {
    describe(`piece: ${piece}`, () => {
      EXERCISES[piece].forEach((ex) => {
        it(`${ex.id} optimalMoves matches BFS`, () => {
          // ⚠️ A Star Sweep is verified by a DIFFERENT solver. `bfsOptimal`
          // answers "shortest path to targetPos", and on a sweep `targetPos` is
          // merely `targets[0]` — so it measures one leg of a route and would
          // report a minimum far below the real one. Comparing against it here
          // would not catch drift; it would MANUFACTURE it.
          const declared = ex.optimalMoves;
          const solved = isSweep(ex)
            ? computeSweepOptimal(piece, ex)
            : bfsOptimal(piece, ex);
          // Reachability: every exercise must be solvable from the
          // declared startPos under the declared obstacles/captureTargets.
          expect(solved, `${ex.id} unreachable per solver`).not.toBeNull();
          // Optimality: the declared optimalMoves MUST equal the solver's
          // minimum. Hard fail mode — any drift breaks the suite.
          if (solved !== declared) allPassed = false;
          expect(solved).toBe(declared);
        });
      });
    });
  }

  afterAll(() => {
    if (!allPassed) return;
    // eslint-disable-next-line no-console
    console.log(
      "[BFS verifier] All exercises pass optimalMoves verification ✅",
    );
  });
});
