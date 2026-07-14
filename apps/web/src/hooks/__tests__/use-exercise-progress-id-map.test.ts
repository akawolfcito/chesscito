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
 *  - Star write/read happens by id (via completeExercise).
 *  - Already-id-map data loads as-is; out-of-range star values are clamped;
 *    ids the pool does not know score nothing (but are not deleted — see
 *    use-exercise-progress-resume.test.tsx for why that distinction matters).
 *
 * These suites seed through `seedProgress`, which writes the id-keyed record.
 * They used to seed the legacy positional array because it was terser; that array
 * no longer credits stars (it is ambiguous after the A6 reorder —
 * use-exercise-progress-migration.test.ts), so seeding with it would hand every
 * test below a zero-star player and quietly stop testing anything.
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
import { seedProgress } from "./helpers/seed-progress";

const rookId = (i: number) => EXERCISES.rook[i].id;
const KEY = "chesscito:progress:rook";

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("id-keyed load — resume position and stars", () => {
  it("maps a legacy stars[] to stars-by-id and currentId from exerciseIndex", async () => {
    localStorage.setItem(
      KEY,
      seedProgress("rook", 2, [3, 1, 0, 0, 0, 0, 0, 0, 0, 0]),
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
      seedProgress("rook", 1, [3, 2, 0, 0, 0, 0, 0, 0, 0, 0]),
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
      seedProgress("rook", 4, [3, 3, 3, 3, 0, 0, 0, 0, 0, 0]),
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

  it("clamps star values, and never lets an unknown id count toward mastery", async () => {
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
    // The ghost's stars are KEPT in the record and simply ignored by every reader
    // that matters. Deleting them on load meant a pool that had not finished
    // loading could erase a real exercise's stars for good; scoring them against
    // the pool cannot. `totalStars` is the assertion with teeth here.
    expect(result.current.totalStars).toBe(3);
  });

  it("lands the player on the first exercise when the persisted id names nothing", async () => {
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

    // The id is CARRIED, not nulled. Nulling it here was the bug: a pool that has
    // not finished loading gives the same answer as a retired exercise, and the
    // wipe was permanent. The guarantee the player actually needs is about where
    // they land, and that is asserted below — the fallback lives in the render,
    // where a stale id costs nothing.
    expect(result.current.progress.currentId).toBe("ghost-exercise-id");
    // currentExercise falls back to the first pool exercise.
    expect(result.current.currentExercise.id).toBe(rookId(0));
  });
});
