/**
 * Rotation Engine — slice G smoke harness (connected wallet).
 *
 * Real-wallet browser smoke is hard (wagmi/MiniPay injection), so this
 * deterministic harness drives the full hook with a mocked connected
 * wallet + fixed UTC date to validate the paths that the guest screenshot
 * can't reach: 5★ Medium, 9★ King Hard, non-linear navigation, and
 * progress mapping. Guest canonical 5 is covered by the drawer test + the
 * /exercises flag-on screenshot; the session-seed path by the visible-set
 * unit test.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const trackMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/telemetry", () => ({ track: trackMock }));

const submitMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/peones/training-earn", () => ({
  submitTrainingExerciseEarn: submitMock,
}));

const useAccountMock = vi.hoisted(() => vi.fn());
vi.mock("wagmi", () => ({ useAccount: useAccountMock }));

import { act, renderHook } from "@testing-library/react";
import { useExerciseProgress } from "@/hooks/use-exercise-progress";
import { seedProgress } from "./helpers/seed-progress";
import { EXERCISES } from "@/lib/game/exercises";
import type { PieceId } from "@/lib/game/types";

const WALLET = "0xabcdef0123456789abcdef0123456789abcdef01";
const ROTATION = { enabled: true, dateUtc: "2026-06-08" };

function seed(piece: PieceId, stars: number[]): void {
  localStorage.setItem(
    `chesscito:progress:${piece}`,
    seedProgress(piece, 0, stars),
  );
}

async function mount(piece: PieceId) {
  const view = renderHook(() => useExerciseProgress(piece, ROTATION));
  await act(async () => {}); // flush load-progress + visible-ids effects
  return view;
}

const tierOf = (piece: PieceId, id: string) =>
  EXERCISES[piece].find((e) => e.id === id)?.tier;
const poolIndexOf = (piece: PieceId, id: string) =>
  EXERCISES[piece].findIndex((e) => e.id === id);

beforeEach(() => {
  localStorage.clear();
  submitMock.mockReset();
  submitMock.mockResolvedValue({ kind: "success", credited: 0, duplicate: false });
  useAccountMock.mockReset();
  useAccountMock.mockReturnValue({ isConnected: true, address: WALLET });
  trackMock.mockClear();
});

describe("smoke — tier gating with a connected wallet seed", () => {
  it("5★ Rook unlocks Medium and surfaces it in today's set", async () => {
    seed("rook", [3, 2, 0, 0, 0, 0, 0, 0, 0, 0]); // mastery 5
    const { result } = await mount("rook");
    const visible = result.current.visibleExerciseIds;
    expect(visible).not.toBeNull();
    expect(visible!.size).toBeLessThanOrEqual(5);
    expect([...visible!].some((id) => tierOf("rook", id) === "medium")).toBe(true);
  });

  it("9★ King surfaces Hard when it should (Hard floated by bias)", async () => {
    // All Easy+Medium 3★, both Hard (king-6, king-9) at 0★ → mastery 24.
    seed("king", [3, 3, 3, 3, 3, 0, 3, 0, 3, 3]);
    const { result } = await mount("king");
    const visible = result.current.visibleExerciseIds;
    expect(visible).not.toBeNull();
    expect([...visible!].some((id) => tierOf("king", id) === "hard")).toBe(true);
  });

  it("a piece without Hard never returns Hard even at high mastery", async () => {
    seed("rook", [3, 3, 3, 0, 0, 0, 0, 0, 0, 0]); // mastery 9, no Hard content
    const { result } = await mount("rook");
    const visible = result.current.visibleExerciseIds;
    expect([...visible!].some((id) => tierOf("rook", id) === "hard")).toBe(false);
  });
});

describe("smoke — non-linear navigation + progress mapping", () => {
  it("navigates to a visible Medium beyond the linear senda and writes the right id", async () => {
    seed("rook", [3, 2, 0, 0, 0, 0, 0, 0, 0, 0]); // maxAllowed (legacy) = 2
    const { result } = await mount("rook");
    const visible = [...result.current.visibleExerciseIds!];
    // A visible exercise whose pool index is beyond the legacy senda head.
    const nonLinearIndex = visible
      .map((id) => poolIndexOf("rook", id))
      .find((i) => i > 2);
    expect(nonLinearIndex).toBeGreaterThan(2);

    act(() => result.current.goToExercise(nonLinearIndex!));
    expect(result.current.progress.currentId).toBe(
      EXERCISES.rook[nonLinearIndex!].id,
    );

    const optimal = EXERCISES.rook[nonLinearIndex!].optimalMoves;
    act(() => result.current.completeExercise(optimal)); // 3★

    // Progress written under the REAL exerciseId, seeded values preserved.
    expect(result.current.progress.stars[EXERCISES.rook[nonLinearIndex!].id]).toBe(3);
    expect(result.current.progress.stars[EXERCISES.rook[0].id]).toBe(3);
    expect(result.current.progress.stars[EXERCISES.rook[1].id]).toBe(2);
  });

  it("blocks navigation to an exercise outside today's set", async () => {
    seed("rook", [3, 2, 0, 0, 0, 0, 0, 0, 0, 0]);
    const { result } = await mount("rook");
    const visible = result.current.visibleExerciseIds!;
    const outIndex = EXERCISES.rook.findIndex((e) => !visible.has(e.id));
    expect(outIndex).toBeGreaterThanOrEqual(0);
    const before = result.current.progress.currentId;
    act(() => result.current.goToExercise(outIndex));
    expect(result.current.progress.currentId).toBe(before); // unchanged
  });
});

describe("smoke — badge mastery stays across-pool under rotation", () => {
  it("badgeEarned crosses at 10★ regardless of which exercises hold the stars", async () => {
    seed("rook", [3, 3, 3, 0, 0, 0, 0, 0, 0, 0]); // 9★ → not yet
    const below = await mount("rook");
    expect(below.result.current.badgeEarned).toBe(false);
    expect(below.result.current.totalStars).toBe(9);

    localStorage.clear();
    seed("rook", [0, 0, 0, 0, 0, 1, 3, 3, 3, 0]); // 10★ spread across the pool
    const at = await mount("rook");
    expect(at.result.current.totalStars).toBe(10);
    expect(at.result.current.badgeEarned).toBe(true);
  });
});
