/**
 * Star Sweep — the best-move count that the replay CTA promises the player.
 *
 * This is the number the whole experiment rests on: "your best: 9 · perfect: 7".
 * If it can move the wrong way, or read as 0 on a record written before the
 * feature shipped, the CTA promises a goal that is either already met or
 * impossible — and an unauditable number reads as a lie.
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

vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({ isConnected: false, address: undefined })),
}));

const trackMock = vi.fn();
vi.mock("@/lib/telemetry", () => ({ track: (...args: unknown[]) => trackMock(...args) }));

import { EXERCISES } from "@/lib/game/exercises";

const key = (piece: string) => `chesscito:progress:${piece}`;
const firstRookId = () => EXERCISES.rook[0].id;

async function mountRook() {
  const { renderHook, act } = await import("@testing-library/react");
  const { useExerciseProgress } = await import("@/hooks/use-exercise-progress");
  const rendered = renderHook(() => useExerciseProgress("rook"));
  act(() => {});
  return { ...rendered, act };
}

describe("bestMoves persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    trackMock.mockClear();
  });
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("records the first completion as the best", async () => {
    const { result, act } = await mountRook();
    act(() => result.current.completeExercise(9));

    expect(result.current.progress.bestMoves?.[firstRookId()]).toBe(9);
  });

  it("only overwrites the best when a run BEATS it", async () => {
    const { result, act } = await mountRook();

    act(() => result.current.completeExercise(9));
    act(() => result.current.completeExercise(12)); // worse — must not win
    expect(result.current.progress.bestMoves?.[firstRookId()]).toBe(9);

    act(() => result.current.completeExercise(9)); // a tie is not an improvement
    expect(result.current.progress.bestMoves?.[firstRookId()]).toBe(9);

    act(() => result.current.completeExercise(7)); // better — must win
    expect(result.current.progress.bestMoves?.[firstRookId()]).toBe(7);
  });

  it("survives a reload through localStorage", async () => {
    const first = await mountRook();
    first.act(() => first.result.current.completeExercise(8));
    first.unmount();

    const second = await mountRook();
    expect(second.result.current.progress.bestMoves?.[firstRookId()]).toBe(8);
  });

  it("reads a pre-feature record as 'no best yet', never as zero", async () => {
    // Every record written before 2026-08-10 lacks `bestMoves`. A 0 here would
    // render as an already-perfect run the player can never beat.
    localStorage.setItem(
      key("rook"),
      JSON.stringify({ piece: "rook", currentId: null, stars: { [firstRookId()]: 3 } }),
    );
    const { result } = await mountRook();

    expect(result.current.progress.bestMoves?.[firstRookId()]).toBeUndefined();
    expect(result.current.progress.stars[firstRookId()]).toBe(3);
  });

  it("drops a best that is BELOW the exercise's optimum", async () => {
    // Not a great record — proof the board changed underneath it. `rook-2`
    // shipped for months as a one-move exercise; players stored `bestMoves: 1`,
    // and then it became a three-star sweep with an optimum of 3. The stale 1
    // made the screen announce PERFECT RUN for a run nobody had, and withdraw
    // the replay CTA — the whole experiment — while showing "+1 STARS" from the
    // run actually played. Seen on device 2026-08-11.
    const { EXERCISES } = await import("@/lib/game/exercises");
    const rook2 = EXERCISES.rook.find((e) => e.id === "rook-2")!;
    expect(rook2.optimalMoves).toBeGreaterThan(1); // guards the guard

    localStorage.setItem(
      key("rook"),
      JSON.stringify({
        piece: "rook",
        currentId: null,
        stars: {},
        bestMoves: { "rook-2": 1 },
      }),
    );
    const { result } = await mountRook();

    expect(result.current.progress.bestMoves?.["rook-2"]).toBeUndefined();
  });

  it("keeps a best that EQUALS the optimum", async () => {
    // The perfect run is a legitimate record and must survive the guard.
    const { EXERCISES } = await import("@/lib/game/exercises");
    const rook2 = EXERCISES.rook.find((e) => e.id === "rook-2")!;

    localStorage.setItem(
      key("rook"),
      JSON.stringify({
        piece: "rook",
        currentId: null,
        stars: {},
        bestMoves: { "rook-2": rook2.optimalMoves },
      }),
    );
    const { result } = await mountRook();

    expect(result.current.progress.bestMoves?.["rook-2"]).toBe(rook2.optimalMoves);
  });

  it("keeps a best for an id the pool does not know", async () => {
    // "Retired" and "not loaded yet" look identical to a membership check, and
    // dropping on that ambiguity is how progress gets destroyed — the same trap
    // the stars migration documents.
    localStorage.setItem(
      key("rook"),
      JSON.stringify({
        piece: "rook",
        currentId: null,
        stars: {},
        bestMoves: { "rook-from-a-future-catalog": 1 },
      }),
    );
    const { result } = await mountRook();

    expect(result.current.progress.bestMoves?.["rook-from-a-future-catalog"]).toBe(1);
  });

  it("drops corrupt best entries instead of trusting them", async () => {
    localStorage.setItem(
      key("rook"),
      JSON.stringify({
        piece: "rook",
        currentId: null,
        stars: {},
        bestMoves: { [firstRookId()]: 0, "rook-2": -3, "rook-4": 1.5, "rook-6": "8" },
      }),
    );
    const { result } = await mountRook();

    const best = result.current.progress.bestMoves ?? {};
    expect(best[firstRookId()]).toBeUndefined(); // 0 would read as perfect
    expect(best["rook-2"]).toBeUndefined();
    expect(best["rook-4"]).toBeUndefined();
    expect(best["rook-6"]).toBeUndefined();
  });
});

describe("sweep_result telemetry", () => {
  beforeEach(() => {
    localStorage.clear();
    trackMock.mockClear();
  });
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("stays silent for an unconverted exercise", async () => {
    // `rook-1` is the control and must never enter the experiment's denominator.
    const { result, act } = await mountRook();
    act(() => result.current.completeExercise(4));

    const names = trackMock.mock.calls.map(([name]) => name);
    expect(names).not.toContain("sweep_result");
  });

  it("leaves the baseline event untouched", async () => {
    // `training_exercise_completed` is what the result is compared against; a
    // new field on it would break the historical series.
    const { result, act } = await mountRook();
    act(() => result.current.completeExercise(4));

    const completed = trackMock.mock.calls.find(
      ([name]) => name === "training_exercise_completed",
    );
    expect(completed).toBeDefined();
    expect(Object.keys(completed![1] as object)).not.toContain("isFirstContact");
    expect(Object.keys(completed![1] as object)).not.toContain("bestMovesBefore");
  });
});
