/**
 * Tests for the variable-length stars migration introduced in Sprint 1
 * commit 4 of Training Economy Alpha (2026-06-05).
 *
 * Two layers:
 *  - Pure helper tests (`migrateStarsLength`) — cover all three
 *    branches without mocking. These prove the migration logic itself
 *    handles equal / shorter / longer cases correctly.
 *  - Hook integration tests (`useExerciseProgress`) — prove that real
 *    legacy data for the 6 pieces today (all length 5) remains
 *    untouched, AND that simulating a count > 5 (mocked via vi.mock)
 *    correctly triggers expansion + persists the migrated shape.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Sprint 3 commit F — the hook now imports wagmi + the training
// earn helper. Migration tests don't exercise either, but the mocks
// keep the renderHook calls from blowing up on missing providers.
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

import { migrateStarsLength } from "@/hooks/use-exercise-progress";

describe("migrateStarsLength (pure helper)", () => {
  it("returns a new array with mutated=false when length already matches", () => {
    const input = [3, 3, 2, 1, 0];
    const result = migrateStarsLength(input, 5);

    expect(result.stars).toEqual([3, 3, 2, 1, 0]);
    expect(result.mutated).toBe(false);
    expect(result.truncated).toBe(false);
    // Identity check: must NOT return the same reference (caller mutates downstream).
    expect(result.stars).not.toBe(input);
  });

  it("pads RIGHT with zeros when stars.length < count, preserving values", () => {
    const result = migrateStarsLength([3, 3, 2, 1, 0], 9);

    expect(result.stars).toEqual([3, 3, 2, 1, 0, 0, 0, 0, 0]);
    expect(result.mutated).toBe(true);
    expect(result.truncated).toBe(false);
  });

  it("pads exactly to count when shorter by 1", () => {
    const result = migrateStarsLength([3, 3, 3], 4);

    expect(result.stars).toEqual([3, 3, 3, 0]);
    expect(result.mutated).toBe(true);
    expect(result.truncated).toBe(false);
  });

  it("handles empty stars by filling with zeros up to count", () => {
    const result = migrateStarsLength([], 5);

    expect(result.stars).toEqual([0, 0, 0, 0, 0]);
    expect(result.mutated).toBe(true);
    expect(result.truncated).toBe(false);
  });

  it("truncates to FIRST count values + signals truncated=true when stars.length > count", () => {
    const result = migrateStarsLength([3, 3, 2, 1, 0, 2, 1], 5);

    expect(result.stars).toEqual([3, 3, 2, 1, 0]);
    expect(result.mutated).toBe(true);
    expect(result.truncated).toBe(true);
  });

  it("returns empty array when target count is 0", () => {
    const result = migrateStarsLength([3, 3, 2], 0);

    expect(result.stars).toEqual([]);
    expect(result.mutated).toBe(true);
    expect(result.truncated).toBe(true);
  });
});

describe("useExerciseProgress — legacy stars[5] preservation (real catalog today)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  /** Sprint 1 commit 5 (2026-06-05): King pool extended from 5 to 9
   *  (king-1..7, king-9, king-10, then king-8 appended in the Rotation
   *  wave). Legacy users with stars[5] in King MUST migrate to stars[10]
   *  preserving every original value and padding with zeros. Total
   *  star count and exerciseIndex must remain unchanged. The migrated
   *  shape is written back to localStorage so subsequent loads are
   *  idempotent. */
  it("expands legacy King [3,3,2,1,0] to length 10 after king-6..10 + king-8 catalog extension", async () => {
    localStorage.setItem(
      "chesscito:progress:king",
      JSON.stringify({ piece: "king", exerciseIndex: 4, stars: [3, 3, 2, 1, 0] }),
    );

    const { renderHook, act } = await import("@testing-library/react");
    const { useExerciseProgress } = await import("@/hooks/use-exercise-progress");

    const { result } = renderHook(() => useExerciseProgress("king"));
    act(() => {});

    expect(result.current.progress.stars).toEqual([3, 3, 2, 1, 0, 0, 0, 0, 0, 0]);
    expect(result.current.progress.stars.length).toBe(10);
    expect(result.current.progress.exerciseIndex).toBe(4);
    // totalStars unchanged: 3 + 3 + 2 + 1 + 0 = 9.
    expect(result.current.totalStars).toBe(9);

    // Migrated shape persisted back for idempotent subsequent loads.
    const persisted = JSON.parse(
      localStorage.getItem("chesscito:progress:king") ?? "null",
    );
    expect(persisted.stars).toEqual([3, 3, 2, 1, 0, 0, 0, 0, 0, 0]);
    expect(persisted.exerciseIndex).toBe(4);
  });

  // Verbatim preservation when the stored length already equals the pool
  // count. After the Rotation + Labyrinths wave every piece pool is 10,
  // so this exercises the equal-length branch with a length-10 input on a
  // real 10-piece (Pawn): no padding, no truncation. (Legacy stars[5]
  // padding to 10 is covered by the King case above and the Rook case
  // below; the getExerciseCount-mock block further down covers count>5.)
  it("preserves a length-10 stars array verbatim when it equals the pool count (10)", async () => {
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

    expect(result.current.progress.stars).toEqual([3, 3, 3, 3, 0, 0, 0, 0, 0, 0]);
    expect(result.current.progress.stars.length).toBe(10);
    expect(result.current.totalStars).toBe(12);
  });

  it("pads Rook legacy stars[5] to 10 (pool grew in Rotation wave)", async () => {
    localStorage.setItem(
      "chesscito:progress:rook",
      JSON.stringify({ piece: "rook", exerciseIndex: 4, stars: [3, 3, 3, 3, 0] }),
    );

    const { renderHook, act } = await import("@testing-library/react");
    const { useExerciseProgress } = await import("@/hooks/use-exercise-progress");

    const { result } = renderHook(() => useExerciseProgress("rook"));
    act(() => {});

    // Values preserved, padded with zeros to the current pool count (10).
    expect(result.current.progress.stars).toEqual([3, 3, 3, 3, 0, 0, 0, 0, 0, 0]);
    expect(result.current.progress.stars.length).toBe(10);
    expect(result.current.totalStars).toBe(12);
  });
});

describe("useExerciseProgress — simulated count > 5 via getExerciseCount mock", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  /** Mocks `getExerciseCount` to return 9 for any piece. Validates
   *  that loadProgress expands legacy stars[5] to stars[9] padded with
   *  zeros AND persists the migrated shape so subsequent loads are
   *  idempotent. This is the canonical "Sprint 2 simulation" before
   *  we actually ship king-6..10. */
  it("expands King [3,3,2,1,0] to [3,3,2,1,0,0,0,0,0] when simulated count is 9", async () => {
    localStorage.setItem(
      "chesscito:progress:king",
      JSON.stringify({ piece: "king", exerciseIndex: 4, stars: [3, 3, 2, 1, 0] }),
    );

    vi.doMock("@/lib/game/exercises", async () => {
      const actual = await vi.importActual<typeof import("@/lib/game/exercises")>(
        "@/lib/game/exercises",
      );
      return {
        ...actual,
        getExerciseCount: vi.fn(() => 9),
      };
    });

    const { renderHook, act } = await import("@testing-library/react");
    const { useExerciseProgress } = await import("@/hooks/use-exercise-progress");

    const { result } = renderHook(() => useExerciseProgress("king"));
    act(() => {});

    expect(result.current.progress.stars).toEqual([3, 3, 2, 1, 0, 0, 0, 0, 0]);
    expect(result.current.progress.stars.length).toBe(9);
    expect(result.current.progress.exerciseIndex).toBe(4);
    expect(result.current.totalStars).toBe(9); // sum unchanged

    // Migrated shape persisted back so subsequent loads are idempotent.
    const persisted = JSON.parse(
      localStorage.getItem("chesscito:progress:king") ?? "null",
    );
    expect(persisted.stars).toEqual([3, 3, 2, 1, 0, 0, 0, 0, 0]);
  });

  it("warns AND truncates when simulated count shrinks below persisted length", async () => {
    localStorage.setItem(
      "chesscito:progress:rook",
      JSON.stringify({
        piece: "rook",
        exerciseIndex: 4,
        stars: [3, 3, 3, 3, 3, 2, 1],
      }),
    );

    vi.doMock("@/lib/game/exercises", async () => {
      const actual = await vi.importActual<typeof import("@/lib/game/exercises")>(
        "@/lib/game/exercises",
      );
      return {
        ...actual,
        getExerciseCount: vi.fn(() => 5),
      };
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { renderHook, act } = await import("@testing-library/react");
    const { useExerciseProgress } = await import("@/hooks/use-exercise-progress");

    const { result } = renderHook(() => useExerciseProgress("rook"));
    act(() => {});

    expect(result.current.progress.stars).toEqual([3, 3, 3, 3, 3]);
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0]![0]).toContain("exceeds current pool");

    warnSpy.mockRestore();
  });
});
