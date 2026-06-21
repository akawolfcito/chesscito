import { describe, expect, it } from "vitest";

import {
  buildTrainingPath,
  getLabyrinthForAutoAdvance,
  interleaveTrainingRows,
  nextPendingLabyrinthAfterExercise,
  LABYRINTH_UNLOCK_THRESHOLD,
} from "@/lib/training/path";
import { EXERCISES } from "@/lib/game/exercises";

/** Spread `totalStars` across the pool (3★ per exercise, in catalog order)
 *  and return the id-keyed best-stars map. Sparse: zero entries dropped. */
function rookStarsTotaling(totalStars: number): Record<string, number> {
  let remaining = totalStars;
  const map: Record<string, number> = {};
  for (const ex of EXERCISES.rook) {
    const take = Math.min(3, remaining);
    remaining -= take;
    if (take > 0) map[ex.id] = take;
  }
  return map;
}

function rookPath(totalStars: number, bests: Record<string, number> = {}) {
  return buildTrainingPath({
    piece: "rook",
    progress: { piece: "rook", currentId: null, stars: rookStarsTotaling(totalStars) },
    labyrinthBests: bests,
    badgeClaimed: false,
  });
}

function rookLabs() {
  return buildTrainingPath({
    piece: "rook",
    progress: { piece: "rook", currentId: null, stars: {} },
    labyrinthBests: {},
    badgeClaimed: false,
  }).filter((node) => node.kind === "labyrinth");
}

describe("interleaveTrainingRows — presentation-only interleave (D6)", () => {
  it("places the first labyrinth after the earliest exercises that can reach its unlock", () => {
    const exercises = EXERCISES.rook.map((e) => e.id);
    const rows = interleaveTrainingRows(exercises, rookLabs());

    // First lab unlocks at LABYRINTH_UNLOCK_THRESHOLD stars; at 3★ per
    // exercise that is reachable after ceil(threshold/3) exercises.
    const anchor = Math.ceil(LABYRINTH_UNLOCK_THRESHOLD / 3);
    const firstLabAt = rows.findIndex((r) => r.kind === "labyrinth");
    expect(firstLabAt).toBe(anchor);
  });

  it("alternates: each subsequent labyrinth sits one exercise later", () => {
    const exercises = EXERCISES.rook.map((e) => e.id);
    const labs = rookLabs();
    const rows = interleaveTrainingRows(exercises, labs);

    const labPositions = rows
      .map((r, i) => (r.kind === "labyrinth" ? i : -1))
      .filter((i) => i >= 0);
    // Consecutive labs are separated by exactly one exercise while
    // exercises remain; any leftover labs append at the tail.
    for (let i = 1; i < labPositions.length; i++) {
      const gap = labPositions[i] - labPositions[i - 1];
      expect(gap === 2 || gap === 1).toBe(true);
    }
    // Everything is present exactly once.
    expect(rows).toHaveLength(exercises.length + labs.length);
    expect(rows.filter((r) => r.kind === "exercise").map((r) => r.value)).toEqual(
      exercises,
    );
    expect(
      rows.filter((r) => r.kind === "labyrinth").map((r) => r.value.id),
    ).toEqual(labs.map((l) => l.id));
  });

  it("returns exercises unchanged when there are no labyrinths", () => {
    const rows = interleaveTrainingRows(["a", "b", "c"], []);
    expect(rows).toEqual([
      { kind: "exercise", value: "a" },
      { kind: "exercise", value: "b" },
      { kind: "exercise", value: "c" },
    ]);
  });

  it("appends all labyrinths when there are no exercises (degenerate)", () => {
    const labs = rookLabs();
    const rows = interleaveTrainingRows([], labs);
    expect(rows.every((r) => r.kind === "labyrinth")).toBe(true);
    expect(rows).toHaveLength(labs.length);
  });
});

describe("nextPendingLabyrinthAfterExercise — the path flows THROUGH labs (QA G1)", () => {
  const anchor = Math.ceil(LABYRINTH_UNLOCK_THRESHOLD / 3);
  const anchorExerciseId = EXERCISES.rook[anchor - 1].id;

  it("returns the available lab when it is the immediate next interleaved row", () => {
    // 6★ → lab 1 unlocked; the anchor exercise is the one right before it.
    const next = nextPendingLabyrinthAfterExercise(
      rookPath(LABYRINTH_UNLOCK_THRESHOLD),
      anchorExerciseId,
    );
    expect(next).not.toBeNull();
    expect(next!.kind).toBe("labyrinth");
    expect(next!.status).toBe("available");
  });

  it("returns null when the next row is another exercise", () => {
    const next = nextPendingLabyrinthAfterExercise(
      rookPath(LABYRINTH_UNLOCK_THRESHOLD),
      EXERCISES.rook[0].id,
    );
    expect(next).toBeNull();
  });

  it("returns null when the adjacent lab is still locked (stars short)", () => {
    const next = nextPendingLabyrinthAfterExercise(
      rookPath(3), // below the unlock threshold
      anchorExerciseId,
    );
    expect(next).toBeNull();
  });

  it("returns null when the adjacent lab is already complete", () => {
    // The first lab node (by buildTrainingPath ordering) may be a generated
    // puzzle appended after the hand-authored set; derive its id rather than
    // hardcode rook-lab-1 so the "adjacent lab complete" case stays accurate.
    const firstLabId = rookLabs()[0].id;
    const path = rookPath(LABYRINTH_UNLOCK_THRESHOLD, { [firstLabId]: 3 });
    const labAfterAnchor = path.filter((n) => n.kind === "labyrinth")[0];
    expect(labAfterAnchor.status).toBe("complete");
    const next = nextPendingLabyrinthAfterExercise(path, anchorExerciseId);
    expect(next).toBeNull();
  });

  it("returns null for an unknown exercise id", () => {
    expect(
      nextPendingLabyrinthAfterExercise(rookPath(6), "no-such-id"),
    ).toBeNull();
  });
});

describe("getLabyrinthForAutoAdvance — path sequencing with late-unlock (Exercise Path Sequencing)", () => {
  const anchor = Math.ceil(LABYRINTH_UNLOCK_THRESHOLD / 3);
  // Exercise right before the first lab in the interleaved path (happy path anchor)
  const anchorExerciseId = EXERCISES.rook[anchor - 1].id;
  // Exercise AFTER the anchor (player already passed the lab slot)
  const postAnchorExerciseId = EXERCISES.rook[anchor + 1].id;

  // Test 1: Exercise → next unlocked Labyrinth (happy path, same as nextPendingLabyrinthAfterExercise)
  it("returns the immediate next lab when it is available (happy path)", () => {
    const next = getLabyrinthForAutoAdvance(
      rookPath(LABYRINTH_UNLOCK_THRESHOLD),
      anchorExerciseId,
    );
    expect(next).not.toBeNull();
    expect(next!.kind).toBe("labyrinth");
    expect(next!.status).toBe("available");
  });

  // Test 2: Exercise → next Exercise (no lab immediately next, no late unlock)
  it("returns null when next row is an exercise and no earlier lab is available", () => {
    // Below unlock threshold: no lab available anywhere
    const next = getLabyrinthForAutoAdvance(
      rookPath(3),
      EXERCISES.rook[0].id,
    );
    expect(next).toBeNull();
  });

  // Test 3: Exercise → locked Labyrinth (next row is locked lab, no earlier available lab)
  it("returns null when next row is a locked lab and no earlier lab is available", () => {
    // 3★ total: lab is still locked; this exercise is the anchor but stars are short
    const next = getLabyrinthForAutoAdvance(
      rookPath(3),
      anchorExerciseId,
    );
    expect(next).toBeNull();
  });

  // Test 4: Late unlock — player past anchor, lab now available
  it("returns available lab when player is past its anchor (late unlock)", () => {
    // Player is at postAnchorExerciseId (past the lab's interleaved slot) but
    // has just accumulated enough stars to unlock it.
    const next = getLabyrinthForAutoAdvance(
      rookPath(LABYRINTH_UNLOCK_THRESHOLD),
      postAnchorExerciseId,
    );
    expect(next).not.toBeNull();
    expect(next!.kind).toBe("labyrinth");
    expect(next!.status).toBe("available");
  });

  it("returns an available lab after a manually selected early exercise", () => {
    // Stars can have been earned in later exercises through manual path
    // selection; the pending labyrinth is then after this exercise's row.
    const next = getLabyrinthForAutoAdvance(
      rookPath(LABYRINTH_UNLOCK_THRESHOLD),
      EXERCISES.rook[0].id,
    );
    expect(next).not.toBeNull();
    expect(next!.kind).toBe("labyrinth");
    expect(next!.status).toBe("available");
  });

  // Test 5: No salta labyrinth desbloqueado — the lab is always entered if available
  it("does not skip an available lab regardless of player position", () => {
    // Player far past the anchor, lab still available
    const lastExerciseId = EXERCISES.rook[EXERCISES.rook.length - 1].id;
    const next = getLabyrinthForAutoAdvance(
      rookPath(LABYRINTH_UNLOCK_THRESHOLD),
      lastExerciseId,
    );
    expect(next).not.toBeNull();
    expect(next!.kind).toBe("labyrinth");
    expect(next!.status).toBe("available");
  });

  // Test 6: Missing item → safe fallback
  it("returns null for an unknown exercise id", () => {
    expect(
      getLabyrinthForAutoAdvance(rookPath(LABYRINTH_UNLOCK_THRESHOLD), "no-such-id"),
    ).toBeNull();
  });

  // Test 7: Last item → null/completion (all labs done, no pending challenge)
  it("returns null when all labs are complete", () => {
    const firstLabId = rookLabs()[0].id;
    // Mark first lab complete (others stay locked in chain) — still no available labs
    const path = rookPath(LABYRINTH_UNLOCK_THRESHOLD, { [firstLabId]: 3 });
    // With first lab complete, second lab unlocks. Mark it complete too, etc.
    // Simplest: mark first lab complete and verify second is now available (not null).
    // Then mark both complete so none are available.
    const allLabIds = rookLabs().map((l) => l.id);
    const allBests = Object.fromEntries(allLabIds.map((id) => [id, 3]));
    const fullPath = rookPath(LABYRINTH_UNLOCK_THRESHOLD * 4, allBests);
    expect(
      getLabyrinthForAutoAdvance(fullPath, anchorExerciseId),
    ).toBeNull();
  });

  // Test 8: Path with multiple interleaved labyrinths
  it("returns the first available lab in a multi-lab interleaved path", () => {
    // First lab available, rest chained-locked
    const path = rookPath(LABYRINTH_UNLOCK_THRESHOLD);
    const labs = path.filter((n) => n.kind === "labyrinth");
    expect(labs[0].status).toBe("available");
    expect(labs.slice(1).every((l) => l.status === "locked")).toBe(true);

    // From any position past the anchor, the first available lab is returned
    const next = getLabyrinthForAutoAdvance(path, postAnchorExerciseId);
    expect(next?.id).toBe(labs[0].id);
  });

  // Test 9: No labyrinths in path — safe, returns null without crash
  it("returns null safely when path has no labyrinths", () => {
    const pathNoLabs = rookPath(0).filter((node) => node.kind !== "labyrinth");
    expect(
      getLabyrinthForAutoAdvance(pathNoLabs, EXERCISES.rook[0].id),
    ).toBeNull();
  });
});
