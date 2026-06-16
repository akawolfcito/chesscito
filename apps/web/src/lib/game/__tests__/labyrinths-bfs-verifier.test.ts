import { afterAll, describe, expect, it } from "vitest";
import { LABYRINTHS, PLAYABLE_PIECES } from "@/lib/game/exercises";
import { GENERATED_LABYRINTHS } from "@/lib/game/generated/puzzles.generated";
import { bfsOptimal } from "@/test-utils/bfs-optimal";

/**
 * BFS solvability verifier for the LABYRINTHS catalog — Slice 3A gate
 * of the integrated training path (red-team P0-1).
 *
 * 12 of the 18 catalog labyrinths were dormant until this slice: the
 * legacy toggle only ever played `labyrinthList[0]`, so every lab
 * except each piece's first shipped without a single human play.
 * Before Slice 3B exposes them through path node taps, CI must prove,
 * against the REAL movement engine, that each one:
 *
 *   1. is reachable at all (BFS finds a path under the declared
 *      obstacles/captureTargets);
 *   2. is winnable with stars — BFS minimum within `optimalMoves + 4`,
 *      the 1★ ceiling of `labyrinthStars`;
 *   3. declares an honest `optimalMoves` — BFS minimum must EQUAL the
 *      declaration (same hard-fail mode the exercises verifier uses).
 *      An understated optimal makes 3★ impossible; an overstated one
 *      hands out 3★ for sloppy paths.
 *
 * The afterAll block prints a full piece/lab/declared/BFS table so QA
 * reads the verified inventory straight from the test output.
 */

const STAR_FLOOR_MARGIN = 4; // labyrinthStars: moves <= optimal + 4 → ≥1★

type Row = {
  piece: string;
  id: string;
  declared: number;
  bfs: number | null;
};
const rows: Row[] = [];

describe("BFS verifier — labyrinth solvability + optimalMoves", () => {
  for (const piece of PLAYABLE_PIECES) {
    const labs = LABYRINTHS[piece];
    if (labs.length === 0) continue;
    describe(`piece: ${piece}`, () => {
      labs.forEach((lab) => {
        it(`${lab.id} is solvable and optimalMoves matches BFS`, () => {
          const bfs = bfsOptimal(piece, lab);
          rows.push({ piece, id: lab.id, declared: lab.optimalMoves, bfs });

          // 1. Reachability — a dead labyrinth is a dead end in the path.
          expect(bfs, `${lab.id} unreachable per BFS`).not.toBeNull();
          // 2. Star floor — the optimum must sit within the 1★ ceiling,
          //    otherwise the declared difficulty is impossibly wrong.
          expect(
            bfs!,
            `${lab.id} BFS minimum ${bfs} exceeds optimal+${STAR_FLOOR_MARGIN} (${lab.optimalMoves + STAR_FLOOR_MARGIN})`,
          ).toBeLessThanOrEqual(lab.optimalMoves + STAR_FLOOR_MARGIN);
          // 3. Honest optimum — hard fail on drift, mirroring the
          //    exercises verifier promotion (Sprint 2 commit A).
          expect(
            bfs,
            `${lab.id} declared optimalMoves=${lab.optimalMoves} but BFS minimum is ${bfs}`,
          ).toBe(lab.optimalMoves);
        });
      });
    });
  }

  // Inventory guard: the verifier runs over the FULL catalog. Since the 18
  // originally hand-authored labs were migrated into content/labyrinths.json
  // (2026-06-16, scripts/migrate-labyrinths.ts), `LABYRINTHS[piece]` now sources
  // entirely from GENERATED_LABYRINTHS[piece] — so the live map and the
  // generated pool are identical. The real guard is that every catalog entry
  // produced a verifier row (nothing skipped). The floor of 18 migrated labs is
  // pinned too.
  it("covers the full merged catalog (every labyrinth verified)", () => {
    const total = PLAYABLE_PIECES.reduce(
      (sum, piece) => sum + LABYRINTHS[piece].length,
      0,
    );
    const generated = PLAYABLE_PIECES.reduce(
      (sum, piece) => sum + GENERATED_LABYRINTHS[piece].length,
      0,
    );
    expect(total).toBe(generated); // catalog is generated-sourced
    expect(total).toBeGreaterThanOrEqual(18); // 18 migrated labs floor
    expect(rows.length).toBe(total); // every entry produced a verifier row
  });

  afterAll(() => {
    const table = rows
      .map(
        (r) =>
          `${r.piece.padEnd(7)} ${r.id.padEnd(14)} declared=${String(r.declared).padEnd(2)} bfs=${r.bfs ?? "UNREACHABLE"} ${r.bfs === r.declared ? "OK" : "NEEDS REVIEW"}`,
      )
      .join("\n");
    // eslint-disable-next-line no-console
    console.log(`[Labyrinth BFS verifier]\n${table}`);
  });
});
