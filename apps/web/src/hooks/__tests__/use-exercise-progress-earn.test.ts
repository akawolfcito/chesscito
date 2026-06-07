/**
 * Hook-level integration tests for the Sprint 3 commit F Peones
 * earn wireup inside `useExerciseProgress.completeExercise`.
 *
 * Strategy: mock `submitTrainingExerciseEarn` so the real fetch
 * never fires; assert the helper IS called (or NOT called) under
 * the right conditions. Mock wagmi's useAccount so the test can
 * flip between guest and connected per-test.
 *
 * What's verified here:
 *   - Connected + delta > 0 → helper called with canonical args.
 *   - Connected + replay no-improvement → helper NOT called.
 *   - Connected + worse score than current best → helper NOT called.
 *   - Guest (isConnected=false) → helper NEVER called.
 *   - Connected without address → helper NOT called.
 *   - Endpoint error → progress + telemetry untouched (existing
 *     telemetry tests already cover the local persistence; this
 *     file just proves the helper rejection doesn't propagate).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

const submitMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/peones/training-earn", () => ({
  submitTrainingExerciseEarn: submitMock,
}));

const useAccountMock = vi.hoisted(() => vi.fn());
vi.mock("wagmi", () => ({
  useAccount: useAccountMock,
}));

import { act, renderHook } from "@testing-library/react";
import { useExerciseProgress } from "@/hooks/use-exercise-progress";

const W = "0xabcdef0123456789abcdef0123456789abcdef01";

function setConnected(address = W): void {
  useAccountMock.mockReturnValue({ isConnected: true, address });
}

function setGuest(): void {
  useAccountMock.mockReturnValue({ isConnected: false, address: undefined });
}

beforeEach(() => {
  localStorage.clear();
  submitMock.mockReset();
  submitMock.mockResolvedValue({
    kind: "success",
    credited: 3,
    attestationHash: "sha256:aaa",
    ledgerId: 1,
    duplicate: false,
  });
  useAccountMock.mockReset();
  setGuest();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("useExerciseProgress.completeExercise — Peones earn wireup", () => {
  it("calls submitTrainingExerciseEarn with canonical args on connected fresh 3★", async () => {
    setConnected();
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(1); // rook-1 optimal 1 → 3★, before=0 → delta 3
    });

    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(submitMock).toHaveBeenCalledWith({
      wallet: W,
      piece: "rook",
      exerciseId: "rook-1",
      bestStarsBefore: 0,
      bestStarsAfter: 3,
    });
  });

  it("calls submit with delta of bestStars when replay improves the score", async () => {
    localStorage.setItem(
      "chesscito:progress:rook",
      JSON.stringify({
        piece: "rook",
        exerciseIndex: 0,
        stars: [1, 0, 0, 0, 0],
      }),
    );
    setConnected();
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(1); // 3★, was 1 → bestStars 1→3
    });

    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(submitMock).toHaveBeenCalledWith({
      wallet: W,
      piece: "rook",
      exerciseId: "rook-1",
      bestStarsBefore: 1,
      bestStarsAfter: 3,
    });
  });

  it("does NOT call submit on replay without improvement (same best)", async () => {
    localStorage.setItem(
      "chesscito:progress:rook",
      JSON.stringify({
        piece: "rook",
        exerciseIndex: 0,
        stars: [3, 0, 0, 0, 0],
      }),
    );
    setConnected();
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(1); // 3★, was 3 → bestStars unchanged → delta 0
    });

    expect(submitMock).not.toHaveBeenCalled();
  });

  it("does NOT call submit when the new attempt is worse than the best", async () => {
    localStorage.setItem(
      "chesscito:progress:rook",
      JSON.stringify({
        piece: "rook",
        exerciseIndex: 0,
        stars: [3, 0, 0, 0, 0],
      }),
    );
    setConnected();
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(3); // rook-1 optimal 1, 3 moves = 1★, best stays 3
    });

    expect(submitMock).not.toHaveBeenCalled();
  });

  it("never calls submit when the user is a guest (isConnected=false)", async () => {
    setGuest();
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(1); // 3★ fresh
    });

    expect(submitMock).not.toHaveBeenCalled();
  });

  it("never calls submit when isConnected=true but address is undefined", async () => {
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

    expect(result.current.progress.stars[0]).toBe(3);
    expect(result.current.totalStars).toBe(3);
    const persisted = JSON.parse(
      localStorage.getItem("chesscito:progress:rook") ?? "null",
    );
    expect(persisted.stars[0]).toBe(3);
  });

  it("treats a duplicate:true response as success — no error surface", async () => {
    submitMock.mockResolvedValueOnce({
      kind: "success",
      credited: 3,
      attestationHash: "sha256:aaa",
      ledgerId: 99,
      duplicate: true,
    });
    setConnected();
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(1);
    });

    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(result.current.progress.stars[0]).toBe(3);
  });
});
