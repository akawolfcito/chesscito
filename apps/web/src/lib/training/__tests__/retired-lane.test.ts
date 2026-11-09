import { describe, expect, it } from "vitest";

import {
  DIAGONAL_RUN,
  EXERCISES,
  KNIGHT_TOUR,
  LABYRINTHS,
  PLAYABLE_PIECES,
  PROMOTION_RUN,
  QUEENS,
  SAFE_PATH,
} from "@/lib/game/exercises";
import type { PieceId, PieceProgress } from "@/lib/game/types";
import {
  RETIRED_LANE_IDS,
  retiredLaneComplete,
} from "@/lib/training/retired-lane";
import { projectSpecialTrainingLane } from "@/lib/training/special-training-lane";
import {
  buildTrainingPath,
  type TrainingNode,
  type TrainingPathInput,
} from "@/lib/training/path";

/** The lane as it actually ships. Injected explicitly because
 *  buildTrainingPath's DEFAULT catalog is still the raw labyrinths — the
 *  very mismatch these tests exist to pin. */
const SHIPPING_CATALOG = {
  exercises: EXERCISES,
  labyrinths: projectSpecialTrainingLane(LABYRINTHS, {
    diagonalRun: DIAGONAL_RUN,
    knightTour: KNIGHT_TOUR,
    queens: QUEENS,
    safePath: SAFE_PATH,
    promotionRun: PROMOTION_RUN,
  }),
};

/** The signature-game lane each piece runs today — what a player who arrived
 *  AFTER the replacement completes. Transcribed like RETIRED_LANE_IDS: the
 *  point of these tests is the id scheme, so deriving either side from the
 *  catalog would let both drift together and prove nothing. */
const CANONICAL_LANE_IDS: Record<PieceId, readonly string[]> = {
  rook: [
    "rook-rail-two-turns",
    "rook-rail-dead-end",
    "rook-rail-two-roads",
    "rook-rail-rook-run",
  ],
  bishop: ["bishop-run-1", "bishop-run-2", "bishop-run-3"],
  knight: ["knight-tour-1", "knight-tour-2", "knight-tour-3"],
  pawn: ["pawn-promotion-1", "pawn-promotion-2", "pawn-promotion-3"],
  queen: ["queens-1", "queens-2", "queens-3"],
  king: ["king-safe-1", "king-safe-2", "king-safe-3"],
};

function bestsFor(ids: readonly string[]): Record<string, number> {
  return Object.fromEntries(ids.map((id) => [id, 4]));
}

/** Every exercise at 3★ — clears the badge gate so the mastery node is the
 *  only thing left being decided. */
function fullProgress(piece: PieceId): PieceProgress {
  const stars: Record<string, number> = {};
  for (const exercise of EXERCISES[piece]) stars[exercise.id] = 3;
  return { piece, currentId: null, stars };
}

function masteryOf(
  piece: PieceId,
  overrides: Partial<TrainingPathInput> = {},
): TrainingNode {
  const path = buildTrainingPath({
    piece,
    progress: fullProgress(piece),
    labyrinthBests: {},
    badgeClaimed: true,
    catalog: SHIPPING_CATALOG,
    ...overrides,
  });
  const mastery = path.find((node) => node.kind === "mastery");
  if (!mastery) throw new Error(`no mastery node for ${piece}`);
  return mastery;
}

describe("RETIRED_LANE_IDS — frozen history, pinned per piece", () => {
  it("records exactly the lane each piece carried before its signature game", () => {
    expect(RETIRED_LANE_IDS).toEqual({
      rook: [],
      bishop: ["bishop-lab-3", "bishop-lab-4"],
      knight: [
        "knight-lab-1",
        "knight-lab-2",
        "knight-lab-3",
        "knight-lab-4",
        "knight-lab-5",
      ],
      pawn: ["pawn-lab-1", "pawn-lab-3", "pawn-lab-4", "pawn-lab-5"],
      queen: ["queen-lab-1", "queen-lab-2", "queen-lab-3"],
      king: ["king-lab-1"],
    });
  });

  it("covers every playable piece", () => {
    for (const piece of PLAYABLE_PIECES) {
      expect(RETIRED_LANE_IDS[piece]).toBeDefined();
    }
  });

  it("never reuses a canonical id as a retired one", () => {
    for (const piece of PLAYABLE_PIECES) {
      for (const id of RETIRED_LANE_IDS[piece]) {
        expect(CANONICAL_LANE_IDS[piece]).not.toContain(id);
      }
    }
  });
});

describe("retiredLaneComplete — all or nothing", () => {
  it("is true when every retired id has a best", () => {
    for (const piece of PLAYABLE_PIECES) {
      const retired = RETIRED_LANE_IDS[piece];
      if (retired.length === 0) continue;
      expect(retiredLaneComplete(piece, bestsFor(retired))).toBe(true);
    }
  });

  it("is false on a partial retired lane, one id short", () => {
    for (const piece of PLAYABLE_PIECES) {
      const retired = RETIRED_LANE_IDS[piece];
      if (retired.length === 0) continue;
      expect(retiredLaneComplete(piece, bestsFor(retired.slice(1)))).toBe(false);
    }
  });

  it("is false when a retired id is present but null (played, never solved)", () => {
    const bests: Record<string, number | null> = bestsFor(
      RETIRED_LANE_IDS.queen,
    );
    bests["queen-lab-2"] = null;
    expect(retiredLaneComplete("queen", bests)).toBe(false);
  });

  it("is false for a piece with no retired lane, never vacuously true", () => {
    expect(retiredLaneComplete("rook", {})).toBe(false);
    expect(retiredLaneComplete("rook", bestsFor(CANONICAL_LANE_IDS.rook))).toBe(
      false,
    );
  });

  it("is false on an incomplete mix of new and old ids", () => {
    const bests = {
      ...bestsFor(["queen-lab-1"]),
      ...bestsFor(["queens-2", "queens-3"]),
    };
    expect(retiredLaneComplete("queen", bests)).toBe(false);
  });
});

describe("mastery node — a crown is earned, never revoked by an id change", () => {
  it("case 1: canonical lane complete → complete", () => {
    for (const piece of PLAYABLE_PIECES) {
      const node = masteryOf(piece, {
        labyrinthBests: bestsFor(CANONICAL_LANE_IDS[piece]),
      });
      expect(node.status, `${piece} canonical`).toBe("complete");
    }
  });

  it("case 2: retired lane complete → complete, with zero new levels played", () => {
    for (const piece of PLAYABLE_PIECES) {
      const retired = RETIRED_LANE_IDS[piece];
      if (retired.length === 0) continue;
      const node = masteryOf(piece, { labyrinthBests: bestsFor(retired) });
      expect(node.status, `${piece} retired`).toBe("complete");
    }
  });

  it("case 3: retired lane partial → available, not complete", () => {
    for (const piece of PLAYABLE_PIECES) {
      const retired = RETIRED_LANE_IDS[piece];
      if (retired.length === 0) continue;
      const node = masteryOf(piece, {
        labyrinthBests: bestsFor(retired.slice(1)),
      });
      expect(node.status, `${piece} partial retired`).toBe("available");
    }
  });

  it("case 4: incomplete mix of new and old ids → available", () => {
    const node = masteryOf("queen", {
      labyrinthBests: {
        ...bestsFor(["queen-lab-1", "queen-lab-2"]),
        ...bestsFor(["queens-3"]),
      },
    });
    expect(node.status).toBe("available");
  });

  it("case 5: badge claimed + retired lane complete stays complete", () => {
    const node = masteryOf("knight", {
      badgeClaimed: true,
      labyrinthBests: bestsFor(RETIRED_LANE_IDS.knight),
    });
    expect(node.status).toBe("complete");
  });

  it("case 6: no evidence at all stays available, never complete", () => {
    for (const piece of PLAYABLE_PIECES) {
      expect(masteryOf(piece, { labyrinthBests: {} }).status).toBe("available");
    }
  });

  it("the retired lane never unlocks the crown while the badge is unclaimed", () => {
    for (const piece of PLAYABLE_PIECES) {
      const retired = RETIRED_LANE_IDS[piece];
      if (retired.length === 0) continue;
      const node = masteryOf(piece, {
        badgeClaimed: false,
        labyrinthBests: bestsFor(retired),
      });
      expect(node.status, `${piece} guest`).toBe("locked");
    }
  });

  it("retired ids stay OUT of the lane: they add no nodes and unlock nothing", () => {
    for (const piece of PLAYABLE_PIECES) {
      const retired = RETIRED_LANE_IDS[piece];
      if (retired.length === 0) continue;
      const path = buildTrainingPath({
        piece,
        progress: fullProgress(piece),
        labyrinthBests: bestsFor(retired),
        badgeClaimed: true,
        catalog: SHIPPING_CATALOG,
      });
      const laneIds = path
        .filter((node) => node.kind === "labyrinth")
        .map((node) => node.id);
      for (const id of retired) {
        expect(laneIds, `${piece} lane`).not.toContain(id);
      }
      // And the levels that ARE in the lane were not credited by proxy.
      for (const node of path.filter((n) => n.kind === "labyrinth")) {
        expect(node.status, `${piece}/${node.id}`).not.toBe("complete");
      }
    }
  });
});
