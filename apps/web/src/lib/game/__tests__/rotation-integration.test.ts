/**
 * Rotation Engine — integration tests (slice D, 2026-06-08).
 *
 * Validates the full pipeline end to end across rotation.ts +
 * progress-adapter.ts + the EXERCISES catalog, BEFORE wiring any UI:
 *
 *   legacy stars[] → id-map → mastery → unlocked tiers → visible today
 *
 * Pure data flow only — no UI, no hook, no localStorage, no runtime.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { EXERCISES, PLAYABLE_PIECES } from "@/lib/game/exercises";
import {
  calculateTotalStarsFromIdMap,
  migrateStarsArrayToIdMap,
} from "@/lib/game/progress-adapter";
import {
  getCanonicalFive,
  getUnlockedTiers,
  getVisibleExercisesForToday,
  type ExerciseStarsById,
} from "@/lib/game/rotation";
import type { Exercise, PieceId } from "@/lib/game/types";

/** Run the full pipeline a UI caller would run. */
function pipeline(piece: PieceId, legacy: number[], seed: string, dateUtc: string) {
  const idMap = migrateStarsArrayToIdMap(piece, legacy);
  const mastery = calculateTotalStarsFromIdMap(piece, idMap);
  const tiers = getUnlockedTiers(mastery);
  const visible = getVisibleExercisesForToday({
    piece,
    walletOrSessionSeed: seed,
    dateUtc,
    progress: idMap,
  });
  return { idMap, mastery, tiers, visible };
}

const tiersOf = (exs: Exercise[]) => exs.map((e) => e.tier);
const idsOf = (exs: Exercise[]) => exs.map((e) => e.id);
const WALLET = "0xWALLET";
const DATE = "2026-06-08";

describe("rotation integration — 1. legacy empty / 0★", () => {
  it("0★ → mastery 0, Easy only, visible all Easy", () => {
    const { mastery, tiers, visible } = pipeline("rook", [], WALLET, DATE);
    expect(mastery).toBe(0);
    expect(tiers).toEqual(["easy"]);
    expect(visible.length).toBeGreaterThan(0);
    expect(tiersOf(visible).every((t) => t === "easy")).toBe(true);
  });
});

describe("rotation integration — 2. legacy 5★", () => {
  it("5★ → mastery 5, Easy+Medium, visible can include Medium", () => {
    // rook-1=3, rook-2=2 → mastery 5. Zero-star: 3 Easy + 5 Medium = 8
    // candidates; only 3 are Easy, so any 5 picked must include ≥2 Medium.
    const { mastery, tiers, visible } = pipeline(
      "rook",
      [3, 2, 0, 0, 0, 0, 0, 0, 0, 0],
      WALLET,
      DATE,
    );
    expect(mastery).toBe(5);
    expect(tiers).toEqual(["easy", "medium"]);
    expect(visible.some((e) => e.tier === "medium")).toBe(true);
  });
});

describe("rotation integration — 3. legacy 9★", () => {
  it("Rook 9★ unlocks Hard but never returns Hard (no Hard content)", () => {
    const { mastery, tiers, visible } = pipeline(
      "rook",
      [3, 3, 3, 0, 0, 0, 0, 0, 0, 0],
      WALLET,
      DATE,
    );
    expect(mastery).toBe(9);
    expect(tiers).toEqual(["easy", "medium", "hard"]);
    expect(visible.some((e) => e.tier === "hard")).toBe(false);
    expect(visible.length).toBeLessThanOrEqual(5);
  });

  it("King includes Hard when the seed/bias surfaces it", () => {
    // All Easy+Medium at 3★, both Hard (king-6 idx5, king-9 idx7) at 0★.
    // Mastery 24 unlocks Hard; bias floats the two 0★ Hard exercises to
    // the front, so the visible set deterministically contains Hard.
    const legacy = [3, 3, 3, 3, 3, 0, 3, 0, 3, 3];
    const { mastery, tiers, visible } = pipeline("king", legacy, WALLET, DATE);
    expect(mastery).toBe(24);
    expect(tiers).toContain("hard");
    expect(visible.some((e) => e.tier === "hard")).toBe(true);
    expect(visible.length).toBeLessThanOrEqual(5);
  });
});

describe("rotation integration — 4. canonical 5", () => {
  it("first 5 catalog ids per piece, independent of any seed", () => {
    for (const piece of PLAYABLE_PIECES) {
      const canonical = getCanonicalFive(piece);
      expect(idsOf(canonical)).toEqual(
        EXERCISES[piece].slice(0, 5).map((e) => e.id),
      );
      // No seed parameter exists — same result every call.
      expect(idsOf(getCanonicalFive(piece))).toEqual(idsOf(canonical));
    }
  });
});

describe("rotation integration — 5. daily seed", () => {
  // Medium unlocked (mastery 6) → 10 candidates, so seed/date actually
  // changes which 5 surface.
  const legacy = [3, 3, 0, 0, 0, 0, 0, 0, 0, 0];
  const setFor = (seed: string, date: string) =>
    idsOf(pipeline("rook", legacy, seed, date).visible).sort().join(",");

  it("same wallet + date + piece → same set", () => {
    expect(setFor(WALLET, DATE)).toBe(setFor(WALLET, DATE));
  });

  it("different dates can change the set", () => {
    const sets = ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05"].map(
      (d) => setFor(WALLET, d),
    );
    expect(new Set(sets).size).toBeGreaterThan(1);
  });

  it("different wallets can change the set", () => {
    const sets = ["0xAAA", "0xBBB", "0xCCC", "0xDDD", "0xEEE"].map((w) =>
      setFor(w, DATE),
    );
    expect(new Set(sets).size).toBeGreaterThan(1);
  });

  it("a guest session_uuid works as the seed", () => {
    const visible = pipeline("rook", legacy, "session_8f3a-guest-uuid", DATE).visible;
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length).toBeLessThanOrEqual(5);
  });
});

describe("rotation integration — 6. limit", () => {
  it("never returns more than 5", () => {
    for (const piece of PLAYABLE_PIECES) {
      const { visible } = pipeline(
        piece,
        new Array(10).fill(0).map((_, i) => (i < 3 ? 3 : 0)), // unlock Medium+
        WALLET,
        DATE,
      );
      expect(visible.length).toBeLessThanOrEqual(5);
    }
  });

  it("returns the available exercises without breaking when fewer than 5 unlocked", () => {
    // Knight/Pawn have only 4 Easy; at 0★ only those 4 are candidates.
    for (const piece of ["knight", "pawn"] as const) {
      const { visible } = pipeline(piece, [], WALLET, DATE);
      expect(visible).toHaveLength(4);
      expect(tiersOf(visible).every((t) => t === "easy")).toBe(true);
    }
  });
});

describe("rotation integration — 7. bias toward less completed", () => {
  it("does not surface completed exercises while enough 0★ candidates exist", () => {
    // rook-1, rook-2 at 3★ (mastery 6 → Medium unlocked). 8 zero-star
    // candidates remain, so the two completed ones must be excluded.
    const idMap = migrateStarsArrayToIdMap("rook", [3, 3, 0, 0, 0, 0, 0, 0, 0, 0]);
    const snapshot = { ...idMap };
    const visible = getVisibleExercisesForToday({
      piece: "rook",
      walletOrSessionSeed: WALLET,
      dateUtc: DATE,
      progress: idMap,
    });
    expect(idsOf(visible)).not.toContain("rook-1");
    expect(idsOf(visible)).not.toContain("rook-2");
    // progress map untouched.
    expect(idMap).toEqual(snapshot);
  });
});

describe("rotation integration — 8. across-pool mastery", () => {
  it("mastery comes from unique ids and is order-independent", () => {
    const fromArray = calculateTotalStarsFromIdMap(
      "rook",
      migrateStarsArrayToIdMap("rook", [3, 2, 0, 0, 0, 0, 0, 0, 0, 0]),
    );
    // Same logical progress, keys inserted in a different order.
    const reordered: ExerciseStarsById = { "rook-2": 2, "rook-1": 3 };
    expect(calculateTotalStarsFromIdMap("rook", reordered)).toBe(fromArray);
    expect(fromArray).toBe(5);
  });

  it("King mastery counts the appended king-8 by id, not by position", () => {
    // king-8 lives at array index 9; setting it via id must still count.
    const idMap = migrateStarsArrayToIdMap("king", new Array(10).fill(0));
    idMap["king-8"] = 3;
    expect(calculateTotalStarsFromIdMap("king", idMap)).toBe(3);
  });
});

describe("rotation integration — 9. safety", () => {
  afterEach(() => vi.restoreAllMocks());

  it("does not mutate the catalog or the id-map across the pipeline", () => {
    const catalogBefore = idsOf([...EXERCISES.rook]);
    const idMap = migrateStarsArrayToIdMap("rook", [3, 2, 1, 0, 0, 0, 0, 0, 0, 0]);
    const mapBefore = { ...idMap };
    getVisibleExercisesForToday({
      piece: "rook",
      walletOrSessionSeed: WALLET,
      dateUtc: DATE,
      progress: idMap,
    });
    expect(idsOf(EXERCISES.rook)).toEqual(catalogBefore);
    expect(EXERCISES.rook).toHaveLength(10);
    expect(idMap).toEqual(mapBefore);
  });

  it("never calls Math.random, Date.now, or localStorage during selection", () => {
    const rnd = vi.spyOn(Math, "random");
    const now = vi.spyOn(Date, "now");
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    pipeline("queen", [3, 2, 1, 0, 0, 0, 0, 0, 0, 0], WALLET, DATE);

    expect(rnd).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe("rotation integration — parametrized across all 6 pieces", () => {
  it.each(PLAYABLE_PIECES)("%s: 0★ flow yields Easy-only visible, no crash", (piece) => {
    const { mastery, tiers, visible } = pipeline(piece, [], WALLET, DATE);
    expect(mastery).toBe(0);
    expect(tiers).toEqual(["easy"]);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length).toBeLessThanOrEqual(5);
    expect(tiersOf(visible).every((t) => t === "easy")).toBe(true);
  });
});
