import { afterAll, describe, expect, it } from "vitest";
import { EXERCISES, PLAYABLE_PIECES } from "@/lib/game/exercises";
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
          const bfs = bfsOptimal(piece, ex);
          // Reachability: every exercise must be solvable from the
          // declared startPos under the declared obstacles/captureTargets.
          expect(bfs, `${ex.id} unreachable per BFS`).not.toBeNull();
          // Optimality: the declared optimalMoves MUST equal the BFS
          // minimum. Hard fail mode — any drift breaks the suite.
          if (bfs !== ex.optimalMoves) allPassed = false;
          expect(bfs).toBe(ex.optimalMoves);
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
