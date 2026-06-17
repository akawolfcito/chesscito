/**
 * Legacy → id-map migration on load (Exercises-Builder cluster,
 * 2026-06-16).
 *
 * Before this cluster the hook stored `stars` as a positional array and
 * the active exercise as `exerciseIndex`. The persistence layer now
 * stores an id-map (`Record<exerciseId, number>`) + `currentId`. These
 * tests prove that real legacy localStorage data (positional `stars[]`)
 * migrates losslessly by CURRENT catalog order: every value lands under
 * the right exerciseId, mastery is unchanged, and the migrated id-map
 * shape is written back so subsequent loads are idempotent.
 *
 * (The pure positional `migrateStarsLength` helper + its array pad/
 * truncate semantics were removed in this cluster — pad/truncate by
 * length is meaningless under an id-map, where missing ids simply read
 * as 0 and unknown ids are dropped.)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Sprint 3 commit F — the hook imports wagmi + the training earn helper.
// Migration tests don't exercise either, but the mocks keep the
// renderHook calls from blowing up on missing providers.
vi.mock("@/lib/peones/training-earn", () => ({
  submitTrainingExerciseEarn: vi.fn().mockResolvedValue({
    kind: "success",
    credited: 0,
    attestationHash: null,
    ledgerId: null,
    duplicate: false,
  }),
}));

vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({ isConnected: false, address: undefined })),
}));

vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));

import { EXERCISES } from "@/lib/game/exercises";

const id = (piece: "rook" | "king" | "pawn", i: number) => EXERCISES[piece][i].id;

describe("useExerciseProgress — legacy stars[5] preservation (real catalog today)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  /** King pool is 10 today (king-1..10). A legacy user with stars[5]
   *  migrates: each value lands under king-1..5 by catalog order, the
   *  remaining ids stay unset (read as 0), total star count is unchanged,
   *  and currentId resolves from the legacy exerciseIndex. The migrated
   *  id-map shape is written back for idempotent subsequent loads. */
  it("migrates legacy King [3,3,2,1,0] to an id-map preserving every value", async () => {
    localStorage.setItem(
      "chesscito:progress:king",
      JSON.stringify({ piece: "king", exerciseIndex: 4, stars: [3, 3, 2, 1, 0] }),
    );

    const { renderHook, act } = await import("@testing-library/react");
    const { useExerciseProgress } = await import("@/hooks/use-exercise-progress");

    const { result } = renderHook(() => useExerciseProgress("king"));
    act(() => {});

    expect(result.current.progress.stars[id("king", 0)]).toBe(3);
    expect(result.current.progress.stars[id("king", 1)]).toBe(3);
    expect(result.current.progress.stars[id("king", 2)]).toBe(2);
    expect(result.current.progress.stars[id("king", 3)]).toBe(1);
    expect(result.current.progress.stars[id("king", 4)] ?? 0).toBe(0);
    expect(result.current.progress.currentId).toBe(id("king", 4));
    // totalStars unchanged: 3 + 3 + 2 + 1 + 0 = 9.
    expect(result.current.totalStars).toBe(9);

    // Migrated id-map shape persisted back (no array left).
    const persisted = JSON.parse(
      localStorage.getItem("chesscito:progress:king") ?? "null",
    );
    expect(Array.isArray(persisted.stars)).toBe(false);
    expect(persisted.stars[id("king", 0)]).toBe(3);
    expect(persisted.currentId).toBe(id("king", 4));
    expect("exerciseIndex" in persisted).toBe(false);
  });

  // A length-10 legacy array on a 10-piece (Pawn): every value maps by
  // catalog order; sparse map drops the trailing zeros but the read +
  // mastery are identical.
  it("maps a length-10 legacy stars array verbatim by catalog order (Pawn)", async () => {
    localStorage.setItem(
      "chesscito:progress:pawn",
      JSON.stringify({
        piece: "pawn",
        exerciseIndex: 9,
        stars: [3, 3, 3, 3, 0, 0, 0, 0, 0, 0],
      }),
    );

    const { renderHook, act } = await import("@testing-library/react");
    const { useExerciseProgress } = await import("@/hooks/use-exercise-progress");

    const { result } = renderHook(() => useExerciseProgress("pawn"));
    act(() => {});

    expect(result.current.progress.stars[id("pawn", 0)]).toBe(3);
    expect(result.current.progress.stars[id("pawn", 3)]).toBe(3);
    expect(result.current.progress.stars[id("pawn", 4)] ?? 0).toBe(0);
    expect(result.current.progress.currentId).toBe(id("pawn", 9));
    expect(result.current.totalStars).toBe(12);
  });

  it("migrates Rook legacy stars[5] by catalog order (pool grew to 10)", async () => {
    localStorage.setItem(
      "chesscito:progress:rook",
      JSON.stringify({ piece: "rook", exerciseIndex: 4, stars: [3, 3, 3, 3, 0] }),
    );

    const { renderHook, act } = await import("@testing-library/react");
    const { useExerciseProgress } = await import("@/hooks/use-exercise-progress");

    const { result } = renderHook(() => useExerciseProgress("rook"));
    act(() => {});

    // Values preserved under rook-1..4; trailing ids unset (read as 0).
    expect(result.current.progress.stars[id("rook", 0)]).toBe(3);
    expect(result.current.progress.stars[id("rook", 3)]).toBe(3);
    expect(result.current.progress.stars[id("rook", 4)] ?? 0).toBe(0);
    expect(result.current.totalStars).toBe(12);
  });
});

describe("useExerciseProgress — id-map sanitization on load", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  /** An id-map persisted with an unknown id (e.g. a removed exercise) and
   *  an out-of-range value: the unknown id is dropped, the value is
   *  clamped. This replaces the legacy "truncate when pool shrank" path —
   *  under an id-map a removed exercise's stars simply vanish from the
   *  map; surviving exercises keep their stars by id. */
  it("drops ids absent from the current pool and clamps values", async () => {
    localStorage.setItem(
      "chesscito:progress:rook",
      JSON.stringify({
        piece: "rook",
        currentId: id("rook", 0),
        stars: {
          [id("rook", 0)]: 3,
          [id("rook", 1)]: 7, // clamp → 3
          "rook-removed-legacy": 3, // unknown → dropped
        },
      }),
    );

    const { renderHook, act } = await import("@testing-library/react");
    const { useExerciseProgress } = await import("@/hooks/use-exercise-progress");

    const { result } = renderHook(() => useExerciseProgress("rook"));
    act(() => {});

    expect(result.current.progress.stars[id("rook", 0)]).toBe(3);
    expect(result.current.progress.stars[id("rook", 1)]).toBe(3);
    expect("rook-removed-legacy" in result.current.progress.stars).toBe(false);
    // Surviving stars only: 3 + 3 = 6.
    expect(result.current.totalStars).toBe(6);
  });
});
