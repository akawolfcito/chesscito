/**
 * Catalog injection seam — db-backed-content Phase 2b-1.
 *
 * Proves the pure read-path helpers accept an injected catalog (default =
 * baseline). With NO catalog arg every function behaves exactly as before
 * (covered by the existing per-file suites + tsc); these tests assert the
 * injected catalog is honored, so Phase 2c can thread the merged catalog.
 */
import { describe, expect, it } from "vitest";
import type { Exercise, PieceId } from "@/lib/game/types";
import {
  getExercisePool,
  getPieceMasteryStars,
  getVisibleExercisesForToday,
} from "@/lib/game/rotation";
import { buildTrainingPath } from "@/lib/training/path";
import { migrateStarsArrayToIdMap } from "@/lib/game/progress-adapter";
import { deriveRewardTiles } from "@/lib/hub/derive-reward-tiles";

function ex(id: string): Exercise {
  return { id, startPos: { file: 0, rank: 0 }, targetPos: { file: 7, rank: 0 }, optimalMoves: 1, tier: "easy" };
}

function emptyCatalog(): Record<PieceId, Exercise[]> {
  return { rook: [], bishop: [], knight: [], pawn: [], queen: [], king: [] };
}

const INJECTED: Record<PieceId, Exercise[]> = {
  ...emptyCatalog(),
  rook: [ex("inj-1"), ex("inj-2"), ex("inj-3")],
};

describe("rotation — injected catalog", () => {
  it("getExercisePool reads the injected pool", () => {
    expect(getExercisePool("rook", INJECTED).map((e) => e.id)).toEqual(["inj-1", "inj-2", "inj-3"]);
  });

  it("getPieceMasteryStars sums over the injected pool", () => {
    expect(getPieceMasteryStars("rook", { "inj-1": 3, "inj-2": 2 }, INJECTED)).toBe(5);
  });

  it("getVisibleExercisesForToday selects from the injected pool", () => {
    const ids = getVisibleExercisesForToday({
      piece: "rook",
      walletOrSessionSeed: "seed",
      dateUtc: "2026-06-17",
      catalog: INJECTED,
    }).map((e) => e.id);
    expect(ids.sort()).toEqual(["inj-1", "inj-2", "inj-3"]);
  });
});

describe("training path — injected catalog", () => {
  it("buildTrainingPath builds nodes from the injected exercises", () => {
    const path = buildTrainingPath({
      piece: "rook",
      progress: { piece: "rook", currentId: null, stars: {} },
      labyrinthBests: {},
      badgeClaimed: false,
      catalog: { exercises: INJECTED, labyrinths: emptyCatalog() },
    });
    const exerciseIds = path.filter((n) => n.kind === "exercise").map((n) => n.id);
    expect(exerciseIds).toEqual(["inj-1", "inj-2", "inj-3"]);
  });
});

describe("progress-adapter — injected catalog", () => {
  it("migrateStarsArrayToIdMap maps by the injected pool order", () => {
    expect(migrateStarsArrayToIdMap("rook", [3, 2, 1], INJECTED)).toEqual({
      "inj-1": 3,
      "inj-2": 2,
      "inj-3": 1,
    });
  });
});

describe("derive-reward-tiles — injected catalog", () => {
  it("gates on the injected pool (empty pool → locked)", () => {
    const tiles = deriveRewardTiles({
      badgesClaimed: {},
      starsPerPiece: { rook: 99 },
      catalog: { ...INJECTED, rook: [] }, // rook now empty → cannot be claimable
    });
    expect(tiles.find((t) => t.id === "rook")?.state).toBe("locked");
  });
});
