/**
 * useExerciseProgress — id-keyed persistence + legacy migration.
 *
 * Task 1 of the Exercises-Builder cluster (2026-06-16). The persistence
 * layer now stores `stars` as an id-map (`Record<exerciseId, number>`)
 * and the active exercise as `currentId` (an exerciseId, not a pool
 * index) so the catalog can be reordered/edited without remapping live
 * progress.
 *
 * Coverage:
 *  - Legacy positional `{ exerciseIndex, stars: number[] }` migrates
 *    losslessly to the id-map shape (stars by id, currentId from index),
 *    and the migrated shape is written back for idempotent reloads.
 *  - Star write/read happens by id (via completeExercise).
 *  - Already-id-map data loads as-is; unknown ids are dropped; out-of-
 *    range star values are clamped.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));
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

import { act, renderHook } from "@testing-library/react";
import { useExerciseProgress } from "@/hooks/use-exercise-progress";
import { EXERCISES } from "@/lib/game/exercises";

const rookId = (i: number) => EXERCISES.rook[i].id;
const KEY = "chesscito:progress:rook";

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("legacy positional → id-map migration", () => {
  it("maps a legacy stars[] to stars-by-id and currentId from exerciseIndex", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        piece: "rook",
        exerciseIndex: 2,
        stars: [3, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      }),
    );

    const { result } = renderHook(() => useExerciseProgress("rook"));
    await act(async () => {});

    expect(result.current.progress.stars[rookId(0)]).toBe(3);
    expect(result.current.progress.stars[rookId(1)]).toBe(1);
    expect(result.current.progress.stars[rookId(2)] ?? 0).toBe(0);
    expect(result.current.progress.currentId).toBe(rookId(2));
    // Mastery sum unchanged by the migration: 3 + 1 = 4.
    expect(result.current.totalStars).toBe(4);
  });

  it("persists the migrated id-map shape so subsequent loads are idempotent", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        piece: "rook",
        exerciseIndex: 1,
        stars: [3, 2, 0, 0, 0, 0, 0, 0, 0, 0],
      }),
    );

    renderHook(() => useExerciseProgress("rook"));
    await act(async () => {});

    const persisted = JSON.parse(localStorage.getItem(KEY) ?? "null");
    expect(Array.isArray(persisted.stars)).toBe(false);
    expect(persisted.stars[rookId(0)]).toBe(3);
    expect(persisted.stars[rookId(1)]).toBe(2);
    expect(persisted.currentId).toBe(rookId(1));
    expect("exerciseIndex" in persisted).toBe(false);
  });

  it("derives currentId from the UNCHANGED catalog order at the persisted index", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        piece: "rook",
        exerciseIndex: 4,
        stars: [3, 3, 3, 3, 0, 0, 0, 0, 0, 0],
      }),
    );

    const { result } = renderHook(() => useExerciseProgress("rook"));
    await act(async () => {});

    expect(result.current.progress.currentId).toBe(rookId(4));
    expect(result.current.currentExercise.id).toBe(rookId(4));
  });
});

describe("id-map write/read by id", () => {
  it("records stars under the active exerciseId via completeExercise", async () => {
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await act(async () => {});

    act(() => {
      result.current.completeExercise(1); // rook-1 optimal 1 → 3★
    });

    expect(result.current.progress.stars[rookId(0)]).toBe(3);
    const persisted = JSON.parse(localStorage.getItem(KEY) ?? "null");
    expect(persisted.stars[rookId(0)]).toBe(3);
  });
});

describe("already-id-map load", () => {
  it("loads an existing id-map verbatim (no array migration)", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        piece: "rook",
        currentId: rookId(1),
        stars: { [rookId(0)]: 3, [rookId(1)]: 2 },
      }),
    );

    const { result } = renderHook(() => useExerciseProgress("rook"));
    await act(async () => {});

    expect(result.current.progress.stars[rookId(0)]).toBe(3);
    expect(result.current.progress.stars[rookId(1)]).toBe(2);
    expect(result.current.progress.currentId).toBe(rookId(1));
    expect(result.current.totalStars).toBe(5);
  });

  it("drops unknown ids and clamps out-of-range star values", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        piece: "rook",
        currentId: rookId(0),
        stars: {
          [rookId(0)]: 9, // clamp → 3
          [rookId(1)]: -2, // clamp → 0
          "ghost-exercise-id": 3, // unknown → dropped
        },
      }),
    );

    const { result } = renderHook(() => useExerciseProgress("rook"));
    await act(async () => {});

    expect(result.current.progress.stars[rookId(0)]).toBe(3);
    expect(result.current.progress.stars[rookId(1)] ?? 0).toBe(0);
    expect("ghost-exercise-id" in result.current.progress.stars).toBe(false);
    expect(result.current.totalStars).toBe(3);
  });

  it("nulls currentId when the persisted id is not in the current catalog", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        piece: "rook",
        currentId: "ghost-exercise-id",
        stars: { [rookId(0)]: 3 },
      }),
    );

    const { result } = renderHook(() => useExerciseProgress("rook"));
    await act(async () => {});

    expect(result.current.progress.currentId).toBeNull();
    // currentExercise falls back to the first pool exercise.
    expect(result.current.currentExercise.id).toBe(rookId(0));
  });
});
