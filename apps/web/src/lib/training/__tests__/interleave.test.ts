import { describe, expect, it } from "vitest";

import {
  buildTrainingPath,
  interleaveTrainingRows,
  nextPendingLabyrinthAfterExercise,
  LABYRINTH_UNLOCK_THRESHOLD,
} from "@/lib/training/path";
import { EXERCISES } from "@/lib/game/exercises";

function rookPath(totalStars: number, bests: Record<string, number> = {}) {
  let remaining = totalStars;
  const stars = EXERCISES.rook.map(() => {
    const take = Math.min(3, remaining);
    remaining -= take;
    return take;
  });
  return buildTrainingPath({
    piece: "rook",
    progress: { piece: "rook", exerciseIndex: 0, stars },
    labyrinthBests: bests,
    badgeClaimed: false,
  });
}

function rookLabs() {
  return buildTrainingPath({
    piece: "rook",
    progress: {
      piece: "rook",
      exerciseIndex: 0,
      stars: new Array(EXERCISES.rook.length).fill(0),
    },
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
