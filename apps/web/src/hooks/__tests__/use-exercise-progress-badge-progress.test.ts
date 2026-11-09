/**
 * useExerciseProgress — `badgeProgress`, the visible counter.
 *
 * The chip on `/exercises` and the hub tile both render this fraction. Its
 * denominator is the badge GATE (`badgeRequiredCount`, 80% of the pool rounded
 * up), NOT the pool size — "8/10 with the badge already earned" is a number the
 * player cannot reconcile with anything on screen.
 *
 * ⛔ Which means the numerator has to stop at the gate too. `completedCount`
 * counts the whole pool, so a player past 80% rendered `9/8` (bishop, pool 9)
 * and `10/8` (every other piece, pool 10) — a fraction that reads as broken.
 * The hub tile never showed it because its counter only renders in the
 * `progress` state and the tile flips to `claimable` at the gate; `/exercises`
 * has no such cut, so the overshoot was visible there and only there
 * (founder screenshot, 2026-08-09).
 *
 * ⚠️ Only the DISPLAY clamps. `completedExerciseCount` and `isBadgeEarned` keep
 * counting the true pool — the gate itself must not move.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));
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
import { useExerciseProgress } from "@/hooks/use-exercise-progress";
import {
  EXERCISES,
  badgeRequiredCount,
  completedExerciseCount,
} from "@/lib/game/exercises";
import type { PieceId } from "@/lib/game/types";
import { seedProgress } from "./helpers/seed-progress";

/** One star on the first `count` exercises of the piece's pool. */
function completing(piece: PieceId, count: number): number[] {
  return EXERCISES[piece].map((_, i) => (i < count ? 1 : 0));
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("badgeProgress — the counter never overshoots its gate", () => {
  it("counts honestly below the gate", async () => {
    localStorage.setItem(
      `chesscito:progress:rook`,
      seedProgress("rook", 0, completing("rook", 3)),
    );

    const { result } = renderHook(() => useExerciseProgress("rook"));
    await act(async () => {});

    expect(result.current.badgeProgress).toEqual({
      completed: 3,
      required: 8,
      extra: 0,
    });
  });

  it("caps the numerator at the gate once the pool runs past it", async () => {
    // Bishop is the piece that exposed this: pool 9, gate 8. The ninth
    // completion rendered "9/8".
    const pool = EXERCISES.bishop.length;
    localStorage.setItem(
      `chesscito:progress:bishop`,
      seedProgress("bishop", 0, completing("bishop", pool)),
    );

    const { result } = renderHook(() => useExerciseProgress("bishop"));
    await act(async () => {});

    expect(result.current.badgeProgress).toEqual({
      completed: badgeRequiredCount(pool),
      required: badgeRequiredCount(pool),
      // What the fraction can no longer express: pool 9 minus a gate of 8.
      extra: pool - badgeRequiredCount(pool),
    });
  });

  it("caps a two-over pool too — every other piece can reach 10 of a gate of 8", async () => {
    const pool = EXERCISES.knight.length;
    localStorage.setItem(
      `chesscito:progress:knight`,
      seedProgress("knight", 0, completing("knight", pool)),
    );

    const { result } = renderHook(() => useExerciseProgress("knight"));
    await act(async () => {});

    expect(result.current.badgeProgress?.completed).toBe(
      badgeRequiredCount(pool),
    );
    expect(result.current.badgeProgress?.extra).toBe(
      pool - badgeRequiredCount(pool),
    );
  });

  it("leaves the badge gate itself alone — mastery still reads the true pool", async () => {
    const pool = EXERCISES.bishop.length;
    localStorage.setItem(
      `chesscito:progress:bishop`,
      seedProgress("bishop", 0, completing("bishop", pool)),
    );

    const { result } = renderHook(() => useExerciseProgress("bishop"));
    await act(async () => {});

    // The display clamp must not become the gate: every exercise is solved, so
    // the badge is earned and the underlying count still reads the whole pool.
    expect(result.current.badgeEarned).toBe(true);
    expect(
      completedExerciseCount("bishop", result.current.progress.stars),
    ).toBe(pool);
  });
});
