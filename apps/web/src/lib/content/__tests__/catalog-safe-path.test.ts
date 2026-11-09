import { describe, expect, it } from "vitest";
import {
  buildCatalog,
  renderGeneratedModule,
  type LabyrinthRecord,
} from "@/lib/content/catalog";

/**
 * Safe Path rows share content/labyrinths.json with the labyrinths, the Diagonal
 * Run, the Knight's Tour and N-Queens, routed by `kind` into their own bucket.
 *
 * Unlike the coverage kinds, Safe Path DOES have a destination, so it is graded
 * by arrival. But the generic exercise BFS cannot measure it: that BFS walks the
 * king by `getKingMoves`, which knows nothing about threats and would happily
 * route him straight through a watched square. The route has to come from
 * `safePathOptimalMoves`, which is the only thing that reads the attack map.
 *
 * The stakes: a level whose refuge is watched, or whose king is boxed in, is
 * UNWINNABLE. It must fail at import, loudly — not ship and strand a player.
 */

/** King on a1, refuge h8, one black knight on c6.
 *
 *  ⚠️ Two authoring traps, both learned the hard way while writing this file:
 *  the refuge is a bare SQUARE — a white piece parked on the target is a wall
 *  and the king can never arrive; and a black rook on d8 would watch the whole
 *  of rank 8, refuge included, making the level unwinnable.
 *
 *  a1 -> h8 in 7 is ONLY the main diagonal (a king covering 7 files and 7 ranks
 *  in 7 moves must advance both every step), and the knight on c6 watches d4 and
 *  e5 — two rungs of it. So the detour is forced, and measured: 8. */
const safePathRecord = (over: Partial<LabyrinthRecord> = {}): LabyrinthRecord => ({
  id: "safe-path-test",
  piece: "king",
  kind: "safe-path",
  fen: "8/8/2n5/8/8/8/8/K7 w - - 0 1",
  mover: "a1",
  target: "h8",
  order: 0,
  ...over,
});

describe("buildCatalog — safe-path routing", () => {
  it("routes the row to the safePath bucket, never to labyrinths", () => {
    const cat = buildCatalog([], [safePathRecord()], []);

    expect(cat.errors).toEqual([]);
    expect(cat.safePath.king).toHaveLength(1);
    expect(cat.labyrinths.king).toHaveLength(0);
    expect(cat.queens.king).toHaveLength(0);
  });

  it("accepts black pieces — they are the game, not an authoring mistake", () => {
    // Every other non-pawn kind rejects a black piece outright (fen-puzzle:146).
    const cat = buildCatalog([], [safePathRecord()], []);

    expect(cat.errors).toEqual([]);
  });

  it("keeps the enemies typed all the way into the catalog", () => {
    // If the type is lost here, the board cannot draw them and the attack map
    // cannot be recomputed at runtime — the whole point of stage 1.
    const cat = buildCatalog([], [safePathRecord()], []);

    expect(cat.safePath.king[0].enemies).toEqual([
      { pos: { file: 2, rank: 5 }, piece: "knight" },
    ]);
  });

  it("stores the SAFE route length, not the naive king walk", () => {
    // The unguarded walk is 7. The knight watches two rungs of the only 7-move
    // route, so the safe answer is 8 — and a BFS that ignored the threat would
    // confidently say 7 and store a route that kills the player.
    const cat = buildCatalog([], [safePathRecord()], []);

    expect(cat.safePath.king[0].optimalMoves).toBe(8);
  });

  it("rejects a level whose refuge is watched — it can never be won", () => {
    // A bishop ON the main diagonal watches h8 itself. The player would walk the
    // whole route and die on the last square, forever. Easy to author by
    // accident, which is exactly why it fails at import.
    const cat = buildCatalog(
      [],
      [safePathRecord({ fen: "8/8/8/4b3/8/8/8/K7 w - - 0 1" })],
      [],
    );

    expect(cat.safePath.king).toHaveLength(0);
    expect(cat.errors[0]).toContain("no safe route");
  });

  it("rejects a level where the king is sealed in by what the enemies see", () => {
    // Reachable-by-BFS is not achievable: nothing walls the king in, and he
    // still cannot leave. Only the attack map can tell.
    const cat = buildCatalog(
      [],
      [safePathRecord({ fen: "8/8/8/8/8/8/1r6/K7 w - - 0 1" })],
      [],
    );

    expect(cat.safePath.king).toHaveLength(0);
    expect(cat.errors[0]).toContain("no safe route");
  });

  it("warns when the threats never force a detour — decorative danger", () => {
    // A knight parked far from the route: the level is playable, and the player
    // strolls the diagonal without ever reading a threat. Warning, not error —
    // the founder tunes feel in the builder, and refusing his draft is worse
    // than telling him it teaches nothing.
    const cat = buildCatalog(
      [],
      [safePathRecord({ fen: "8/8/8/8/8/8/6n1/K7 w - - 0 1" })],
      [],
    );

    expect(cat.errors).toEqual([]);
    expect(cat.safePath.king).toHaveLength(1);
    expect(cat.warnings.join(" ")).toContain("never force a detour");
  });

  it("still requires a target — safe-path is not a coverage kind", () => {
    const cat = buildCatalog([], [safePathRecord({ target: undefined })], []);

    expect(cat.errors.length).toBeGreaterThan(0);
  });
});

describe("renderGeneratedModule — safe-path", () => {
  it("emits the bucket, so the levels can reach the runtime", () => {
    // A bucket the generator does not emit is a bucket the game never sees.
    const cat = buildCatalog([], [safePathRecord()], []);
    const rendered = renderGeneratedModule(cat);

    expect(rendered).toContain("export const GENERATED_SAFE_PATH");
    expect(rendered).toContain("safe-path-test");
  });
});
