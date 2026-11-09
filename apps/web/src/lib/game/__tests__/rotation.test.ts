import { describe, expect, it } from "vitest";
import { EXERCISES, PLAYABLE_PIECES } from "@/lib/game/exercises";
import { GENERATED_EXERCISES } from "@/lib/game/generated/puzzles.generated";
import {
  CANONICAL_FIVE_COUNT,
  DAILY_VISIBLE_LIMIT,
  getCanonicalFive,
  getExercisePool,
  getPieceMasteryStars,
  getUnlockedTiers,
  getVisibleExercisesForToday,
  type ExerciseStarsById,
} from "@/lib/game/rotation";
import type { PieceId } from "@/lib/game/types";

/** Build an id-map that gives `piece` the requested total mastery by
 *  spreading 3★ across its first exercises (deterministic, simple). */
function masteryMap(piece: PieceId, totalStars: number): ExerciseStarsById {
  const map: ExerciseStarsById = {};
  let remaining = totalStars;
  for (const ex of EXERCISES[piece]) {
    if (remaining <= 0) break;
    const give = Math.min(3, remaining);
    map[ex.id] = give;
    remaining -= give;
  }
  return map;
}

describe("rotation — getExercisePool", () => {
  it("returns the full pool (content-sourced from GENERATED_EXERCISES) for every piece", () => {
    for (const piece of PLAYABLE_PIECES) {
      // Exercises are fully content-sourced (migrated into content/exercises.json
      // 2026-06-16), so EXERCISES[piece] === GENERATED_EXERCISES[piece]. That
      // equality is the invariant here.
      //
      // The pool SIZE is not: it was pinned at `bishop ? 9 : 10` and went stale
      // the day the bishop got its tenth board (2026-08-11). Authoring a board is
      // not a regression, so all that is enforced is that a pool is never empty.
      expect(getExercisePool(piece)).toHaveLength(GENERATED_EXERCISES[piece].length);
      expect(GENERATED_EXERCISES[piece].length).toBeGreaterThan(0);
    }
  });

  it("returns a copy that cannot mutate the catalog", () => {
    const pool = getExercisePool("rook");
    pool.pop();
    expect(EXERCISES.rook).toHaveLength(10);
  });
});

describe("rotation — getCanonicalFive", () => {
  it("returns the first 5 exercise ids of the pool per piece", () => {
    for (const piece of PLAYABLE_PIECES) {
      const five = getCanonicalFive(piece);
      expect(five).toHaveLength(CANONICAL_FIVE_COUNT);
      expect(five.map((e) => e.id)).toEqual(
        EXERCISES[piece].slice(0, 5).map((e) => e.id),
      );
    }
  });
});

describe("rotation — getUnlockedTiers", () => {
  it("0★ → Easy only", () => {
    expect(getUnlockedTiers(0)).toEqual(["easy"]);
  });
  it("4★ → still Easy only (below Medium gate)", () => {
    expect(getUnlockedTiers(4)).toEqual(["easy"]);
  });
  it("5★ → Easy + Medium", () => {
    expect(getUnlockedTiers(5)).toEqual(["easy", "medium"]);
  });
  it("8★ → still Easy + Medium (below Hard gate)", () => {
    expect(getUnlockedTiers(8)).toEqual(["easy", "medium"]);
  });
  it("9★ → Easy + Medium + Hard", () => {
    expect(getUnlockedTiers(9)).toEqual(["easy", "medium", "hard"]);
  });
});

describe("rotation — getPieceMasteryStars", () => {
  it("returns 0 with no progress", () => {
    expect(getPieceMasteryStars("rook")).toBe(0);
  });
  it("sums best stars across the pool, clamped to 3 each", () => {
    const map: ExerciseStarsById = { "rook-1": 3, "rook-2": 2, "rook-distance-1": 99 };
    expect(getPieceMasteryStars("rook", map)).toBe(8); // 3 + 2 + 3
  });
});

describe("rotation — getVisibleExercisesForToday", () => {
  const seed = "0xWALLET";
  const date = "2026-06-08";

  it("never returns more than the daily limit", () => {
    for (const piece of PLAYABLE_PIECES) {
      const visible = getVisibleExercisesForToday({
        piece,
        walletOrSessionSeed: seed,
        dateUtc: date,
        progress: masteryMap(piece, 9), // unlock everything available
      });
      expect(visible.length).toBeLessThanOrEqual(DAILY_VISIBLE_LIMIT);
    }
  });

  it("is deterministic for the same seed/date/piece", () => {
    const a = getVisibleExercisesForToday({
      piece: "rook",
      walletOrSessionSeed: seed,
      dateUtc: date,
      progress: masteryMap("rook", 6),
    });
    const b = getVisibleExercisesForToday({
      piece: "rook",
      walletOrSessionSeed: seed,
      dateUtc: date,
      progress: masteryMap("rook", 6),
    });
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
  });

  it("varies the selected set across different dates (pool > 5)", () => {
    // Medium unlocked → 10 candidates for rook, so the chosen 5 can differ.
    const progress = masteryMap("rook", 6);
    const dates = [
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
    ];
    const sets = dates.map((d) =>
      getVisibleExercisesForToday({
        piece: "rook",
        walletOrSessionSeed: seed,
        dateUtc: d,
        progress,
      })
        .map((e) => e.id)
        .sort()
        .join(","),
    );
    expect(new Set(sets).size).toBeGreaterThan(1);
  });

  it("only returns exercises from unlocked tiers", () => {
    // mastery 0 → Easy only.
    const visible = getVisibleExercisesForToday({
      piece: "rook",
      walletOrSessionSeed: seed,
      dateUtc: date,
    });
    expect(visible.length).toBeGreaterThan(0);
    for (const ex of visible) {
      expect(ex.tier).toBe("easy");
    }
  });

  it("never returns Hard for a piece without Hard content, even when the tier is unlocked", () => {
    // Rook mastery 9 unlocks the Hard tier, but rook has no Hard exercises.
    const visible = getVisibleExercisesForToday({
      piece: "rook",
      walletOrSessionSeed: seed,
      dateUtc: date,
      progress: masteryMap("rook", 9),
    });
    expect(visible.some((e) => e.tier === "hard")).toBe(false);
  });

  it("does not break for King, which has Hard content", () => {
    const visible = getVisibleExercisesForToday({
      piece: "king",
      walletOrSessionSeed: seed,
      dateUtc: date,
      progress: masteryMap("king", 9),
    });
    expect(visible.length).toBeLessThanOrEqual(DAILY_VISIBLE_LIMIT);
    // Every returned exercise is in an unlocked tier.
    for (const ex of visible) {
      expect(["easy", "medium", "hard"]).toContain(ex.tier);
    }
  });

  it("works with a guest session seed and no progress", () => {
    const visible = getVisibleExercisesForToday({
      piece: "bishop",
      walletOrSessionSeed: "session_8f3a-guest-uuid",
      dateUtc: date,
    });
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length).toBeLessThanOrEqual(DAILY_VISIBLE_LIMIT);
    for (const ex of visible) {
      expect(ex.tier).toBe("easy");
    }
  });

  it("does not mutate the catalog", () => {
    const before = EXERCISES.queen.map((e) => e.id);
    getVisibleExercisesForToday({
      piece: "queen",
      walletOrSessionSeed: seed,
      dateUtc: date,
      progress: masteryMap("queen", 5),
    });
    expect(EXERCISES.queen.map((e) => e.id)).toEqual(before);
    expect(EXERCISES.queen).toHaveLength(10);
  });
});
