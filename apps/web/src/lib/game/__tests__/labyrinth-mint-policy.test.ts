import { describe, expect, it } from "vitest";
import type { Exercise, PieceId } from "@/lib/game/types";
import { LABYRINTHS } from "@/lib/game/exercises";
import {
  assertValidLabyrinthMintPolicy,
  resolveLabyrinthMintPolicy,
  validateLabyrinthMintPolicy,
} from "@/lib/game/labyrinth-mint-policy";

/** Minimal Exercise stub for policy-only tests. The board geometry is
 *  irrelevant to the resolver; only the new metadata fields matter. */
const baseExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: "test-lab-1",
  startPos: { file: 0, rank: 0 },
  targetPos: { file: 7, rank: 7 },
  optimalMoves: 3,
  ...overrides,
});

describe("resolveLabyrinthMintPolicy — default resolution (spec §4.2)", () => {
  it("legacy labyrinth with no fields resolves to all defaults", () => {
    const resolved = resolveLabyrinthMintPolicy(baseExercise());
    expect(resolved).toEqual({
      mintable: true,
      leaderboardEligible: false,
      rewardEligible: false,
      campaignEligible: false,
      minStarsToMint: 1,
      minStarsForReward: null,
      seasonId: null,
      campaignId: null,
      partnerId: null,
      rewardTier: "none",
    });
  });

  it("rewardEligible=true resolves rewardTier to in_game by default", () => {
    const resolved = resolveLabyrinthMintPolicy(
      baseExercise({ rewardEligible: true }),
    );
    expect(resolved.rewardTier).toBe("in_game");
  });

  it("rewardEligible=true + minStarsToMint=3 resolves minStarsForReward=3 when omitted", () => {
    const resolved = resolveLabyrinthMintPolicy(
      baseExercise({ rewardEligible: true, minStarsToMint: 3 }),
    );
    expect(resolved.minStarsForReward).toBe(3);
    expect(resolved.minStarsToMint).toBe(3);
  });

  it("rewardEligible=false leaves minStarsForReward as null even if field is set on the exercise", () => {
    const resolved = resolveLabyrinthMintPolicy(
      baseExercise({ rewardEligible: false, minStarsForReward: 2 }),
    );
    expect(resolved.minStarsForReward).toBeNull();
  });

  it("explicit rewardTier overrides the rewardEligible-derived default", () => {
    const resolved = resolveLabyrinthMintPolicy(
      baseExercise({ rewardEligible: true, rewardTier: "partner" }),
    );
    expect(resolved.rewardTier).toBe("partner");
  });

  it("absent ids and minStarsForReward resolve to null (not undefined) — resolver contract", () => {
    const resolved = resolveLabyrinthMintPolicy(baseExercise());
    // Use toBe(null) — stricter than toEqual; fails if any value is
    // undefined. Locks the resolver's null-normalization contract.
    expect(resolved.seasonId).toBe(null);
    expect(resolved.campaignId).toBe(null);
    expect(resolved.partnerId).toBe(null);
    expect(resolved.minStarsForReward).toBe(null);
  });

  it("preserves seasonId / campaignId / partnerId when set", () => {
    const resolved = resolveLabyrinthMintPolicy(
      baseExercise({
        seasonId: "2026-Q3",
        campaignId: "rook-week-2026-06",
        partnerId: "celo",
      }),
    );
    expect(resolved.seasonId).toBe("2026-Q3");
    expect(resolved.campaignId).toBe("rook-week-2026-06");
    expect(resolved.partnerId).toBe("celo");
  });
});

describe("validateLabyrinthMintPolicy — invariants (spec §4.3)", () => {
  it("campaignEligible=true without campaignId fails validation", () => {
    const result = validateLabyrinthMintPolicy(
      baseExercise({ campaignEligible: true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain(
        "campaignEligible=true requires campaignId to be set",
      );
    }
  });

  it('rewardTier="partner" without rewardEligible fails validation', () => {
    const result = validateLabyrinthMintPolicy(
      baseExercise({ rewardTier: "partner" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toContain("rewardTier");
      expect(result.errors[0]).toContain("rewardEligible=true");
    }
  });

  it("leaderboardEligible=true + mintable=false fails validation", () => {
    const result = validateLabyrinthMintPolicy(
      baseExercise({ leaderboardEligible: true, mintable: false }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toContain("leaderboardEligible=true");
      expect(result.errors[0]).toContain("mintable");
    }
  });

  it("invalid minStarsToMint fails validation", () => {
    // Cast required: the TS type is `1 | 2 | 3` so out-of-band values
    // are unreachable from typed callers; the runtime check exists for
    // catalogs loaded from JSON or external configs.
    const bad = baseExercise({ minStarsToMint: 5 as unknown as 1 | 2 | 3 });
    const result = validateLabyrinthMintPolicy(bad);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toContain("minStarsToMint");
    }
  });

  it("invalid minStarsForReward fails validation", () => {
    const bad = baseExercise({
      rewardEligible: true,
      minStarsForReward: 0 as unknown as 1 | 2 | 3,
    });
    const result = validateLabyrinthMintPolicy(bad);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toContain("minStarsForReward");
    }
  });

  it("valid campaign lab passes validation", () => {
    const valid = baseExercise({
      mintable: true,
      campaignEligible: true,
      campaignId: "rook-week-2026-06",
      rewardEligible: true,
      rewardTier: "partner",
      minStarsToMint: 2,
      minStarsForReward: 3,
      seasonId: "2026-Q3",
      partnerId: "celo",
      leaderboardEligible: true,
    });
    const result = validateLabyrinthMintPolicy(valid);
    expect(result.valid).toBe(true);
  });

  it("aggregates multiple errors in a single validation pass", () => {
    const result = validateLabyrinthMintPolicy(
      baseExercise({
        campaignEligible: true,
        rewardTier: "mystery",
        leaderboardEligible: true,
        mintable: false,
      }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("assertValidLabyrinthMintPolicy — throwing wrapper", () => {
  it("throws with the labyrinth id and joined errors on invalid input", () => {
    expect(() =>
      assertValidLabyrinthMintPolicy(
        baseExercise({ id: "bad-lab", campaignEligible: true }),
      ),
    ).toThrow(/bad-lab/);
  });

  it("does not throw on a valid baseline labyrinth", () => {
    expect(() => assertValidLabyrinthMintPolicy(baseExercise())).not.toThrow();
  });
});

describe("LABYRINTHS catalog — mint policy regression guard", () => {
  const PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];
  const allLabs = PIECES.flatMap((piece) =>
    LABYRINTHS[piece].map((lab) => ({ piece, lab })),
  );

  it.each(allLabs.map(({ piece, lab }) => [piece, lab.id, lab] as const))(
    "%s labyrinth %s passes mint policy validation",
    (_piece, _id, lab) => {
      expect(() => assertValidLabyrinthMintPolicy(lab)).not.toThrow();
    },
  );

  it.each(allLabs.map(({ piece, lab }) => [piece, lab.id, lab] as const))(
    "%s labyrinth %s resolves to a fully concrete policy",
    (_piece, _id, lab) => {
      const resolved = resolveLabyrinthMintPolicy(lab);
      expect(resolved).toMatchObject({
        mintable: expect.any(Boolean),
        leaderboardEligible: expect.any(Boolean),
        rewardEligible: expect.any(Boolean),
        campaignEligible: expect.any(Boolean),
        minStarsToMint: expect.any(Number),
        rewardTier: expect.any(String),
      });
    },
  );
});
