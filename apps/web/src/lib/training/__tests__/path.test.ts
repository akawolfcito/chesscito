import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  badgeRequiredCount,
  EXERCISES,
  LABYRINTHS,
  labyrinthStars,
} from "@/lib/game/exercises";
import type { PieceId, PieceProgress } from "@/lib/game/types";
import {
  buildTrainingPath,
  getNextChallenge,
  getPieceMastery,
  LABYRINTH_UNLOCK_THRESHOLD,
  resolvePostLabContinue,
  type TrainingNode,
  type TrainingPathInput,
} from "@/lib/training/path";

/** Convert a positional star array (legacy fixture shape) into the id-map
 *  PieceProgress reads, keyed by catalog order. Sparse: zero entries are
 *  dropped (absent id = not played). Preserves both the total and the
 *  per-slot completion the fixtures express. */
function makeProgress(piece: PieceId, stars: number[]): PieceProgress {
  const map: Record<string, number> = {};
  EXERCISES[piece].forEach((ex, i) => {
    if ((stars[i] ?? 0) > 0) map[ex.id] = stars[i];
  });
  return { piece, currentId: null, stars: map };
}

function makeInput(
  piece: PieceId,
  overrides: Partial<TrainingPathInput> = {},
): TrainingPathInput {
  return {
    piece,
    progress: makeProgress(piece, EXERCISES[piece].map(() => 0)),
    labyrinthBests: {},
    badgeClaimed: false,
    ...overrides,
  };
}

function byKind(path: TrainingNode[], kind: TrainingNode["kind"]) {
  return path.filter((node) => node.kind === kind);
}

describe("buildTrainingPath — fresh piece (0★)", () => {
  it("lists every exercise as available and gates everything else", () => {
    const path = buildTrainingPath(makeInput("knight"));

    const exercises = byKind(path, "exercise");
    expect(exercises).toHaveLength(EXERCISES.knight.length);
    for (const node of exercises) {
      expect(node.status).toBe("available");
      expect(node.stars).toBe(0);
    }

    for (const node of byKind(path, "labyrinth")) {
      expect(node.status).toBe("locked");
    }
    expect(byKind(path, "badge")).toHaveLength(1);
    expect(byKind(path, "badge")[0].status).toBe("locked");
    expect(byKind(path, "mastery")).toHaveLength(1);
    expect(byKind(path, "mastery")[0].status).toBe("locked");
  });

  it("orders nodes exercises → labyrinths → badge → mastery", () => {
    const path = buildTrainingPath(makeInput("knight"));
    const kinds = path.map((node) => node.kind);
    const expected = [
      ...EXERCISES.knight.map(() => "exercise"),
      ...LABYRINTHS.knight.map(() => "labyrinth"),
      "badge",
      "mastery",
    ];
    expect(kinds).toEqual(expected);
    expect(LABYRINTH_UNLOCK_THRESHOLD).toBe(6);
  });
});

/** Build a stars array for a piece summing exactly `total` (2s then remainder).
 *  Capped at 2/exercise (not 3) so a 6★ total naturally spans 3+ exercises —
 *  matching LABYRINTH_MIN_EXERCISES instead of colliding it on exercise 2. */
function starsTotaling(piece: PieceId, total: number): number[] {
  return EXERCISES[piece].map(() => {
    const take = Math.min(2, total);
    total -= take;
    return take;
  });
}

/** Star array completing exactly the first `count` exercises (1★ each), the
 *  rest at 0. The badge gate counts completions, not stars. */
function completing(piece: PieceId, count: number): number[] {
  return EXERCISES[piece].map((_, i) => (i < count ? 1 : 0));
}

describe("buildTrainingPath — labyrinth unlocks", () => {
  it("opens the first labyrinth at exactly 6★ and keeps the chain locked", () => {
    const at5 = buildTrainingPath(
      makeInput("knight", { progress: makeProgress("knight", starsTotaling("knight", 5)) }),
    );
    expect(byKind(at5, "labyrinth")[0].status).toBe("locked");

    const at6 = buildTrainingPath(
      makeInput("knight", { progress: makeProgress("knight", starsTotaling("knight", 6)) }),
    );
    const labs = byKind(at6, "labyrinth");
    expect(labs[0].status).toBe("available");
    expect(labs[0].unlock).toEqual({ type: "stars", min: LABYRINTH_UNLOCK_THRESHOLD });
    for (const node of labs.slice(1)) {
      expect(node.status).toBe("locked");
      expect(node.unlock.type).toBe("node");
    }
  });

  it("chains each labyrinth on completion of the previous one (knight authored chain)", () => {
    const progress = makeProgress("knight", starsTotaling("knight", 6));
    // Authored catalog order (order 0..4):
    // lab-1 → lab-2 → lab-3 → lab-4 → lab-5
    const afterFirst = buildTrainingPath(
      makeInput("knight", { progress, labyrinthBests: { "knight-lab-1": 3 } }),
    );
    const ids = byKind(afterFirst, "labyrinth").map((n) => [n.id, n.status]);
    expect(ids).toEqual([
      ["knight-lab-1", "complete"],
      ["knight-lab-2", "available"],
      ["knight-lab-3", "locked"],
      ["knight-lab-4", "locked"],
      ["knight-lab-5", "locked"],
    ]);

    const afterSecond = buildTrainingPath(
      makeInput("knight", {
        progress,
        labyrinthBests: { "knight-lab-1": 3, "knight-lab-2": 4 },
      }),
    );
    const labs = byKind(afterSecond, "labyrinth");
    expect(labs[2]).toMatchObject({ id: "knight-lab-3", status: "available" });
    expect(labs[3]).toMatchObject({ id: "knight-lab-4", status: "locked" });
  });

  it("derives labyrinth stars from the recorded best via labyrinthStars", () => {
    const path = buildTrainingPath(
      makeInput("knight", {
        progress: makeProgress("knight", starsTotaling("knight", 6)),
        labyrinthBests: { "knight-lab-1": 5 }, // optimal 3 → 2★
      }),
    );
    const lab = byKind(path, "labyrinth")[0];
    expect(lab.status).toBe("complete");
    expect(lab.stars).toBe(labyrinthStars(5, 3));
    expect(lab.stars).toBe(2);
  });
});

describe("the first labyrinth needs an exercise floor, not just stars", () => {
  it("stays locked at 6 stars across only 2 exercises", () => {
    const path = buildTrainingPath({
      piece: "rook",
      progress: { piece: "rook", currentId: null, stars: { "rook-1": 3, "rook-2": 3 } },
      labyrinthBests: {},
      badgeClaimed: false,
    });
    const firstLab = path.find((node) => node.kind === "labyrinth");
    expect(firstLab?.status).toBe("locked");
  });

  it("unlocks at 6 stars across 3 exercises", () => {
    const path = buildTrainingPath({
      piece: "rook",
      progress: {
        piece: "rook",
        currentId: null,
        stars: { "rook-1": 3, "rook-2": 2, "rook-3": 1 },
      },
      labyrinthBests: {},
      badgeClaimed: false,
    });
    const firstLab = path.find((node) => node.kind === "labyrinth");
    expect(firstLab?.status).toBe("available");
  });
});

describe("buildTrainingPath — badge and mastery milestones", () => {
  it("makes the badge available once 80% of exercises are completed, labyrinths aside", () => {
    const required = badgeRequiredCount(EXERCISES.knight.length);
    const path = buildTrainingPath(
      makeInput("knight", { progress: makeProgress("knight", completing("knight", required)) }),
    );
    const badge = byKind(path, "badge")[0];
    expect(badge.status).toBe("available");
    expect(badge.unlock).toEqual({ type: "completion", min: required });
    const labs = byKind(path, "labyrinth");
    expect(labs[0].status).toBe("available");
    expect(labs.slice(1).every((n) => n.status === "locked")).toBe(true);
    expect(byKind(path, "mastery")[0].status).toBe("locked");
  });

  it("badge node is complete when claimed on-chain", () => {
    const path = buildTrainingPath(makeInput("knight", { badgeClaimed: true }));
    expect(byKind(path, "badge")[0].status).toBe("complete");
  });
});

function allLabBests(piece: PieceId): Record<string, number> {
  return Object.fromEntries(
    LABYRINTHS[piece].map((lab) => [lab.id, lab.optimalMoves]),
  );
}

describe("getPieceMastery", () => {
  it("returns none below the badge threshold", () => {
    expect(getPieceMastery(buildTrainingPath(makeInput("knight")))).toBe("none");
  });

  it("returns badge when threshold met but labyrinths incomplete", () => {
    const path = buildTrainingPath(
      makeInput("knight", {
        progress: makeProgress(
          "knight",
          completing("knight", badgeRequiredCount(EXERCISES.knight.length)),
        ),
      }),
    );
    expect(getPieceMastery(path)).toBe("badge");
  });

  it("returns mastered only when badge claimed AND every labyrinth solved", () => {
    const claimedNoLabs = buildTrainingPath(
      makeInput("knight", { badgeClaimed: true }),
    );
    expect(getPieceMastery(claimedNoLabs)).toBe("badge");

    const mastered = buildTrainingPath(
      makeInput("knight", {
        badgeClaimed: true,
        labyrinthBests: allLabBests("knight"),
      }),
    );
    expect(byKind(mastered, "mastery")[0].status).toBe("complete");
    expect(getPieceMastery(mastered)).toBe("mastered");
  });

  it("never reports a guest as mastered (badgeClaimed=false gates the crown)", () => {
    const guest = buildTrainingPath(
      makeInput("knight", {
        progress: makeProgress("knight", EXERCISES.knight.map(() => 3)),
        labyrinthBests: allLabBests("knight"),
        badgeClaimed: false,
      }),
    );
    expect(byKind(guest, "mastery")[0].status).toBe("locked");
    expect(getPieceMastery(guest)).toBe("badge");
  });

  it("single-labyrinth piece (king): mastery = badge + that one lab", () => {
    expect(LABYRINTHS.king).toHaveLength(1);
    const withoutLab = buildTrainingPath(makeInput("king", { badgeClaimed: true }));
    expect(getPieceMastery(withoutLab)).toBe("badge");
    const withLab = buildTrainingPath(
      makeInput("king", { badgeClaimed: true, labyrinthBests: allLabBests("king") }),
    );
    expect(getPieceMastery(withLab)).toBe("mastered");
  });
});

describe("buildTrainingPath — catalog coverage and ordering", () => {
  it("always lists the FULL exercise catalog (independent of rotation subsets)", () => {
    for (const piece of Object.keys(EXERCISES) as PieceId[]) {
      const path = buildTrainingPath(makeInput(piece));
      expect(byKind(path, "exercise").map((n) => n.id)).toEqual(
        EXERCISES[piece].map((exercise) => exercise.id),
      );
      expect(byKind(path, "labyrinth").map((n) => n.id).sort()).toEqual(
        LABYRINTHS[piece].map((lab) => lab.id).sort(),
      );
    }
  });

  it("orders labyrinths by authored catalog order (the in-game sequence)", () => {
    // The path now consumes LABYRINTHS[piece] as-is; the catalog is already
    // sorted by (order, id) at import time, so the author's `order` controls
    // the sequence (not difficulty / optimalMoves).
    const knight = buildTrainingPath(makeInput("knight"));
    expect(byKind(knight, "labyrinth").map((n) => n.id)).toEqual(
      LABYRINTHS.knight.map((lab) => lab.id),
    );
    expect(byKind(knight, "labyrinth").map((n) => n.id)).toEqual([
      "knight-lab-1", // order 0
      "knight-lab-2", // order 1
      "knight-lab-3", // order 2
      "knight-lab-4", // order 3
      "knight-lab-5", // order 4
    ]);

    const rook = buildTrainingPath(makeInput("rook"));
    expect(byKind(rook, "labyrinth").map((n) => n.id)).toEqual(
      LABYRINTHS.rook.map((lab) => lab.id),
    );
    // Rook Rails ladder, authored order 0..3 (A10/A11). Break Through (level 4)
    // is Phase B and absent from Delivery 1.
    expect(byKind(rook, "labyrinth").map((n) => n.id)).toEqual([
      "rook-rail-two-turns", // order 0
      "rook-rail-dead-end", // order 1
      "rook-rail-two-roads", // order 2
      "rook-rail-rook-run", // order 3
    ]);
  });
});

describe("buildTrainingPath — injected overlay catalog (db-content)", () => {
  // Regression lock for the overlay-full read path: the screen passes the
  // merged catalog through `input.catalog`, so labyrinth nodes (and their
  // unlock gate) must derive from `catalog.labyrinths`, never the baseline.
  it("derives labyrinth nodes from catalog.labyrinths, not the baseline", () => {
    const overlayLab = { ...LABYRINTHS.rook[0], id: "rook-overlay-lab" };
    const allStars = Object.fromEntries(EXERCISES.rook.map((e) => [e.id, 3]));
    const path = buildTrainingPath({
      piece: "rook",
      progress: { piece: "rook", currentId: null, stars: allStars },
      labyrinthBests: {},
      badgeClaimed: false,
      catalog: {
        exercises: EXERCISES,
        labyrinths: { ...LABYRINTHS, rook: [overlayLab] },
      },
    });
    const labs = path.filter((n) => n.kind === "labyrinth");
    expect(labs).toHaveLength(1);
    expect(labs[0].id).toBe("rook-overlay-lab");
    // 24★ (all rook exercises at 3★) ≥ 6★ → list AND gate agree: "available".
    expect(labs[0].status).toBe("available");
  });
});

describe("getNextChallenge — next-node recommendation (Slice 3D)", () => {
  function pathFor(piece: PieceId, input: Partial<TrainingPathInput> = {}) {
    return buildTrainingPath({
      piece,
      progress: makeProgress(piece, EXERCISES[piece].map(() => 0)),
      labyrinthBests: {},
      badgeClaimed: false,
      ...input,
    });
  }

  it("returns null while every labyrinth is locked (keep exercise flow)", () => {
    expect(getNextChallenge(pathFor("knight"))).toBeNull();
  });

  it("recommends the first available labyrinth once 6★ unlocks it", () => {
    const next = getNextChallenge(
      pathFor("knight", {
        progress: makeProgress("knight", starsTotaling("knight", 6)),
      }),
    );
    expect(next?.id).toBe("knight-lab-1");
    expect(next?.kind).toBe("labyrinth");
  });

  it("skips completed labyrinths and recommends the next available in the chain", () => {
    const next = getNextChallenge(
      pathFor("knight", {
        progress: makeProgress("knight", starsTotaling("knight", 6)),
        labyrinthBests: { "knight-lab-1": 3 },
      }),
    );
    expect(next?.id).toBe("knight-lab-2");
  });

  it("returns null when every labyrinth is complete (nothing pending)", () => {
    const next = getNextChallenge(
      pathFor("knight", {
        progress: makeProgress("knight", starsTotaling("knight", 6)),
        labyrinthBests: Object.fromEntries(
          LABYRINTHS.knight.map((lab) => [lab.id, lab.optimalMoves]),
        ),
      }),
    );
    expect(next).toBeNull();
  });
});

describe("path module purity (no IO)", () => {
  it("source contains no fetch/localStorage/Date.now/Math.random/window/document", () => {
    const source = readFileSync(
      join(__dirname, "..", "path.ts"),
      "utf8",
    );
    for (const forbidden of [
      "fetch(",
      "localStorage",
      "Date.now",
      "Math.random",
      "window.",
      "document.",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});

describe("resolvePostLabContinue — post-lab routing", () => {
  const progress6 = makeProgress("knight", starsTotaling("knight", 6));
  const pathWithNextLab = buildTrainingPath(
    makeInput("knight", {
      progress: progress6,
      labyrinthBests: { "knight-lab-1": 3 }, // lab-1 complete, lab-2 available
    }),
  );
  const pathNoMoreLabs = buildTrainingPath(
    makeInput("knight", {
      progress: progress6,
      labyrinthBests: allLabBests("knight"), // all labs complete
    }),
  );

  it("returns next-exercise when there is a visible 0★ exercise", () => {
    expect(resolvePostLabContinue(pathWithNextLab, true)).toEqual({
      action: "next-exercise",
    });
  });

  it("returns next-labyrinth when no 0★ exercise but next lab is available", () => {
    const result = resolvePostLabContinue(pathWithNextLab, false);
    expect(result.action).toBe("next-labyrinth");
    // lab-1 is complete; lab-2 becomes available via chain unlock
    expect((result as { action: "next-labyrinth"; labyrinthId: string }).labyrinthId).toBe(
      "knight-lab-2",
    );
  });

  it("returns piece-complete when no 0★ exercise and no available lab remains", () => {
    expect(resolvePostLabContinue(pathNoMoreLabs, false)).toEqual({
      action: "piece-complete",
    });
  });

  it("replay of already-completed lab with no next available lab → piece-complete", () => {
    // Replaying lab-5 (last): all labs complete, no new unlock triggered
    expect(resolvePostLabContinue(pathNoMoreLabs, false)).toEqual({
      action: "piece-complete",
    });
  });

  it("empty path falls back to piece-complete", () => {
    expect(resolvePostLabContinue([], false)).toEqual({ action: "piece-complete" });
  });
});
