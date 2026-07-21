/**
 * Hook-level integration tests for the Peones earn wireup inside
 * `useExerciseProgress.completeExercise`.
 *
 * Economy V1 (2026-07-21): training pays +1 Peón per MILESTONE of five
 * NEW exercises, never per exercise. The count is read from the durable
 * cross-piece progress in localStorage, so what these tests seed is the
 * real source of truth the hook consults.
 *
 * Strategy: mock `submitExerciseMilestoneEarn` so the real fetch never
 * fires; assert the helper IS called (or NOT called) with the right
 * before/after counts. Mock wagmi's useAccount so the test can flip
 * between guest and connected per-test.
 *
 * What's verified here:
 *   - Exercises 1–4 → helper NOT called (no milestone crossed).
 *   - The 5th → helper called with completedBefore=4, completedAfter=5.
 *   - The 10th → called again, one tier higher.
 *   - Replay / star improvement → NOT called (the unique count is flat).
 *   - Guest or address-less → NEVER called.
 *   - Endpoint error → progress + persistence untouched.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const trackMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/telemetry", () => ({
  track: trackMock,
}));

const submitMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/peones/training-earn", () => ({
  submitExerciseMilestoneEarn: submitMock,
  EXERCISE_MILESTONE_EARN_AMOUNT: 1,
}));

const useAccountMock = vi.hoisted(() => vi.fn());
vi.mock("wagmi", () => ({
  useAccount: useAccountMock,
}));

import { act, renderHook } from "@testing-library/react";
import { useExerciseProgress } from "@/hooks/use-exercise-progress";
import { EXERCISES } from "@/lib/game/exercises";
import { seedProgress } from "./helpers/seed-progress";

const W = "0xabcdef0123456789abcdef0123456789abcdef01";
const ROOK_1 = EXERCISES.rook[0].id;

function setConnected(address = W): void {
  useAccountMock.mockReturnValue({ isConnected: true, address });
}

function setGuest(): void {
  useAccountMock.mockReturnValue({ isConnected: false, address: undefined });
}

/**
 * Seeds `done` already-completed rook exercises, skipping slot 0 so
 * `completeExercise` still lands on a FRESH rook-1 (the pool's first
 * entry is what the hook falls back to). The seeded slots are what the
 * cross-piece counter reads back.
 */
function seedCompletedExercises(done: number): void {
  const stars = [0];
  for (let i = 0; i < done; i++) stars.push(3);
  localStorage.setItem("chesscito:progress:rook", seedProgress("rook", 0, stars));
}

beforeEach(() => {
  localStorage.clear();
  submitMock.mockReset();
  submitMock.mockResolvedValue({
    kind: "success",
    credited: 1,
    newBalance: 1,
    dailyEarnedCapped: 1,
    dailyCap: 3,
    attestationHash: "sha256:aaa",
    ledgerId: 1,
    duplicate: false,
    tier: 1,
  });
  useAccountMock.mockReset();
  trackMock.mockClear();
  setGuest();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("useExerciseProgress.completeExercise — milestone earn wireup", () => {
  it("does NOT submit on the very first exercise ever completed", async () => {
    setConnected();
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(1); // rook-1 optimal 1 → 3★, fresh
    });

    expect(submitMock).not.toHaveBeenCalled();
  });

  it.each([1, 2, 3])(
    "does NOT submit when the completion lands mid-group (%i already done)",
    async (done) => {
      seedCompletedExercises(done);
      setConnected();
      const { result } = renderHook(() => useExerciseProgress("rook"));
      await Promise.resolve();

      act(() => {
        result.current.completeExercise(1);
      });

      expect(submitMock).not.toHaveBeenCalled();
    },
  );

  it("submits on the 5th with the before/after counts the helper needs", async () => {
    seedCompletedExercises(4);
    setConnected();
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(1);
    });

    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(submitMock).toHaveBeenCalledWith({
      wallet: W,
      completedBefore: 4,
      completedAfter: 5,
    });
  });

  it("submits again on the 10th", async () => {
    seedCompletedExercises(9);
    setConnected();
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(1);
    });

    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(submitMock).toHaveBeenCalledWith({
      wallet: W,
      completedBefore: 9,
      completedAfter: 10,
    });
  });

  it("reads the count ACROSS pieces, not per piece", async () => {
    // Four bishop exercises + the rook one being completed = the 5th.
    // A per-piece counter would see 1 and pay nothing; the milestone
    // belongs to the training path as a whole.
    localStorage.setItem(
      "chesscito:progress:bishop",
      seedProgress("bishop", 0, [3, 3, 3, 3]),
    );
    setConnected();
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(1);
    });

    expect(submitMock).toHaveBeenCalledWith({
      wallet: W,
      completedBefore: 4,
      completedAfter: 5,
    });
  });

  it("does NOT submit on a replay without improvement", async () => {
    seedCompletedExercises(4);
    localStorage.setItem(
      "chesscito:progress:rook",
      seedProgress("rook", 0, [3, 3, 3, 3, 3]),
    );
    setConnected();
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(1); // 3★ again on an already-3★ slot
    });

    expect(submitMock).not.toHaveBeenCalled();
  });

  it("does NOT submit when a replay merely IMPROVES the stars", async () => {
    // The economic rule this pins: stars are mastery, Peones are
    // currency. Going 1★ → 3★ on an exercise already counted leaves
    // the unique-completion count flat, so it must pay nothing — even
    // when the player is sitting exactly on a milestone boundary.
    localStorage.setItem(
      "chesscito:progress:rook",
      seedProgress("rook", 0, [1, 3, 3, 3, 3]),
    );
    setConnected();
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(1); // 1★ → 3★ on rook-1
    });

    expect(submitMock).not.toHaveBeenCalled();
  });

  it("does NOT submit when the new attempt is worse than the best", async () => {
    localStorage.setItem(
      "chesscito:progress:rook",
      seedProgress("rook", 0, [3, 3, 3, 3, 3]),
    );
    setConnected();
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(3); // rook-1 optimal 1, 3 moves = 1★
    });

    expect(submitMock).not.toHaveBeenCalled();
  });

  it("never submits when the user is a guest (isConnected=false)", async () => {
    seedCompletedExercises(4);
    setGuest();
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(1);
    });

    expect(submitMock).not.toHaveBeenCalled();
  });

  it("never submits when isConnected=true but address is undefined", async () => {
    seedCompletedExercises(4);
    useAccountMock.mockReturnValue({ isConnected: true, address: undefined });
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(1);
    });

    expect(submitMock).not.toHaveBeenCalled();
  });

  it("local progress still persists when the earn helper rejects", async () => {
    submitMock.mockRejectedValueOnce(new Error("network fault"));
    seedCompletedExercises(4);
    setConnected();
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(1);
    });
    // Allow any microtask the rejected promise queues to run before
    // we read state — proves the rejection doesn't tear down the
    // setProgress update.
    await Promise.resolve();
    await Promise.resolve();

    expect(result.current.progress.stars[ROOK_1]).toBe(3);
    const persisted = JSON.parse(
      localStorage.getItem("chesscito:progress:rook") ?? "null",
    );
    expect(persisted.stars[ROOK_1]).toBe(3);
  });

  it("treats a duplicate:true response as success — no error surface", async () => {
    submitMock.mockResolvedValueOnce({
      kind: "success",
      credited: 1,
      newBalance: 1,
      dailyEarnedCapped: 1,
      dailyCap: 3,
      attestationHash: "sha256:aaa",
      ledgerId: 99,
      duplicate: true,
      tier: 1,
    });
    seedCompletedExercises(4);
    setConnected();
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(1);
    });

    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(result.current.progress.stars[ROOK_1]).toBe(3);
  });

  it("emits peones_earned after a successful credited>0 milestone earn", async () => {
    submitMock.mockResolvedValueOnce({
      kind: "success",
      credited: 1,
      newBalance: 7,
      dailyEarnedCapped: 1,
      dailyCap: 3,
      attestationHash: "sha256:abc",
      ledgerId: 12,
      duplicate: false,
      tier: 1,
    });
    seedCompletedExercises(4);
    setConnected();
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(1);
    });
    // Let the .then() chain land.
    await Promise.resolve();
    await Promise.resolve();

    const earnedCalls = trackMock.mock.calls.filter(
      (c) => c[0] === "peones_earned",
    );
    expect(earnedCalls).toHaveLength(1);
    expect(earnedCalls[0]![1]).toMatchObject({
      source: "exercise_completion",
      sourceId: "milestone:1",
      requested: 1,
      credited: 1,
      capReached: false,
      newBalance: 7,
      attestationHash: "sha256:abc",
      duplicate: false,
    });
  });

  it("does NOT emit peones_earned when earn returns kind:error", async () => {
    submitMock.mockResolvedValueOnce({ kind: "error" });
    seedCompletedExercises(4);
    setConnected();
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(1);
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(
      trackMock.mock.calls.filter((c) => c[0] === "peones_earned"),
    ).toHaveLength(0);
  });
});
