/**
 * useExerciseProgress — guest rotation session seed.
 *
 * Verifies the canonical 5 → session rotation graduation and that a
 * connected wallet always wins over the guest session seed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));
vi.mock("@/lib/peones/training-earn", () => ({
  EXERCISE_MILESTONE_EARN_AMOUNT: 1,
  submitExerciseMilestoneEarn: vi.fn().mockResolvedValue({
    kind: "success",
    credited: 0,
    duplicate: false,
  }),
}));

const useAccountMock = vi.hoisted(() => vi.fn());
vi.mock("wagmi", () => ({ useAccount: useAccountMock }));

import { act, renderHook } from "@testing-library/react";
import { useExerciseProgress } from "@/hooks/use-exercise-progress";
import { seedProgress } from "./helpers/seed-progress";
import { EXERCISES } from "@/lib/game/exercises";

const WALLET = "0xabcdef0123456789abcdef0123456789abcdef01";
const ROTATION = { enabled: true, dateUtc: "2026-06-08" };
const GUEST_KEY = "chesscito:guest-session-id";
const canonical = EXERCISES.rook.slice(0, 5).map((e) => e.id);

function seed(stars: number[]): void {
  localStorage.setItem(
    "chesscito:progress:rook",
    seedProgress("rook", 0, stars),
  );
}

async function mount(rotation?: typeof ROTATION) {
  const view = renderHook(() => useExerciseProgress("rook", rotation));
  // Flush loadProgress + the guest-seed effect + the memo recompute.
  await act(async () => {});
  await act(async () => {});
  return view;
}

beforeEach(() => {
  localStorage.clear();
  useAccountMock.mockReset();
  useAccountMock.mockReturnValue({ isConnected: false, address: undefined });
});
afterEach(() => vi.restoreAllMocks());

describe("flag OFF", () => {
  it("no visible set and no guest session id created", async () => {
    seed([1, 1, 1, 1, 1, 0, 0, 0, 0, 0]);
    const { result } = await mount(); // no rotation arg
    expect(result.current.visibleExerciseIds).toBeNull();
    expect(localStorage.getItem(GUEST_KEY)).toBeNull();
  });
});

describe("guest — first touch (not graduated)", () => {
  it("shows the canonical 5 and creates no session id", async () => {
    seed([3, 3, 3, 3, 0, 0, 0, 0, 0, 0]); // 4/5 canonical done → not graduated
    const { result } = await mount(ROTATION);
    expect([...result.current.visibleExerciseIds!].sort()).toEqual(
      [...canonical].sort(),
    );
    expect(localStorage.getItem(GUEST_KEY)).toBeNull();
  });
});

describe("guest — graduated", () => {
  it("rotates by a freshly-created session id (Medium now surfaces)", async () => {
    seed([1, 1, 1, 1, 1, 0, 0, 0, 0, 0]); // all 5 canonical done → graduated
    const { result } = await mount(ROTATION);
    // Session id was created + persisted.
    expect(localStorage.getItem(GUEST_KEY)).toBeTruthy();
    const visible = [...result.current.visibleExerciseIds!];
    expect(visible.length).toBe(5);
    // At mastery 5 the bias surfaces the 5 zero-star Medium exercises —
    // none of the canonical first 5 appear → it rotated past canonical.
    for (const id of visible) {
      expect(canonical).not.toContain(id);
    }
  });
});

describe("wallet wins over the session seed", () => {
  it("ignores the guest session seed and never creates one when connected", async () => {
    useAccountMock.mockReturnValue({ isConnected: true, address: WALLET });
    seed([1, 1, 1, 1, 1, 0, 0, 0, 0, 0]); // graduated stars
    const { result } = await mount(ROTATION);
    expect(result.current.visibleExerciseIds).not.toBeNull();
    // Connected → guest path skipped → no session id ever written.
    expect(localStorage.getItem(GUEST_KEY)).toBeNull();
  });
});

describe("connect after playing as guest", () => {
  it("preserves local progress when a wallet is connected", async () => {
    seed([3, 2, 1, 0, 0, 0, 0, 0, 0, 0]);
    useAccountMock.mockReturnValue({ isConnected: true, address: WALLET });
    const { result } = await mount(ROTATION);
    // Local progress (device-local) is untouched by connecting.
    expect(result.current.progress.stars[EXERCISES.rook[0].id]).toBe(3);
    expect(result.current.progress.stars[EXERCISES.rook[1].id]).toBe(2);
    expect(result.current.progress.stars[EXERCISES.rook[2].id]).toBe(1);
    expect(result.current.totalStars).toBe(6);
  });
});
