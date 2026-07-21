/**
 * Telemetry coverage for useExerciseProgress.
 *
 * Sprint 1 commit 6 of Training Economy Alpha (2026-06-05). Validates
 * that the 5 events listed in the decisions doc §6.1 fire under the
 * conditions promised AND not in the conditions excluded:
 *
 *  1. `training_exercise_started`               — once per piece+slot
 *                                                  combo after hydration,
 *                                                  no re-fire on re-render.
 *  2. `training_exercise_completed`             — every completeExercise
 *                                                  call, including replay.
 *  3. `training_stars_earned`                   — only when delta > 0.
 *  4. `training_piece_badge_threshold_reached`  — only on first 10★ cross.
 *  5. `training_senda_completed`                — only when every slot has
 *                                                  ≥1★ and at least one
 *                                                  was 0 before this call.
 *                                                  Uses getExerciseCount,
 *                                                  not hardcoded 5.
 *
 * `track` is mocked so the assertions can inspect call shape without
 * touching the network. The mock is hoisted by vitest above the imports.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

// Sprint 3 commit F — Peones earn is fire-and-forget inside the
// hook. These tests focus on training_* events, so the earn helper
// is mocked to a no-op success. wagmi mock defaults to guest so
// the earn path is skipped entirely in this file.
vi.mock("@/lib/peones/training-earn", () => ({
  EXERCISE_MILESTONE_EARN_AMOUNT: 1,
  submitExerciseMilestoneEarn: vi.fn().mockResolvedValue({
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
import { track } from "@/lib/telemetry";
import { useExerciseProgress } from "@/hooks/use-exercise-progress";
import { seedProgress } from "./helpers/seed-progress";

const mockTrack = vi.mocked(track);

function callsOf(name: string) {
  return mockTrack.mock.calls.filter((c) => c[0] === name);
}

describe("useExerciseProgress — telemetry", () => {
  beforeEach(() => {
    localStorage.clear();
    mockTrack.mockClear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("training_exercise_started", () => {
    it("fires once after hydration with the resolved current exercise", async () => {
      const { rerender } = renderHook(() => useExerciseProgress("rook"));
      // Allow the post-mount useEffect (loadProgress + setHydrated) to run.
      await Promise.resolve();

      const started = callsOf("training_exercise_started");
      expect(started).toHaveLength(1);
      expect(started[0]![1]).toMatchObject({
        piece: "rook",
        exerciseId: "rook-1",
        slotIndex: 0,
        isReplay: false,
      });

      // Re-rendering the same hook does NOT re-emit — dedup via ref.
      rerender();
      rerender();
      expect(callsOf("training_exercise_started")).toHaveLength(1);
    });

    it("emits the HYDRATED exerciseId when localStorage points to a non-default slot (no SSR-default fire)", async () => {
      // User had previously navigated to rook-4 (slot index 3) with stars.
      // The SSR-default render would show rook-1 (slot 0); after hydration the
      // hook lands on whatever sits at slot 3. NOTE this is the LEGACY positional
      // shape, which migrates by catalog POSITION — so the A6 reorder moves it:
      // slot 3 used to be rook-4 and is now rook-no-diagonal-1. Id-keyed progress
      // (everything written since 2026-06-16) is immune; only un-migrated legacy
      // arrays shift, and they shift by design — position is all they carry.
      localStorage.setItem(
        "chesscito:progress:rook",
        seedProgress("rook", 3, [3, 3, 3, 0, 0]),
      );

      renderHook(() => useExerciseProgress("rook"));
      await Promise.resolve();

      const started = callsOf("training_exercise_started");
      expect(started).toHaveLength(1);
      expect(started[0]![1]).toMatchObject({
        piece: "rook",
        exerciseId: "rook-no-diagonal-1",
        slotIndex: 3,
      });
    });
  });

  describe("training_exercise_completed", () => {
    it("fires every call to completeExercise with full payload", async () => {
      const { result } = renderHook(() => useExerciseProgress("rook"));
      await Promise.resolve();

      act(() => {
        result.current.completeExercise(1); // rook-1 optimal 1 → 3★
      });

      const completed = callsOf("training_exercise_completed");
      expect(completed).toHaveLength(1);
      expect(completed[0]![1]).toMatchObject({
        piece: "rook",
        exerciseId: "rook-1",
        slotIndex: 0,
        movesUsed: 1,
        optimalMoves: 1,
        starsEarned: 3,
        isReplay: false,
        bestStarsBefore: 0,
        bestStarsAfter: 3,
      });
    });

    it("marks isReplay=true and reports unchanged bestStars on no-improvement replay", async () => {
      localStorage.setItem(
        "chesscito:progress:rook",
        seedProgress("rook", 0, [3, 0, 0, 0, 0]),
      );

      const { result } = renderHook(() => useExerciseProgress("rook"));
      await Promise.resolve();

      act(() => {
        result.current.completeExercise(1); // same 3★ — no improvement
      });

      const completed = callsOf("training_exercise_completed");
      expect(completed).toHaveLength(1);
      expect(completed[0]![1]).toMatchObject({
        isReplay: true,
        bestStarsBefore: 3,
        bestStarsAfter: 3,
      });
    });
  });

  describe("training_stars_earned", () => {
    it("fires only when delta > 0", async () => {
      const { result } = renderHook(() => useExerciseProgress("rook"));
      await Promise.resolve();

      act(() => {
        result.current.completeExercise(1); // fresh 3★ → delta 3
      });

      const earned = callsOf("training_stars_earned");
      expect(earned).toHaveLength(1);
      expect(earned[0]![1]).toMatchObject({
        piece: "rook",
        exerciseId: "rook-1",
        delta: 3,
        newPieceTotal: 3,
      });
    });

    it("does NOT fire on replay without improvement", async () => {
      localStorage.setItem(
        "chesscito:progress:rook",
        seedProgress("rook", 0, [3, 0, 0, 0, 0]),
      );

      const { result } = renderHook(() => useExerciseProgress("rook"));
      await Promise.resolve();

      act(() => {
        result.current.completeExercise(1); // already 3★ — delta 0
      });

      expect(callsOf("training_stars_earned")).toHaveLength(0);
      // But the completed event still fires (every attempt is logged).
      expect(callsOf("training_exercise_completed")).toHaveLength(1);
    });

    it("reports only the positive delta on replay improvement", async () => {
      localStorage.setItem(
        "chesscito:progress:rook",
        seedProgress("rook", 0, [1, 0, 0, 0, 0]),
      );

      const { result } = renderHook(() => useExerciseProgress("rook"));
      await Promise.resolve();

      act(() => {
        result.current.completeExercise(1); // 3★ now, was 1★ — delta 2
      });

      const earned = callsOf("training_stars_earned");
      expect(earned).toHaveLength(1);
      expect(earned[0]![1]).toMatchObject({ delta: 2, newPieceTotal: 3 });
    });
  });

  describe("training_piece_badge_threshold_reached", () => {
    // Gate is COMPLETION now: rook's 10-exercise pool needs 8 (80%).
    it("fires exactly once when crossing the badge completion for the first time", async () => {
      // 7 exercises done; the 8th solve crosses the 80% gate.
      localStorage.setItem(
        "chesscito:progress:rook",
        seedProgress("rook", 7, [3, 3, 3, 3, 3, 3, 3, 0, 0, 0]),
      );

      const { result } = renderHook(() => useExerciseProgress("rook"));
      await Promise.resolve();

      act(() => {
        result.current.completeExercise(1); // rook-8 → 3★ → 8 completed, total 24
      });

      const threshold = callsOf("training_piece_badge_threshold_reached");
      expect(threshold).toHaveLength(1);
      expect(threshold[0]![1]).toMatchObject({
        piece: "rook",
        totalStars: 24,
        exercisesCompleted: 8,
      });
    });

    it("does NOT fire when the user was already at or above the gate", async () => {
      localStorage.setItem(
        "chesscito:progress:rook",
        seedProgress("rook", 8, [3, 3, 3, 3, 3, 3, 3, 3, 0, 0]),
      );

      const { result } = renderHook(() => useExerciseProgress("rook"));
      await Promise.resolve();

      act(() => {
        result.current.completeExercise(1); // 9th completion — already past the gate
      });

      expect(callsOf("training_piece_badge_threshold_reached")).toHaveLength(0);
    });

    it("does NOT fire when the completion doesn't cross the gate", async () => {
      const { result } = renderHook(() => useExerciseProgress("rook"));
      await Promise.resolve();

      act(() => {
        result.current.completeExercise(1); // 1 completed — below the 8 gate
      });

      expect(callsOf("training_piece_badge_threshold_reached")).toHaveLength(0);
    });
  });

  describe("training_senda_completed", () => {
    it("fires for Rook when the last 0★ slot becomes ≥1★ (count = 10)", async () => {
      // Rook pool grew to 10 (5 Easy + 5 Medium) in the Rotation +
      // Labyrinths content wave. Senda closes only when all 10 slots
      // are ≥1★ — uses getExerciseCount, not a hardcoded 5.
      localStorage.setItem(
        "chesscito:progress:rook",
        seedProgress("rook", 9, [3, 3, 2, 1, 1, 1, 1, 1, 1, 0]),
      );

      const { result } = renderHook(() => useExerciseProgress("rook"));
      await Promise.resolve();

      act(() => {
        result.current.completeExercise(4); // rook-10 optimal 4 → 3★
      });

      const senda = callsOf("training_senda_completed");
      expect(senda).toHaveLength(1);
      expect(senda[0]![1]).toMatchObject({
        piece: "rook",
        exerciseCount: 10,
        exercisesCompleted: 10,
      });
    });

    it("uses getExerciseCount, NOT hardcoded 5: King (10 today) does not fire until the last slot closes", async () => {
      // King grew to 10 (king-8 appended) in the Rotation wave. Stars[0..4]
      // all 3, slots 5..9 all 0. User has "done 5/10" but senda is NOT
      // complete — five slots remain at 0.
      localStorage.setItem(
        "chesscito:progress:king",
        seedProgress("king", 5, [3, 3, 3, 3, 3, 0, 0, 0, 0, 0]),
      );

      const { result } = renderHook(() => useExerciseProgress("king"));
      await Promise.resolve();

      act(() => {
        result.current.completeExercise(7); // king-6 optimal 7 → 3★
      });

      // Still slots at 0 — no senda yet.
      expect(callsOf("training_senda_completed")).toHaveLength(0);
    });

    it("fires for King exactly when the 10th slot crosses to ≥1★", async () => {
      // Index 9 is the appended king-8 (optimal 3); the first 9 slots are
      // already mastered. Closing the last slot completes the senda.
      localStorage.setItem(
        "chesscito:progress:king",
        // index 9 = last King slot (king-8, appended at index 9)
        seedProgress("king", 9, [3, 3, 3, 3, 3, 3, 3, 3, 3, 0]),
      );

      const { result } = renderHook(() => useExerciseProgress("king"));
      await Promise.resolve();

      act(() => {
        result.current.completeExercise(3); // king-8 optimal 3 → 3★
      });

      const senda = callsOf("training_senda_completed");
      expect(senda).toHaveLength(1);
      expect(senda[0]![1]).toMatchObject({
        piece: "king",
        exerciseCount: 10,
        exercisesCompleted: 10,
      });
    });

    it("does NOT re-fire on replay when senda was already closed", async () => {
      localStorage.setItem(
        "chesscito:progress:rook",
        seedProgress("rook", 4, [3, 3, 3, 3, 1]),
      );

      const { result } = renderHook(() => useExerciseProgress("rook"));
      await Promise.resolve();

      act(() => {
        result.current.completeExercise(1); // 3★ on last slot — improvement but senda already done
      });

      // training_stars_earned should fire (delta = 2), but senda should not.
      expect(callsOf("training_stars_earned")).toHaveLength(1);
      expect(callsOf("training_senda_completed")).toHaveLength(0);
    });
  });
});
