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

  it("does not drop the second step on a rapid double-dismiss in the same tick", () => {
    const twoIncrementalArgs: GatherArgs = {
      piece: "rook",
      progressByPiece: {
        rook: {
          piece: "rook",
          currentId: null,
          stars: { "rook-1": 2, "rook-2": 2, "rook-3": 2 },
        },
      },
      dailyStars: 0,
      sessionQuotaExhausted: false,
      badgeClaimed: false,
      allLabyrinthsComplete: false,
      hadGreatSessionBefore: false,
    };

    const { result } = renderHook(() => useCelebrationQueue());

    act(() => {
      result.current.resolve(twoIncrementalArgs);
    });

    // Two steps queued: first-reward, then first-labyrinth.
    expect(result.current.current?.id).toBe("first-reward");

    // Both calls happen before React commits — the ref must advance
    // synchronously so the second call reads step B, not step A again.
    act(() => {
      result.current.dismissCurrent();
      result.current.dismissCurrent();
    });

    expect(result.current.current).toBeNull();
    expect(getMilestoneStore().events["first-reward"].celebratedAt).toBeDefined();
    expect(
      getMilestoneStore().events["first-labyrinth:rook"].celebratedAt,
    ).toBeDefined();
  });

  it("marks every absorbed milestone celebrated, not just the closer", () => {
    // A single exercise carries all 10 stars: `completedExercises` stays at 1
    // (< 2) and `pieceCompletedExercises` stays at 1 (< 3), so neither
    // first-reward nor first-labyrinth fire — the queue holds only the
    // closer, keeping this test's assertions unambiguous.
    //
    // The crown absorbs the Great Focus Session. It can no longer absorb
    // `piece-badge-eligible`: mastery REQUIRES a claimed badge, and a claimed
    // badge is no longer claimable — the two are exclusive states of one badge.
    const masteryArgs: GatherArgs = {
      piece: "rook",
      progressByPiece: {
        rook: {
          piece: "rook",
          currentId: null,
          stars: { "rook-1": 10 },
        },
      },
      dailyStars: 8,
      sessionQuotaExhausted: false,
      badgeClaimed: true,
      allLabyrinthsComplete: true,
      hadGreatSessionBefore: true,
    };

    const { result } = renderHook(() => useCelebrationQueue());

    act(() => {
      result.current.resolve(masteryArgs);
    });

    expect(result.current.current?.id).toBe("mastery");
    expect(result.current.current?.absorbed).toContainEqual({
      id: "great-focus-session",
    });

    act(() => {
      result.current.dismissCurrent();
    });

    expect(getMilestoneStore().events["mastery:rook"].celebratedAt).toBeDefined();
    expect(
      getMilestoneStore().events["great-focus-session"].celebratedAt,
    ).toBeDefined();
  });

  /** REGRESSION (final review C1). The closer is piece-scoped, the absorbed
   *  events are GLOBAL. Re-attaching the closer's piece to them built the key
   *  `great-focus-session:rook`, which matches no event — so `markCelebrated`
   *  wrote NOTHING and the praise re-fired as a stray overlay on the next
   *  solve, right after the climax it had been absorbed into. */
  it("marks a GLOBAL absorbed event celebrated under a piece-scoped closer", () => {
    const badgeAndGreatSessionArgs: GatherArgs = {
      piece: "rook",
      progressByPiece: {
        rook: { piece: "rook", currentId: null, stars: { "rook-1": 10 } },
      },
      dailyStars: 8, // → great-focus-session, a GLOBAL event
      sessionQuotaExhausted: false,
      badgeClaimed: false,
      allLabyrinthsComplete: false,
      hadGreatSessionBefore: false, // → first-great-session, also GLOBAL
    };

    const { result } = renderHook(() => useCelebrationQueue());

    act(() => {
      result.current.resolve(badgeAndGreatSessionArgs);
    });

    // One dialog: the badge closes, the praise rides inside it.
    expect(result.current.current?.id).toBe("piece-badge-eligible");
    expect(result.current.current?.absorbed).toContainEqual({
      id: "great-focus-session",
    });

    act(() => {
      result.current.dismissCurrent();
    });

    const events = getMilestoneStore().events;
    expect(events["piece-badge-eligible:rook"].celebratedAt).toBeDefined();
    expect(events["great-focus-session"].celebratedAt).toBeDefined();
    expect(events["first-great-session"].celebratedAt).toBeDefined();
    // The bare global keys are the ONLY ones written — no piece-scoped ghost.
    expect(events["great-focus-session:rook"]).toBeUndefined();

    // The next solve must not resurrect the praise as a second overlay.
    act(() => {
      result.current.resolve(badgeAndGreatSessionArgs);
    });
    expect(result.current.current).toBeNull();
  });

  it("re-queues a still-pending absorbed event when a claim is cancelled", () => {
    // Same single-exercise trick as above: keeps first-reward and
    // first-labyrinth from firing, so the queue holds only the closer.
    const claimArgs: GatherArgs = {
      piece: "rook",
      progressByPiece: {
        rook: {
          piece: "rook",
          currentId: null,
          stars: { "rook-1": 10 },
        },
      },
      dailyStars: 8,
      sessionQuotaExhausted: false,
      badgeClaimed: false,
      allLabyrinthsComplete: false,
      hadGreatSessionBefore: true,
    };

    const { result } = renderHook(() => useCelebrationQueue());

    act(() => {
      result.current.resolve(claimArgs);
    });

    expect(result.current.current?.id).toBe("piece-badge-eligible");
    expect(result.current.current?.absorbed).toContainEqual({
      id: "great-focus-session",
    });
    const step = result.current.current!;

    // Cancellation path: release BEFORE dismissing, per the doc comment on
    // `releaseAbsorbed` — dismissing first would already have stamped
    // `celebratedAt` on the absorbed event, erasing it from `selectPending`.
    act(() => {
      result.current.releaseAbsorbed(step);
    });

    expect(result.current.current?.id).toBe("great-focus-session");
    expect(getMilestoneStore().events["great-focus-session"].celebratedAt).toBeUndefined();
  });

  it("refuses to write openedAt for a non-navigable milestone", () => {
    const greatSessionArgs: GatherArgs = {
      piece: "rook",
      progressByPiece: {
        rook: { piece: "rook", currentId: null, stars: { "rook-1": 2 } },
      },
      dailyStars: 8,
      sessionQuotaExhausted: false,
      badgeClaimed: false,
      allLabyrinthsComplete: false,
      hadGreatSessionBefore: true,
    };

    const { result } = renderHook(() => useCelebrationQueue());

    act(() => {
      result.current.resolve(greatSessionArgs);
    });

    expect(result.current.current?.id).toBe("great-focus-session");

    act(() => {
      result.current.openContent("great-focus-session");
    });

    expect(getMilestoneStore().events["great-focus-session"].openedAt).toBeUndefined();
  });
});
