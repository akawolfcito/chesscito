/**
 * useExerciseProgress — rotation-mode navigation (slice E).
 *
 * Verifies the flag-gated relaxation of goToExercise:
 *  - flag off → legacy linear-senda guard, bit-identical.
 *  - flag on  → navigate to any exercise in today's visible set, even
 *               beyond the next linear index; out-of-set is blocked.
 *  - progress writes always target the real pool index / exerciseId.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/peones/training-earn", () => ({
  submitTrainingExerciseEarn: vi.fn().mockResolvedValue({
    kind: "success",
    credited: 0,
    attestationHash: null,
    ledgerId: null,
    duplicate: false,
  }),
}));

vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));

vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({ isConnected: false, address: undefined })),
}));

import { act, renderHook } from "@testing-library/react";
import { useExerciseProgress } from "@/hooks/use-exercise-progress";

const ROTATION = { enabled: true, dateUtc: "2026-06-08" };

async function mount(piece: "rook", rotation?: typeof ROTATION) {
  const view = renderHook(() => useExerciseProgress(piece, rotation));
  // Flush the load-progress + visible-ids effects so the ref is set.
  await act(async () => {});
  return view;
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("flag OFF — legacy linear senda", () => {
  it("blocks navigation beyond the next incomplete index", async () => {
    const { result } = await mount("rook"); // no rotation arg
    expect(result.current.visibleExerciseIds).toBeNull();
    act(() => result.current.goToExercise(3)); // maxAllowed = 0 when fresh
    expect(result.current.progress.exerciseIndex).toBe(0);
  });
});

describe("flag ON — rotation visible set (guest canonical = rook-1..5)", () => {
  it("exposes the canonical 5 as the visible set", async () => {
    const { result } = await mount("rook", ROTATION);
    const visible = result.current.visibleExerciseIds;
    expect(visible).not.toBeNull();
    expect(visible!.size).toBe(5);
    expect(visible!.has("rook-4")).toBe(true);
    expect(visible!.has("rook-8")).toBe(false);
  });

  it("navigates to a visible exercise beyond the linear senda", async () => {
    const { result } = await mount("rook", ROTATION);
    act(() => result.current.goToExercise(3)); // rook-4, in the visible set
    expect(result.current.progress.exerciseIndex).toBe(3);
  });

  it("blocks navigation to an exercise outside the visible set", async () => {
    const { result } = await mount("rook", ROTATION);
    act(() => result.current.goToExercise(7)); // rook-8, NOT canonical
    expect(result.current.progress.exerciseIndex).toBe(0);
  });

  it("writes stars to the real pool index, not a visible slot index", async () => {
    const { result } = await mount("rook", ROTATION);
    act(() => result.current.goToExercise(2)); // rook-3 (pool index 2)
    act(() => result.current.completeExercise(1)); // rook-3 optimal 1 → 3★
    expect(result.current.progress.stars[2]).toBe(3);
    expect(result.current.progress.stars[0]).toBe(0);
    expect(result.current.progress.stars[1]).toBe(0);
  });
});
