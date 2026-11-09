/**
 * Slice F — verifies the badge mastery helper is behaviour-equivalent to
 * the legacy `totalStars(stars[])` sum, so routing the hook's badge gate
 * through `calculatePoolMasteryFromArray` changes nothing functionally.
 */

import { describe, expect, it } from "vitest";
import { EXERCISES, PLAYABLE_PIECES } from "@/lib/game/exercises";
import { totalStars } from "@/lib/game/scoring";
import { calculatePoolMasteryFromArray } from "@/lib/game/progress-adapter";

describe("pool mastery equivalence (slice F)", () => {
  it("matches totalStars() for every piece across varied progress", () => {
    const samples = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [3, 2, 1, 0, 0, 0, 0, 0, 0, 0],
      [3, 3, 3, 3, 0, 0, 0, 0, 0, 0], // exactly 12 — past threshold
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [3, 3, 3, 3, 3, 3, 3, 3, 3, 3], // full pool
    ];
    for (const piece of PLAYABLE_PIECES) {
      for (const stars of samples) {
        // A positional array only aligns with the pool up to its length; the
        // bishop is 9 (B4.3), so trim the 10-slot fixture to the real pool before
        // comparing the two mastery paths.
        const sized = stars.slice(0, EXERCISES[piece].length);
        expect(calculatePoolMasteryFromArray(piece, sized)).toBe(totalStars(sized));
      }
    }
  });

  it("King append-only pool sums by id, not numeric order", () => {
    // 9 legacy values + appended king-8 slot at 0.
    const legacy = [3, 3, 2, 1, 3, 2, 1, 2, 3, 0];
    expect(calculatePoolMasteryFromArray("king", legacy)).toBe(totalStars(legacy));
    expect(calculatePoolMasteryFromArray("king", legacy)).toBe(20);
  });

  it("clamps stars > 3 (legacy sum would over-count; helper caps per exercise)", () => {
    const stars = [99, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    // Helper clamps to 3; legacy raw sum would be 99. The clamp is the
    // safe behaviour — persisted stars are validated to 0-3 upstream, so
    // this only matters for corrupt data, where capping is correct.
    expect(calculatePoolMasteryFromArray("rook", stars)).toBe(3);
  });

  it("replays do not double-count (id-map holds one best value per id)", () => {
    // Two array slots can never map to the same id, and the value is the
    // best stars for that exercise — so the sum counts each exercise once.
    const stars = [3, 3, 3, 3, 0, 0, 0, 0, 0, 0];
    expect(calculatePoolMasteryFromArray("rook", stars)).toBe(12);
  });
});
