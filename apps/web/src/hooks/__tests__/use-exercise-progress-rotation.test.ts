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
  EXERCISE_MILESTONE_EARN_AMOUNT: 1,
  submitExerciseMilestoneEarn: vi.fn().mockResolvedValue({
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
import { EXERCISES } from "@/lib/game/exercises";
import { pieceProgressStorageKey } from "@/lib/lite-progress-storage";
import type { PieceId } from "@/lib/game/types";

const ROTATION = { enabled: true, dateUtc: "2026-06-08" };
const rookId = (i: number) => EXERCISES.rook[i].id;

/** A player who finished the piece: every exercise at 3★. This is the state
 *  the bug needs — the sort key ties, so the visible cut is pure hash. */
function seedSolvedPiece(piece: PieceId) {
  const stars = Object.fromEntries(
    EXERCISES[piece].map((ex) => [ex.id, 3]),
  );
  localStorage.setItem(
    pieceProgressStorageKey(piece),
    JSON.stringify({ piece, currentId: EXERCISES[piece][0].id, stars }),
  );
}

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
    // Blocked → currentId stays null (no navigation); currentExercise
    // falls back to the first pool exercise.
    expect(result.current.progress.currentId).toBeNull();
    expect(result.current.currentExercise.id).toBe(rookId(0));
  });
});

describe("flag ON — rotation visible set (guest canonical = first 5 of the pool)", () => {
  it("exposes the canonical 5 as the visible set", async () => {
    const { result } = await mount("rook", ROTATION);
    const visible = result.current.visibleExerciseIds;
    expect(visible).not.toBeNull();
    expect(visible!.size).toBe(5);
    // ⚠️ By POOL INDEX, never by id. The canonical set is "the first five",
    // which is a position; ids move whenever the curriculum is reordered, and
    // pinning `rook-4` here broke the moment it went from slot 5 to slot 8.
    expect(visible!.has(rookId(3))).toBe(true);
    expect(visible!.has(rookId(7))).toBe(false);
  });

  it("navigates to a visible exercise beyond the linear senda", async () => {
    const { result } = await mount("rook", ROTATION);
    act(() => result.current.goToExercise(3)); // rook-4, in the visible set
    expect(result.current.progress.currentId).toBe(rookId(3));
  });

  it("blocks navigation to an exercise outside the visible set", async () => {
    const { result } = await mount("rook", ROTATION);
    act(() => result.current.goToExercise(7)); // rook-8, NOT canonical
    // Blocked → currentId stays null; currentExercise stays at rook-1.
    expect(result.current.progress.currentId).toBeNull();
    expect(result.current.currentExercise.id).toBe(rookId(0));
  });

  /* ⛔ Playtest 2026-08-08. A player who finished a whole piece could not
   * replay 4 of its exercises, and the tap gave NO signal — it just did
   * nothing. `DAILY_VISIBLE_LIMIT` is 5 and the pieces hold 8-10, so with
   * every exercise at 3★ the sort key ties and the cut falls to the daily
   * hash: there are ALWAYS solved exercises outside today's set, and which
   * ones changes every UTC day.
   *
   * The drawer already promises the opposite in so many words — "Rotation
   * gates only fresh exercises. Solved ones stay open forever." — so it
   * painted those nodes open and `goToExercise` refused them. The tap died
   * between two rules that disagreed.
   *
   * Rotation exists to bound what is NEW per day. It was never meant to take
   * back what the player already earned. */
  it("navigates to a SOLVED exercise outside today's visible set", async () => {
    seedSolvedPiece("rook");
    const { result } = await mount("rook", ROTATION);

    const visible = result.current.visibleExerciseIds!;
    // Derived, never pinned: the catalog can grow and this must still find
    // the case it is testing (or fail loudly for the right reason).
    const outsideIndex = EXERCISES.rook.findIndex((ex) => !visible.has(ex.id));
    expect(outsideIndex).toBeGreaterThanOrEqual(0);
    expect(result.current.progress.stars[EXERCISES.rook[outsideIndex].id]).toBe(3);

    act(() => result.current.goToExercise(outsideIndex));
    expect(result.current.progress.currentId).toBe(rookId(outsideIndex));
  });

  it("still blocks a FRESH exercise outside the visible set", async () => {
    // The rule only relaxes for what the player already earned; rotation
    // keeps its whole job over unplayed content.
    const { result } = await mount("rook", ROTATION);
    const visible = result.current.visibleExerciseIds!;
    const outsideIndex = EXERCISES.rook.findIndex((ex) => !visible.has(ex.id));
    expect(outsideIndex).toBeGreaterThanOrEqual(0);

    act(() => result.current.goToExercise(outsideIndex));
    expect(result.current.progress.currentId).toBeNull();
  });

  it("writes stars to the real pool index, not a visible slot index", async () => {
    const { result } = await mount("rook", ROTATION);
    act(() => result.current.goToExercise(2)); // rook-3 (pool index 2)
    act(() => result.current.completeExercise(1)); // rook-3 optimal 1 → 3★
    expect(result.current.progress.stars[rookId(2)]).toBe(3);
    expect(result.current.progress.stars[rookId(0)] ?? 0).toBe(0);
    expect(result.current.progress.stars[rookId(1)] ?? 0).toBe(0);
  });
});
