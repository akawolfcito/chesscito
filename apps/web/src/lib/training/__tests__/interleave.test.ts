import { describe, expect, it } from "vitest";

import {
  buildTrainingPath,
  interleaveTrainingRows,
  LABYRINTH_UNLOCK_THRESHOLD,
} from "@/lib/training/path";
import { EXERCISES } from "@/lib/game/exercises";

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
