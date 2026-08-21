import { describe, expect, it } from "vitest";

import { appendTrainingRows, buildTrainingPath } from "@/lib/training/path";
import { defaultMiniGamePools } from "@/lib/minigames/catalog";
import { resolveChallengePool, resolveLibrary } from "@/lib/minigames/queue";

/**
 * The Exercises / Mini-games separation, stated as invariants.
 *
 * ⛔ THE WHOLE POINT: the separation is PRESENTATION. `buildTrainingPath` was
 * not touched, so mastery, unlocks, stars, stored bests and the badge chain all
 * compute from exactly the input they always did. What changed is that the
 * LEARN drawer stops DRAWING the lane rows (`showLanePathRows`), because the
 * Library (`/minigames`) is their home now.
 *
 * E-1 — "no lane-2 rows visually rendered" — is asserted at the surface, in
 * `components/exercises/__tests__/restore-completed-content.test.tsx`
 * ("draws no lane row on the path"), which mounts the real screen in LEARN.
 * The invariants below are the ones a pure test can hold honestly.
 */

const pools = defaultMiniGamePools();
const pool = resolveChallengePool(pools);

const ROOK_EXERCISES = pools.exercises.rook;
const ROOK_LANE = pools.labyrinths.rook ?? [];

const CATALOG = {
  exercises: { ...pools.exercises },
  labyrinths: { ...pools.labyrinths },
};

function path(stars: Record<string, number> = {}, lane = ROOK_LANE) {
  return buildTrainingPath({
    piece: "rook",
    progress: { piece: "rook", currentId: null, stars },
    labyrinthBests: {},
    badgeClaimed: false,
    catalog: { ...CATALOG, labyrinths: { ...CATALOG.labyrinths, rook: lane } },
  });
}

describe("E-2 — lane-2 nodes are still there internally", () => {
  it("has lane nodes to hide (otherwise this file proves nothing)", () => {
    expect(ROOK_LANE.length).toBeGreaterThan(0);
  });

  it("still builds a labyrinth node for every lane level", () => {
    const lane = path().filter((node) => node.kind === "labyrinth");
    expect(lane).toHaveLength(ROOK_LANE.length);
  });

  it("keeps them in the path whatever the drawer draws", () => {
    // `appendTrainingRows` is the presentation layer, and it is the ONLY place
    // the separation acts: given no lane rows it emits none, given them it
    // emits them — and the path it read from is identical either way.
    const nodes = path().filter((node) => node.kind === "labyrinth");
    expect(appendTrainingRows([1, 2, 3], [])).toHaveLength(3);
    expect(appendTrainingRows([1, 2, 3], nodes)).toHaveLength(3 + nodes.length);
  });
});

describe("E-3 — the badge and mastery chain is untouched", () => {
  it("still emits exactly one badge node and one mastery node", () => {
    const built = path();
    expect(built.filter((node) => node.kind === "badge")).toHaveLength(1);
    expect(built.filter((node) => node.kind === "mastery")).toHaveLength(1);
  });

  it("computes the same path from the same inputs, every time", () => {
    const stars = { [ROOK_EXERCISES[0]!.id]: 3, [ROOK_EXERCISES[1]!.id]: 2 };
    expect(path(stars)).toEqual(path(stars));
  });

  it("still advances node status with stars, not with what is drawn", () => {
    const none = path();
    const some = path(
      Object.fromEntries(ROOK_EXERCISES.map((exercise) => [exercise.id, 3])),
    );
    const statuses = (p: ReturnType<typeof path>) => p.map((node) => node.status);
    expect(statuses(some)).not.toEqual(statuses(none));
  });
});

describe("E-4 — exercise locking is unchanged", () => {
  it("emits one exercise node per exercise, in order", () => {
    const exercises = path().filter((node) => node.kind === "exercise");
    expect(exercises).toHaveLength(ROOK_EXERCISES.length);
    expect(exercises.map((node) => node.id)).toEqual(
      ROOK_EXERCISES.map((exercise) => exercise.id),
    );
  });

  it("opens the first exercise and gates nothing on lane content", () => {
    const withLane = path();
    const withoutLane = path({}, []);
    const exerciseStatuses = (p: ReturnType<typeof path>) =>
      p.filter((node) => node.kind === "exercise").map((node) => node.status);
    // Removing the lane entirely does not move a single exercise's status —
    // which is why hiding the ROWS cannot move one either.
    expect(exerciseStatuses(withLane)).toEqual(exerciseStatuses(withoutLane));
  });
});

describe("E-5 — no healthy mini-game becomes unreachable", () => {
  it("lists in the Library every challenge the queue knows", () => {
    const listed = resolveLibrary(pools).groups.flatMap((group) =>
      group.challenges.map((challenge) => challenge.challengeId),
    );
    expect(listed.slice().sort()).toEqual(
      pool.map((entry) => entry.challengeId).sort(),
    );
  });

  it("covers everything the path used to expose, for every playable piece", () => {
    // The lane rows were the old index. Whatever they could reach, the Library
    // must reach — otherwise the separation orphaned content instead of moving it.
    const listed = new Set(
      resolveLibrary(pools).groups.flatMap((group) =>
        group.challenges.map((challenge) => challenge.challengeId),
      ),
    );
    for (const entry of pool) expect(listed.has(entry.challengeId)).toBe(true);
  });
});
