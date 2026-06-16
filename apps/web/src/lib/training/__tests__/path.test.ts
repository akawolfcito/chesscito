import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BADGE_THRESHOLD,
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
  type TrainingNode,
  type TrainingPathInput,
} from "@/lib/training/path";

function makeProgress(piece: PieceId, stars: number[]): PieceProgress {
  return { piece, exerciseIndex: 0, stars };
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

/** Build a stars array for a piece summing exactly `total` (3s then remainder). */
function starsTotaling(piece: PieceId, total: number): number[] {
  return EXERCISES[piece].map(() => {
    const take = Math.min(3, total);
    total -= take;
    return take;
  });
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

  it("chains each labyrinth on completion of the previous one (knight ordered chain)", () => {
    const progress = makeProgress("knight", starsTotaling("knight", 6));
    // Ordered by optimalMoves asc + catalog tie-break:
    // lab-1(3) → lab-2(4) → lab-4(4) → lab-5(5) → lab-3(6)
    const afterFirst = buildTrainingPath(
      makeInput("knight", { progress, labyrinthBests: { "knight-lab-1": 3 } }),
    );
    const ids = byKind(afterFirst, "labyrinth").map((n) => [n.id, n.status]);
    expect(ids).toEqual([
      ["knight-lab-1", "complete"],
      ["knight-lab-2", "available"],
      ["knight-lab-4", "locked"],
      ["knight-lab-5", "locked"],
      ["knight-lab-3", "locked"],
    ]);

    const afterSecond = buildTrainingPath(
      makeInput("knight", {
        progress,
        labyrinthBests: { "knight-lab-1": 3, "knight-lab-2": 4 },
      }),
    );
    const labs = byKind(afterSecond, "labyrinth");
    expect(labs[2]).toMatchObject({ id: "knight-lab-4", status: "available" });
    expect(labs[3]).toMatchObject({ id: "knight-lab-5", status: "locked" });
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

describe("buildTrainingPath — badge and mastery milestones", () => {
  it("makes the badge available at 10★ even with labyrinths locked/incomplete", () => {
    const path = buildTrainingPath(
      makeInput("knight", { progress: makeProgress("knight", starsTotaling("knight", BADGE_THRESHOLD)) }),
    );
    const badge = byKind(path, "badge")[0];
    expect(badge.status).toBe("available");
    expect(badge.unlock).toEqual({ type: "stars", min: BADGE_THRESHOLD });
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
      makeInput("knight", { progress: makeProgress("knight", starsTotaling("knight", BADGE_THRESHOLD)) }),
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

  it("orders labyrinths by optimalMoves asc with catalog-index tie-break", () => {
    const knight = buildTrainingPath(makeInput("knight"));
    expect(byKind(knight, "labyrinth").map((n) => n.id)).toEqual([
      "knight-lab-1", // 3
      "knight-lab-2", // 4 (catalog index beats knight-lab-4)
      "knight-lab-4", // 4
      "knight-lab-5", // 5
      "knight-lab-3", // 6
    ]);

    const rook = buildTrainingPath(makeInput("rook"));
    // The 3 hand-authored rook labs share optimalMoves=3 → pure catalog order.
    // (No generated labs ship by default; the builder adds real ones later,
    // which the ascending-optimalMoves rule will then interleave.)
    expect(byKind(rook, "labyrinth").map((n) => n.id)).toEqual([
      "rook-lab-1", // 3
      "rook-lab-2", // 3
      "rook-lab-3", // 3
    ]);
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
