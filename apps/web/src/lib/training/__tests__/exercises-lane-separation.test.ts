import { describe, expect, it } from "vitest";

import { appendTrainingRows, buildTrainingPath } from "@/lib/training/path";
import { defaultMiniGamePools } from "@/lib/minigames/catalog";
import {
  DAILY_NEW_SLOTS,
  resolveWindowAssignment,
  type WindowAssignment,
} from "@/lib/minigames/daily-window";
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
  /* ⛔ THE MEANING OF "REACHABLE" CHANGED WITH THE DAILY ALLOWANCE (2026-08-21).
     It used to be "listed in the Library right now" — the Library showed all 13.
     It is now "reachable OVER TIME", because listing everything as playable
     would let a player walk past the daily window. So the property to prove is
     that replenishment eventually hands out every challenge, and that nothing
     falls outside the three Library buckets on the way. */

  it("accounts for every challenge in exactly one Library bucket", () => {
    const done = new Set(pool.slice(0, 3).map((entry) => entry.challengeId));
    const assigned = new Set(pool.slice(3, 5).map((entry) => entry.challengeId));
    const library = resolveLibrary(pools, done, assigned);
    expect(library.today.length + library.completed.length + library.upcoming).toBe(
      pool.length,
    );
    expect(library.total).toBe(pool.length);
  });

  it("hands out every healthy challenge across consecutive windows", () => {
    let assignment: WindowAssignment | null = null;
    const completed = new Set<string>();
    const seen = new Set<string>();

    // A maximally active player: clears everything assigned, every window.
    for (let day = 1; day <= 30 && seen.size < pool.length; day += 1) {
      const resolved = resolveWindowAssignment({
        stored: assignment,
        windowId: `2026-09-${String(day).padStart(2, "0")}`,
        pool,
        completedChallengeIds: completed,
      });
      assignment = resolved.assignment;
      for (const id of assignment.assigned) {
        seen.add(id);
        completed.add(id);
      }
    }

    expect(seen.size).toBe(pool.length);
  });

  it("takes at least as many windows as the cap implies — no burst", () => {
    let assignment: WindowAssignment | null = null;
    const completed = new Set<string>();
    const seen = new Set<string>();
    let windows = 0;

    for (let day = 1; day <= 30 && seen.size < pool.length; day += 1) {
      const resolved = resolveWindowAssignment({
        stored: assignment,
        windowId: `2026-09-${String(day).padStart(2, "0")}`,
        pool,
        completedChallengeIds: completed,
      });
      assignment = resolved.assignment;
      for (const id of assignment.assigned) {
        seen.add(id);
        completed.add(id);
      }
      windows += 1;
    }

    // ⛔ The whole point of the pass: the catalogue cannot burn in one sitting.
    expect(windows).toBeGreaterThanOrEqual(Math.ceil(pool.length / DAILY_NEW_SLOTS));
  });
});
