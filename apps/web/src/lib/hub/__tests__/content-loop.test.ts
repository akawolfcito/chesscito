// apps/web/src/lib/hub/__tests__/content-loop.test.ts
import { describe, it, expect } from "vitest";
import {
  deriveContentLoopAction,
  hasAvailableExercise,
  hasImprovableExercise,
  hasMoreContent,
  hasReadyLabyrinth,
  isPieceFullyComplete,
  type ContentLoopInput,
} from "@/lib/hub/content-loop";
import type { TrainingNode } from "@/lib/training/path";
import type { DailyProgress } from "@/lib/daily/progress";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TODAY = "2026-06-21";

function dailyDone(overrides?: Partial<DailyProgress>): DailyProgress {
  return {
    streak: 1,
    lastCompletedDate: TODAY,
    totalCompleted: 1,
    ...overrides,
  };
}

function dailyPending(): DailyProgress {
  return { streak: 0, lastCompletedDate: null, totalCompleted: 0 };
}

function exerciseNode(id: string, status: "available" | "complete", stars = 0): TrainingNode {
  return { id, kind: "exercise", piece: "rook", unlock: { type: "always" }, status, stars };
}

function labyrinthNode(id: string, status: "available" | "complete" | "locked"): TrainingNode {
  return {
    id,
    kind: "labyrinth",
    piece: "rook",
    unlock: { type: "stars", min: 6 },
    status,
    stars: status === "complete" ? 1 : 0,
  };
}

function noPending() {
  return { unlocked: false, claimed: false };
}

function pendingClaim() {
  return { unlocked: true, claimed: false };
}

function alreadyClaimed() {
  return { unlocked: true, claimed: true };
}

/** Path where all exercises are available (no stars). */
const PATH_ALL_AVAILABLE: TrainingNode[] = [
  exerciseNode("ex-1", "available"),
  exerciseNode("ex-2", "available"),
  exerciseNode("ex-3", "available"),
];

/** Path with some exercises complete (1★ each) and some still available. */
const PATH_PARTIAL: TrainingNode[] = [
  exerciseNode("ex-1", "complete", 1),
  exerciseNode("ex-2", "available"),
  exerciseNode("ex-3", "available"),
];

/** Path where all exercises are complete but some only have 1★ (improvable). */
const PATH_ALL_DONE_IMPROVABLE: TrainingNode[] = [
  exerciseNode("ex-1", "complete", 3),
  exerciseNode("ex-2", "complete", 1),
  exerciseNode("ex-3", "complete", 2),
];

/** Path where all exercises are complete with 3★ (no improvement possible). */
const PATH_ALL_DONE_MAX: TrainingNode[] = [
  exerciseNode("ex-1", "complete", 3),
  exerciseNode("ex-2", "complete", 3),
  exerciseNode("ex-3", "complete", 3),
];

/** Path with all exercises done + available labyrinth. */
const PATH_LABYRINTH_READY: TrainingNode[] = [
  exerciseNode("ex-1", "complete", 3),
  exerciseNode("ex-2", "complete", 3),
  labyrinthNode("lab-1", "available"),
];

/** Path with all exercises + all labyrinths complete (fully done). */
const PATH_FULLY_COMPLETE: TrainingNode[] = [
  exerciseNode("ex-1", "complete", 3),
  exerciseNode("ex-2", "complete", 3),
  labyrinthNode("lab-1", "complete"),
];

function baseInput(overrides?: Partial<ContentLoopInput>): ContentLoopInput {
  return {
    daily: dailyDone(),
    today: TODAY,
    welcomePackage: noPending(),
    primaryPiece: "rook",
    primaryPath: PATH_ALL_AVAILABLE,
    nextAvailablePiece: null,
    ...overrides,
  };
}

// ─── deriveContentLoopAction — priority rules ─────────────────────────────────

describe("deriveContentLoopAction", () => {
  it("new user with no daily history and all exercises available → continue-path", () => {
    const result = deriveContentLoopAction(
      baseInput({ daily: dailyDone(), welcomePackage: noPending(), primaryPath: PATH_ALL_AVAILABLE }),
    );
    expect(result.variant).toBe("continue-path");
  });

  it("daily not done today → daily-pending (highest priority)", () => {
    const result = deriveContentLoopAction(
      baseInput({ daily: dailyPending(), primaryPath: PATH_ALL_AVAILABLE }),
    );
    expect(result.variant).toBe("daily-pending");
    expect(result.destination).toBe("/exercises?slot=daily");
  });

  it("daily done + welcome package unlocked but not claimed → claim-pending", () => {
    const result = deriveContentLoopAction(
      baseInput({ daily: dailyDone(), welcomePackage: pendingClaim(), primaryPath: PATH_ALL_AVAILABLE }),
    );
    expect(result.variant).toBe("claim-pending");
    expect(result.destination).toBe("/trophies");
  });

  it("daily done + no pending reward + exercises available → continue-path", () => {
    const result = deriveContentLoopAction(
      baseInput({ daily: dailyDone(), welcomePackage: alreadyClaimed(), primaryPath: PATH_ALL_AVAILABLE }),
    );
    expect(result.variant).toBe("continue-path");
    expect(result.destination).toBe("/exercises?piece=rook");
  });

  it("daily done + partial path (some exercises complete) → continue-path", () => {
    const result = deriveContentLoopAction(
      baseInput({ daily: dailyDone(), primaryPath: PATH_PARTIAL }),
    );
    expect(result.variant).toBe("continue-path");
  });

  it("daily done + all exercises done + labyrinth unlocked → labyrinth-ready", () => {
    const result = deriveContentLoopAction(
      baseInput({ daily: dailyDone(), primaryPath: PATH_LABYRINTH_READY }),
    );
    expect(result.variant).toBe("labyrinth-ready");
    expect(result.destination).toBe("/exercises?piece=rook");
  });

  it("daily done + all exercises played + some < 3★ → improve-stars", () => {
    const result = deriveContentLoopAction(
      baseInput({ daily: dailyDone(), primaryPath: PATH_ALL_DONE_IMPROVABLE }),
    );
    expect(result.variant).toBe("improve-stars");
    expect(result.destination).toBe("/exercises?piece=rook");
  });

  it("daily done + piece fully complete + next piece available → next-piece", () => {
    const result = deriveContentLoopAction(
      baseInput({ daily: dailyDone(), primaryPath: PATH_FULLY_COMPLETE, nextAvailablePiece: "bishop" }),
    );
    expect(result.variant).toBe("next-piece");
    expect(result.destination).toBe("/exercises?piece=bishop");
  });

  it("daily done + piece fully complete + no next piece → come-back-tomorrow", () => {
    const result = deriveContentLoopAction(
      baseInput({ daily: dailyDone(), primaryPath: PATH_FULLY_COMPLETE, nextAvailablePiece: null }),
    );
    expect(result.variant).toBe("come-back-tomorrow");
    expect(result.destination).toBeNull();
  });

  it("daily done + all exercises 3★ (no improvement) + no labyrinths + no next piece → come-back-tomorrow", () => {
    const result = deriveContentLoopAction(
      baseInput({ daily: dailyDone(), primaryPath: PATH_ALL_DONE_MAX, nextAvailablePiece: null }),
    );
    expect(result.variant).toBe("come-back-tomorrow");
  });

  it("empty path + daily done + no reward + no next piece → view-progress", () => {
    const result = deriveContentLoopAction(
      baseInput({ daily: dailyDone(), primaryPath: [], nextAvailablePiece: null }),
    );
    expect(result.variant).toBe("view-progress");
    expect(result.destination).toBe("/trophies");
  });

  // ─── Priority ordering ────────────────────────────────────────────────────

  it("priority: daily-pending beats claim-pending when both true", () => {
    const result = deriveContentLoopAction(
      baseInput({ daily: dailyPending(), welcomePackage: pendingClaim() }),
    );
    expect(result.variant).toBe("daily-pending");
  });

  it("priority: claim-pending beats continue-path when both true", () => {
    const result = deriveContentLoopAction(
      baseInput({
        daily: dailyDone(),
        welcomePackage: pendingClaim(),
        primaryPath: PATH_ALL_AVAILABLE,
      }),
    );
    expect(result.variant).toBe("claim-pending");
  });

  it("priority: labyrinth-ready beats improve-stars when both true", () => {
    const pathWithBothConditions: TrainingNode[] = [
      exerciseNode("ex-1", "complete", 1),
      exerciseNode("ex-2", "complete", 2),
      labyrinthNode("lab-1", "available"),
    ];
    const result = deriveContentLoopAction(
      baseInput({ daily: dailyDone(), primaryPath: pathWithBothConditions }),
    );
    expect(result.variant).toBe("labyrinth-ready");
  });

  it("view-progress destination is /trophies (never null)", () => {
    const result = deriveContentLoopAction(
      baseInput({ daily: dailyDone(), primaryPath: [] }),
    );
    expect(result.destination).toBe("/trophies");
  });

  it("come-back-tomorrow destination is null (informative, no nav)", () => {
    const result = deriveContentLoopAction(
      baseInput({ daily: dailyDone(), primaryPath: PATH_FULLY_COMPLETE }),
    );
    expect(result.destination).toBeNull();
  });

  it("next-piece destination includes the piece id", () => {
    const result = deriveContentLoopAction(
      baseInput({ daily: dailyDone(), primaryPath: PATH_FULLY_COMPLETE, nextAvailablePiece: "knight" }),
    );
    expect(result.destination).toBe("/exercises?piece=knight");
  });

  it("claimed welcome package does not trigger claim-pending", () => {
    const result = deriveContentLoopAction(
      baseInput({ daily: dailyDone(), welcomePackage: alreadyClaimed(), primaryPath: PATH_ALL_AVAILABLE }),
    );
    expect(result.variant).not.toBe("claim-pending");
  });
});

// ─── hasAvailableExercise ─────────────────────────────────────────────────────

describe("hasAvailableExercise", () => {
  it("returns true when any exercise node has status available", () => {
    expect(hasAvailableExercise(PATH_ALL_AVAILABLE)).toBe(true);
  });

  it("returns true when at least one exercise is available (mixed)", () => {
    expect(hasAvailableExercise(PATH_PARTIAL)).toBe(true);
  });

  it("returns false when all exercise nodes are complete", () => {
    expect(hasAvailableExercise(PATH_ALL_DONE_IMPROVABLE)).toBe(false);
  });

  it("returns false for an empty path", () => {
    expect(hasAvailableExercise([])).toBe(false);
  });

  it("returns false when path has only labyrinth nodes (no exercises)", () => {
    expect(hasAvailableExercise([labyrinthNode("lab-1", "available")])).toBe(false);
  });
});

// ─── hasImprovableExercise ────────────────────────────────────────────────────

describe("hasImprovableExercise", () => {
  it("returns true when all exercises complete but at least one has stars < 3", () => {
    expect(hasImprovableExercise(PATH_ALL_DONE_IMPROVABLE)).toBe(true);
  });

  it("returns false when all exercises have 3★", () => {
    expect(hasImprovableExercise(PATH_ALL_DONE_MAX)).toBe(false);
  });

  it("returns false when any exercise is still available (not yet played)", () => {
    expect(hasImprovableExercise(PATH_PARTIAL)).toBe(false);
  });

  it("returns false for an empty path", () => {
    expect(hasImprovableExercise([])).toBe(false);
  });

  it("returns true when exercises complete with mixed 1★ and 3★", () => {
    const path: TrainingNode[] = [
      exerciseNode("ex-1", "complete", 3),
      exerciseNode("ex-2", "complete", 1),
    ];
    expect(hasImprovableExercise(path)).toBe(true);
  });
});

// ─── hasReadyLabyrinth ────────────────────────────────────────────────────────

describe("hasReadyLabyrinth", () => {
  it("returns true when any labyrinth node status is available", () => {
    expect(hasReadyLabyrinth(PATH_LABYRINTH_READY)).toBe(true);
  });

  it("returns false when all labyrinths are locked", () => {
    const path: TrainingNode[] = [
      exerciseNode("ex-1", "available"),
      labyrinthNode("lab-1", "locked"),
    ];
    expect(hasReadyLabyrinth(path)).toBe(false);
  });

  it("returns false when all labyrinths are complete", () => {
    expect(hasReadyLabyrinth(PATH_FULLY_COMPLETE)).toBe(false);
  });

  it("returns false when path has no labyrinth nodes", () => {
    expect(hasReadyLabyrinth(PATH_ALL_AVAILABLE)).toBe(false);
  });

  it("returns false for an empty path", () => {
    expect(hasReadyLabyrinth([])).toBe(false);
  });
});

// ─── isPieceFullyComplete ─────────────────────────────────────────────────────

describe("isPieceFullyComplete", () => {
  it("returns true when all exercises complete and all labyrinths complete", () => {
    expect(isPieceFullyComplete(PATH_FULLY_COMPLETE)).toBe(true);
  });

  it("returns true when all exercises complete and no labyrinths exist (vacuously)", () => {
    expect(isPieceFullyComplete(PATH_ALL_DONE_MAX)).toBe(true);
  });

  it("returns false when any exercise is still available", () => {
    expect(isPieceFullyComplete(PATH_ALL_AVAILABLE)).toBe(false);
  });

  it("returns false when a labyrinth is available (not complete)", () => {
    expect(isPieceFullyComplete(PATH_LABYRINTH_READY)).toBe(false);
  });

  it("returns false when a labyrinth is locked (not complete)", () => {
    const path: TrainingNode[] = [
      exerciseNode("ex-1", "complete", 3),
      labyrinthNode("lab-1", "locked"),
    ];
    expect(isPieceFullyComplete(path)).toBe(false);
  });

  it("returns false for an empty path", () => {
    expect(isPieceFullyComplete([])).toBe(false);
  });
});

// ─── hasMoreContent ───────────────────────────────────────────────────────────

describe("hasMoreContent", () => {
  it("true when exercises are available", () => {
    expect(hasMoreContent(PATH_ALL_AVAILABLE, null)).toBe(true);
  });
  it("true when labyrinth is ready", () => {
    expect(hasMoreContent(PATH_LABYRINTH_READY, null)).toBe(true);
  });
  it("true when exercises improvable", () => {
    expect(hasMoreContent(PATH_ALL_DONE_IMPROVABLE, null)).toBe(true);
  });
  it("true when piece fully complete but nextAvailablePiece exists", () => {
    expect(hasMoreContent(PATH_FULLY_COMPLETE, "bishop")).toBe(true);
  });
  it("false when piece fully complete and no next piece", () => {
    expect(hasMoreContent(PATH_FULLY_COMPLETE, null)).toBe(false);
  });
  it("false for empty path", () => {
    expect(hasMoreContent([], null)).toBe(false);
  });
});

// ─── B2.3a daily quota variants ───────────────────────────────────────────────

const AT_FREE_LIMIT = { isAtFreeLimit: true, isAtHardMax: false };
const AT_HARD_MAX = { isAtFreeLimit: false, isAtHardMax: true };
const WITHIN_QUOTA = { isAtFreeLimit: false, isAtHardMax: false };

describe("deriveContentLoopAction — B2.3a quota variants", () => {
  it("sessionQuota null (Full mode) → never returns daily-limit-reached", () => {
    const result = deriveContentLoopAction(
      baseInput({ sessionQuota: null, primaryPath: PATH_ALL_AVAILABLE }),
    );
    expect(result.variant).not.toBe("daily-limit-reached");
    expect(result.variant).toBe("continue-path");
  });

  it("sessionQuota undefined (default) → no gate applied", () => {
    const result = deriveContentLoopAction(
      baseInput({ primaryPath: PATH_ALL_AVAILABLE }),
    );
    expect(result.variant).toBe("continue-path");
  });

  it("isAtFreeLimit + content available → daily-limit-reached", () => {
    const result = deriveContentLoopAction(
      baseInput({ sessionQuota: AT_FREE_LIMIT, primaryPath: PATH_ALL_AVAILABLE }),
    );
    expect(result.variant).toBe("daily-limit-reached");
    expect(result.destination).toBeNull();
  });

  it("isAtHardMax + content available → daily-max-reached", () => {
    const result = deriveContentLoopAction(
      baseInput({ sessionQuota: AT_HARD_MAX, primaryPath: PATH_ALL_AVAILABLE }),
    );
    expect(result.variant).toBe("daily-max-reached");
    expect(result.destination).toBeNull();
  });

  it("isAtHardMax takes priority over isAtFreeLimit", () => {
    const both = { isAtFreeLimit: true, isAtHardMax: true };
    const result = deriveContentLoopAction(
      baseInput({ sessionQuota: both, primaryPath: PATH_ALL_AVAILABLE }),
    );
    expect(result.variant).toBe("daily-max-reached");
  });

  it("isAtFreeLimit but no more content → falls through to come-back-tomorrow", () => {
    const result = deriveContentLoopAction(
      baseInput({ sessionQuota: AT_FREE_LIMIT, primaryPath: PATH_FULLY_COMPLETE, nextAvailablePiece: null }),
    );
    expect(result.variant).toBe("come-back-tomorrow");
  });

  it("within quota → continues normally (continue-path)", () => {
    const result = deriveContentLoopAction(
      baseInput({ sessionQuota: WITHIN_QUOTA, primaryPath: PATH_ALL_AVAILABLE }),
    );
    expect(result.variant).toBe("continue-path");
  });

  it("daily-pending is still priority 1 — quota gate cannot block it", () => {
    const result = deriveContentLoopAction(
      baseInput({ daily: dailyPending(), sessionQuota: AT_FREE_LIMIT }),
    );
    expect(result.variant).toBe("daily-pending");
  });

  it("claim-pending is still priority 2 — quota gate cannot block it", () => {
    const result = deriveContentLoopAction(
      baseInput({ welcomePackage: pendingClaim(), sessionQuota: AT_FREE_LIMIT }),
    );
    expect(result.variant).toBe("claim-pending");
  });

  it("daily-limit-reached copy: ctaEN is 'Come back tomorrow'", () => {
    const result = deriveContentLoopAction(
      baseInput({ sessionQuota: AT_FREE_LIMIT, primaryPath: PATH_ALL_AVAILABLE }),
    );
    expect(result.ctaEN).toBe("Come back tomorrow");
    expect(result.subEN).toBe("Great focus today.");
  });

  it("daily-max-reached copy: subEN mentions enough focus", () => {
    const result = deriveContentLoopAction(
      baseInput({ sessionQuota: AT_HARD_MAX, primaryPath: PATH_ALL_AVAILABLE }),
    );
    expect(result.subEN).toContain("enough focus");
  });
});
