/**
 * useExerciseProgress — attemptSeq plumbing.
 *
 * Sprint 5 commit B (2026-06-08). Passive in-memory counter used by
 * the Retry surface (commits C/D) and consumed by PeonesHintButton's
 * idempotency key (commit E). This file pins the counter's contract:
 *
 *   - starts at 1 on mount
 *   - `incrementAttemptSeq()` bumps by 1
 *   - `resetAttemptSeq()` returns to 1
 *   - `currentExercise.id` transitions (piece change, slot advance,
 *     direct navigation) auto-reset to 1
 *   - callbacks are referentially stable across re-renders
 *
 * Persistence: NONE — the counter is session-scoped. Reload, route
 * change, hook unmount all reset to 1 by virtue of fresh hook state.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

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

import { useExerciseProgress } from "@/hooks/use-exercise-progress";
import { seedProgress } from "./helpers/seed-progress";

describe("useExerciseProgress — attemptSeq (Sprint 5 commit B)", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("starts at 1 on mount", async () => {
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();
    expect(result.current.attemptSeq).toBe(1);
  });

  it("incrementAttemptSeq bumps by exactly 1 per call", async () => {
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();
    expect(result.current.attemptSeq).toBe(1);

    act(() => {
      result.current.incrementAttemptSeq();
    });
    expect(result.current.attemptSeq).toBe(2);

    act(() => {
      result.current.incrementAttemptSeq();
    });
    expect(result.current.attemptSeq).toBe(3);

    act(() => {
      result.current.incrementAttemptSeq();
    });
    expect(result.current.attemptSeq).toBe(4);
  });

  it("resetAttemptSeq returns the counter to 1 regardless of current value", async () => {
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.incrementAttemptSeq();
      result.current.incrementAttemptSeq();
      result.current.incrementAttemptSeq();
    });
    expect(result.current.attemptSeq).toBe(4);

    act(() => {
      result.current.resetAttemptSeq();
    });
    expect(result.current.attemptSeq).toBe(1);
  });

  it("resets to 1 when the piece prop changes (currentExercise.id transition)", async () => {
    const { result, rerender } = renderHook(
      ({ piece }: { piece: "rook" | "bishop" }) => useExerciseProgress(piece),
      { initialProps: { piece: "rook" } },
    );
    await Promise.resolve();

    act(() => {
      result.current.incrementAttemptSeq();
      result.current.incrementAttemptSeq();
    });
    expect(result.current.attemptSeq).toBe(3);

    // Swap piece — different exercise pool, fresh currentExercise.id.
    rerender({ piece: "bishop" });
    await Promise.resolve();
    expect(result.current.attemptSeq).toBe(1);
  });

  it("resets to 1 when navigating slots within the same piece (advanceExercise)", async () => {
    // Seed localStorage so the rook has stars on slot 0 → advanceExercise
    // is a no-op cap if we're already at the last slot. Start at slot 0
    // and advance once.
    localStorage.setItem(
      "chesscito:progress:rook",
      seedProgress("rook", 0, [3, 0, 0, 0, 0]),
    );
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();
    expect(result.current.currentExercise.id).toBe("rook-1");
    expect(result.current.attemptSeq).toBe(1);

    act(() => {
      result.current.incrementAttemptSeq();
      result.current.incrementAttemptSeq();
    });
    expect(result.current.attemptSeq).toBe(3);

    act(() => {
      result.current.advanceExercise();
    });
    await Promise.resolve();
    expect(result.current.currentExercise.id).toBe("rook-2");
    expect(result.current.attemptSeq).toBe(1);
  });

  it("does NOT bounce attemptSeq on unrelated re-renders (no currentExercise.id change)", async () => {
    const { result, rerender } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.incrementAttemptSeq();
      result.current.incrementAttemptSeq();
    });
    expect(result.current.attemptSeq).toBe(3);

    // Re-render the same piece — the started-emit dedup and the
    // counter-reset dedup share no state, but both must stay quiet.
    rerender();
    rerender();
    rerender();
    expect(result.current.attemptSeq).toBe(3);
  });

  it("incrementAttemptSeq and resetAttemptSeq callbacks are referentially stable", () => {
    const { result, rerender } = renderHook(() => useExerciseProgress("rook"));
    const initialIncrement = result.current.incrementAttemptSeq;
    const initialReset = result.current.resetAttemptSeq;

    rerender();
    rerender();

    expect(result.current.incrementAttemptSeq).toBe(initialIncrement);
    expect(result.current.resetAttemptSeq).toBe(initialReset);
  });
});
