import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useCelebrationQueue } from "@/lib/progression/use-celebration-queue";
import { getMilestoneStore } from "@/lib/progression/milestone-storage";
import type { GatherArgs } from "@/lib/progression/gather-input";

const solveArgs: GatherArgs = {
  piece: "rook",
  progressByPiece: {
    rook: { piece: "rook", currentId: null, stars: { "rook-1": 2, "rook-2": 2 } },
  },
  dailyStars: 4,
  sessionQuotaExhausted: false,
  badgeClaimed: false,
  allLabyrinthsComplete: false,
  hadGreatSessionBefore: false,
};

describe("useCelebrationQueue", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists the event BEFORE it exposes the overlay", () => {
    const { result } = renderHook(() => useCelebrationQueue());

    act(() => {
      result.current.resolve(solveArgs);
    });

    // On disk already — an app killed right now loses nothing.
    expect(getMilestoneStore().events["first-reward"]).toBeDefined();
    expect(result.current.current?.id).toBe("first-reward");
  });

  it("stamps celebratedAt on dismiss and does not replay the overlay", () => {
    const { result } = renderHook(() => useCelebrationQueue());

    act(() => {
      result.current.resolve(solveArgs);
    });
    act(() => {
      result.current.dismissCurrent();
    });

    expect(result.current.current).toBeNull();
    expect(getMilestoneStore().events["first-reward"].celebratedAt).toBeDefined();

    act(() => {
      result.current.resolve(solveArgs);
    });
    expect(result.current.current).toBeNull();
  });

  it("clears the NEW dot when the content is opened", () => {
    const { result } = renderHook(() => useCelebrationQueue());

    act(() => {
      result.current.resolve(solveArgs);
    });
    act(() => {
      result.current.openContent("first-reward");
    });

    expect(getMilestoneStore().events["first-reward"].openedAt).toBeDefined();
  });
});
