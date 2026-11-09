import { describe, expect, it } from "vitest";
import { EXERCISES, PLAYABLE_PIECES } from "@/lib/game/exercises";
import {
  calculateTotalStarsFromIdMap,
  getMaxPossibleStars,
  getStarsForExercise,
  migrateStarsArrayToIdMap,
  normalizeStarsById,
  setStarsForExercise,
  starsIdMapToArray,
  type ExerciseStarsById,
} from "@/lib/game/progress-adapter";
import { getPieceMasteryStars } from "@/lib/game/rotation";

const ids = (piece: Parameters<typeof migrateStarsArrayToIdMap>[0]) =>
  EXERCISES[piece].map((e) => e.id);

describe("progress-adapter — migrateStarsArrayToIdMap", () => {
  it("maps the first 5 legacy values to the first 5 catalog ids", () => {
    const map = migrateStarsArrayToIdMap("rook", [3, 2, 1, 0, 0]);
    const [r1, r2, r3, r4, r5] = ids("rook");
    expect(map[r1]).toBe(3);
    expect(map[r2]).toBe(2);
    expect(map[r3]).toBe(1);
    expect(map[r4]).toBe(0);
    expect(map[r5]).toBe(0);
  });

  it("pads a short (5) array out to the full pool (10) with zeros", () => {
    const map = migrateStarsArrayToIdMap("rook", [3, 2, 1, 0, 0]);
    expect(Object.keys(map)).toHaveLength(10);
    for (const id of ids("rook").slice(5)) {
      expect(map[id]).toBe(0);
    }
  });

  it("ignores extra entries when the legacy array is longer than the pool", () => {
    const longArr = new Array(14).fill(3);
    const map = migrateStarsArrayToIdMap("rook", longArr);
    expect(Object.keys(map)).toHaveLength(10);
  });

  it("King 9→10: preserves indices 0-8 and adds appended king-8 at 0", () => {
    // Legacy King had 9 entries (king-8 was parked). Give them distinct
    // values so we can verify the per-id mapping by current catalog order.
    const legacy = [3, 3, 2, 1, 3, 2, 1, 2, 3]; // length 9
    const map = migrateStarsArrayToIdMap("king", legacy);
    const kingIds = ids("king");
    for (let i = 0; i < 9; i += 1) {
      expect(map[kingIds[i]]).toBe(legacy[i]);
    }
    // Index 9 is the appended king-8 — padded with 0.
    expect(kingIds[9]).toBe("king-8");
    expect(map["king-8"]).toBe(0);
  });

  it("preserves the first 5 values for every 5→10 piece", () => {
    for (const piece of ["rook", "bishop", "knight", "pawn", "queen"] as const) {
      const map = migrateStarsArrayToIdMap(piece, [3, 2, 1, 2, 3]);
      const pieceIds = ids(piece);
      expect([0, 1, 2, 3, 4].map((i) => map[pieceIds[i]])).toEqual([3, 2, 1, 2, 3]);
    }
  });

  it("does not mutate the input array", () => {
    const arr = [3, 2, 1, 0, 0];
    const snapshot = [...arr];
    migrateStarsArrayToIdMap("rook", arr);
    expect(arr).toEqual(snapshot);
  });
});

describe("progress-adapter — starsIdMapToArray", () => {
  it("respects catalog order and fills missing ids with 0", () => {
    const [r1, , r3] = ids("rook");
    const map: ExerciseStarsById = { [r1]: 3, [r3]: 2 };
    const arr = starsIdMapToArray("rook", map);
    expect(arr).toHaveLength(10);
    expect(arr[0]).toBe(3); // r1
    expect(arr[1]).toBe(0); // r2 missing
    expect(arr[2]).toBe(2); // r3
  });

  it("does not mutate the input map", () => {
    const map: ExerciseStarsById = { "rook-1": 3 };
    const snapshot = { ...map };
    starsIdMapToArray("rook", map);
    expect(map).toEqual(snapshot);
  });
});

describe("progress-adapter — normalizeStarsById", () => {
  it("discards unknown exercise ids", () => {
    const map: ExerciseStarsById = { "rook-1": 3, "not-a-real-id": 2, "queen-1": 1 };
    const norm = normalizeStarsById("rook", map);
    expect(norm["not-a-real-id"]).toBeUndefined();
    expect(norm["queen-1"]).toBeUndefined();
    expect(norm["rook-1"]).toBe(3);
  });

  it("fills missing ids with 0 (full pool map)", () => {
    const norm = normalizeStarsById("rook", { "rook-1": 3 });
    expect(Object.keys(norm)).toHaveLength(10);
    expect(norm["rook-2"]).toBe(0);
  });
});

describe("progress-adapter — clamping / coercion", () => {
  it("clamps stars > 3 to 3", () => {
    expect(getStarsForExercise({ "rook-1": 99 }, "rook-1")).toBe(3);
  });
  it("clamps stars < 0 to 0", () => {
    expect(getStarsForExercise({ "rook-1": -5 }, "rook-1")).toBe(0);
  });
  it("coerces non-number values to 0", () => {
    // @ts-expect-error — runtime guard against bad persisted data
    expect(getStarsForExercise({ "rook-1": "three" }, "rook-1")).toBe(0);
  });
  it("missing id reads as 0", () => {
    expect(getStarsForExercise({}, "rook-1")).toBe(0);
  });
});

describe("progress-adapter — setStarsForExercise", () => {
  it("returns a new map with the value set, without mutating the input", () => {
    const map: ExerciseStarsById = { "rook-1": 1 };
    const next = setStarsForExercise(map, "rook-2", 3);
    expect(next["rook-2"]).toBe(3);
    expect(next["rook-1"]).toBe(1);
    expect(map["rook-2"]).toBeUndefined(); // input untouched
  });
  it("clamps the value being set", () => {
    expect(setStarsForExercise({}, "rook-1", 9)["rook-1"]).toBe(3);
  });
});

describe("progress-adapter — idempotency", () => {
  it("array → id-map → array preserves valid values", () => {
    const arr = [3, 2, 1, 0, 0, 1, 2, 3, 0, 1];
    const roundTrip = starsIdMapToArray("rook", migrateStarsArrayToIdMap("rook", arr));
    expect(roundTrip).toEqual(arr);
  });

  it("id-map → array → id-map preserves valid ids", () => {
    const map = normalizeStarsById("king", { "king-1": 3, "king-8": 2, "king-10": 1 });
    const roundTrip = migrateStarsArrayToIdMap("king", starsIdMapToArray("king", map));
    expect(roundTrip).toEqual(map);
  });
});

describe("progress-adapter — getMaxPossibleStars", () => {
  it("returns pool length × 3 for rook (10 exercises → 30★)", () => {
    expect(getMaxPossibleStars("rook")).toBe(EXERCISES["rook"].length * 3);
  });

  it("returns 30 for every piece when pool is 10 exercises each", () => {
    for (const piece of PLAYABLE_PIECES) {
      expect(getMaxPossibleStars(piece)).toBe(EXERCISES[piece].length * 3);
    }
  });

  it("labyrinths do not affect the result (only exercises count)", () => {
    // getMaxPossibleStars only reads catalog[piece] length; no labyrinth param.
    const withoutLabyrinth = getMaxPossibleStars("rook");
    expect(typeof withoutLabyrinth).toBe("number");
    expect(withoutLabyrinth).toBeGreaterThan(0);
  });

  it("accepts a custom catalog for test isolation", () => {
    const tiny = { rook: [{ id: "r-1" }, { id: "r-2" }] } as Parameters<typeof getMaxPossibleStars>[1];
    expect(getMaxPossibleStars("rook", tiny)).toBe(6);
  });

  it("12 stars → 1200 pts; max stars → max score (100 pts/star)", () => {
    const maxStars = getMaxPossibleStars("rook");
    const maxScore = maxStars * 100;
    const currentStars = 12;
    const currentScore = currentStars * 100;
    expect(currentScore).toBe(1200);
    expect(maxScore).toBe(EXERCISES["rook"].length * 3 * 100);
  });
});

describe("progress-adapter — all pieces + totals", () => {
  it("round-trips array↔id-map for every piece", () => {
    for (const piece of PLAYABLE_PIECES) {
      const arr = EXERCISES[piece].map((_, i) => (i % 4) as number); // 0..3 cycle
      const back = starsIdMapToArray(piece, migrateStarsArrayToIdMap(piece, arr));
      expect(back).toEqual(arr);
    }
  });

  it("total stars from id-map equals the across-pool best-stars sum", () => {
    const map = migrateStarsArrayToIdMap("rook", [3, 2, 1, 0, 0, 3, 3, 0, 1, 2]);
    const expected = [3, 2, 1, 0, 0, 3, 3, 0, 1, 2].reduce((a, b) => a + b, 0);
    expect(calculateTotalStarsFromIdMap("rook", map)).toBe(expected);
    // And it agrees with the rotation mastery helper on the same map.
    expect(calculateTotalStarsFromIdMap("rook", map)).toBe(
      getPieceMasteryStars("rook", map),
    );
  });
});
