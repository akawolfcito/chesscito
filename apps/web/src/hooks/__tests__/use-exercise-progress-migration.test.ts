/**
 * Legacy positional progress — retired, on purpose (founder, 2026-07-14).
 *
 * Until now a legacy record (`{ exerciseIndex, stars: number[] }`) was migrated
 * "losslessly by CURRENT catalog order": `stars[i]` was credited to `pool[i].id`.
 * That was only ever safe while the catalog kept the order the array was written
 * against. **A6 reordered the entire rook curriculum**, so it is not safe any
 * more — and nothing in the record says which pool it was written against, so the
 * app cannot even tell whether it is safe.
 *
 * The array is therefore AMBIGUOUS, and it is decoded no further:
 *
 *  - modern id-keyed progress  → preserved in full;
 *  - new ids                   → inherit nothing;
 *  - retired ids               → contribute nothing;
 *  - legacy `stars[]`          → NOT credited;
 *  - legacy `exerciseIndex`    → may ORIENT navigation, never certify learning.
 *
 * The reasoning, because this looks like a regression until you see it: crediting
 * the array by today's order would tell a player they have mastered an exercise
 * they never solved, and mastery unlocks tiers — so the false claim compounds
 * into content they have not earned. A player can re-earn stars in minutes. They
 * cannot un-learn a lie the app told them about what they know.
 *
 * Losing ambiguous progress beats certifying the wrong learning.
 *
 * (The destructive write-back this file used to assert — "the migrated shape is
 * persisted so subsequent loads are idempotent" — is gone too. It is what turned
 * a transient race into permanent data loss; see use-exercise-progress-resume.)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Sprint 3 commit F — the hook imports wagmi + the training earn helper.
// These tests don't exercise either, but the mocks keep the renderHook calls
// from blowing up on missing providers.
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
const key = (piece: string) => `chesscito:progress:${piece}`;

describe("legacy positional progress is not credited", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("credits no stars from a legacy King array, however complete it looks", async () => {
    localStorage.setItem(
      key("king"),
      JSON.stringify({ piece: "king", exerciseIndex: 4, stars: [3, 3, 2, 1, 0] }),
    );

    const { renderHook, act } = await import("@testing-library/react");
    const { useExerciseProgress } = await import("@/hooks/use-exercise-progress");

    const { result } = renderHook(() => useExerciseProgress("king"));
    act(() => {});

    // Nine stars' worth of claims, none of them attributable. All dropped.
    expect(Object.keys(result.current.progress.stars)).toHaveLength(0);
    expect(result.current.totalStars).toBe(0);
  });

  it("still uses exerciseIndex to decide where to resume", async () => {
    // Orientation is a guess the player can correct with one tap. It asserts
    // nothing about what they learned, so it costs nothing if it is wrong.
    localStorage.setItem(
      key("king"),
      JSON.stringify({ piece: "king", exerciseIndex: 4, stars: [3, 3, 2, 1, 0] }),
    );

    const { renderHook, act } = await import("@testing-library/react");
    const { useExerciseProgress } = await import("@/hooks/use-exercise-progress");

    const { result } = renderHook(() => useExerciseProgress("king"));
    act(() => {});

    expect(result.current.currentExercise.id).toBe(id("king", 4));
  });

  it("never rewrites the legacy record — load stays read-only", async () => {
    // The write-back is what made the old behaviour dangerous rather than merely
    // wrong: a load against a half-loaded pool did not mis-read the progress, it
    // overwrote it. Nothing is persisted here, so nothing can be destroyed.
    const legacy = { piece: "pawn", exerciseIndex: 2, stars: [3, 3, 1] };
    localStorage.setItem(key("pawn"), JSON.stringify(legacy));

    const { renderHook, act } = await import("@testing-library/react");
    const { useExerciseProgress } = await import("@/hooks/use-exercise-progress");

    renderHook(() => useExerciseProgress("pawn"));
    act(() => {});

    expect(JSON.parse(localStorage.getItem(key("pawn")) ?? "null")).toEqual(legacy);
  });

  it("gives a legacy Rook player a clean slate, not a wrong one", async () => {
    // Rook is the piece A6 reordered, so it is the piece where crediting by
    // today's order would be provably wrong. It gets zero, and starts over.
    localStorage.setItem(
      key("rook"),
      JSON.stringify({ piece: "rook", exerciseIndex: 3, stars: [3, 3, 3, 2, 0] }),
    );

    const { renderHook, act } = await import("@testing-library/react");
    const { useExerciseProgress } = await import("@/hooks/use-exercise-progress");

    const { result } = renderHook(() => useExerciseProgress("rook"));
    act(() => {});

    expect(result.current.totalStars).toBe(0);
    expect(result.current.progress.stars[id("rook", 0)] ?? 0).toBe(0);
  });
});

describe("useExerciseProgress — id-map load", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("clamps values, and keeps ids absent from the pool out of the mastery total", async () => {
    localStorage.setItem(
      "chesscito:progress:rook",
      JSON.stringify({
        piece: "rook",
        currentId: id("rook", 0),
        stars: {
          [id("rook", 0)]: 3,
          [id("rook", 1)]: 7, // clamp → 3
          "rook-removed-legacy": 3, // unknown → scores nothing
        },
      }),
    );

    const { renderHook, act } = await import("@testing-library/react");
    const { useExerciseProgress } = await import("@/hooks/use-exercise-progress");

    const { result } = renderHook(() => useExerciseProgress("rook"));
    act(() => {});

    expect(result.current.progress.stars[id("rook", 0)]).toBe(3);
    expect(result.current.progress.stars[id("rook", 1)]).toBe(3);
    // The removed id's stars stay in the record and are scored against the pool,
    // so they contribute nothing. Deleting them on load was the destructive half
    // of the resume bug: a pool that had not finished loading looked exactly like
    // a pool that had removed the exercise, and the deletion was permanent.
    // Surviving stars only: 3 + 3 = 6.
    expect(result.current.totalStars).toBe(6);
  });
});
