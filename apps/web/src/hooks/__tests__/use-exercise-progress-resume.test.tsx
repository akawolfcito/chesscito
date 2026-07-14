/**
 * Resuming where you left off.
 *
 * The bug this file pins: a player with a perfectly valid `currentId` was
 * sometimes dropped back onto exercise 1. It reproduced in the browser only
 * intermittently, which made it look like a test-harness problem. It is not —
 * it is a data race with a destructive write in it.
 *
 * The cause is that `loadProgress` validated the stored `currentId` against the
 * pool AT LOAD TIME. The pool comes from the catalog context, which is not
 * guaranteed to be complete on the first pass (Phase 2c mounts a merged catalog
 * at the /exercises boundary). A pool that is not ready yet is indistinguishable,
 * to that check, from an exercise that was retired — so a live id got nulled. And
 * on the legacy path the wiped result was written straight back to localStorage,
 * which turns a transient race into permanent data loss.
 *
 * The rule these tests encode: **the pool decides what to RENDER, never what to
 * REMEMBER.** Resolving a stored id against the pool is a render-time concern
 * (and already has a fallback); throwing the id away is not.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));
vi.mock("@/lib/peones/training-earn", () => ({
  submitTrainingExerciseEarn: vi.fn().mockResolvedValue({
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

import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { useExerciseProgress } from "@/hooks/use-exercise-progress";
import { ExerciseCatalogProvider } from "@/lib/content/catalog-context";
import { EXERCISES } from "@/lib/game/exercises";
import type { ExerciseCatalog } from "@/lib/game/rotation";
import type { Exercise } from "@/lib/game/types";

const ROOK = EXERCISES.rook;
const KEY = "chesscito:progress:rook";

/** The pool as it exists once the merged catalog has landed. */
const fullCatalog = (rook: Exercise[] = ROOK): ExerciseCatalog => ({
  ...EXERCISES,
  rook,
});

const wrapperFor = (catalog: ExerciseCatalog) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ExerciseCatalogProvider value={catalog}>{children}</ExerciseCatalogProvider>
    );
  };

const seed = (progress: unknown) =>
  localStorage.setItem(KEY, JSON.stringify(progress));

const stored = () => JSON.parse(localStorage.getItem(KEY) ?? "null");

beforeEach(() => localStorage.clear());
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("resume — a stored currentId is where the player left off", () => {
  it("opens exactly the exercise the id names", () => {
    const target = ROOK[5];
    seed({ piece: "rook", currentId: target.id, stars: { [ROOK[0].id]: 3 } });

    const { result } = renderHook(() => useExerciseProgress("rook"), {
      wrapper: wrapperFor(fullCatalog()),
    });

    expect(result.current.currentExercise.id).toBe(target.id);
  });

  it("falls back to the first exercise when the id names nothing in the pool", () => {
    // A retired exercise. This fallback is correct and must stay: the player has
    // to land somewhere, and the top of the curriculum is the safe somewhere.
    seed({ piece: "rook", currentId: "rook-retired-long-ago", stars: {} });

    const { result } = renderHook(() => useExerciseProgress("rook"), {
      wrapper: wrapperFor(fullCatalog()),
    });

    expect(result.current.currentExercise.id).toBe(ROOK[0].id);
  });

  it("falls back to the first exercise when there is no id at all", () => {
    seed({ piece: "rook", currentId: null, stars: {} });

    const { result } = renderHook(() => useExerciseProgress("rook"), {
      wrapper: wrapperFor(fullCatalog()),
    });

    expect(result.current.currentExercise.id).toBe(ROOK[0].id);
  });

  it("resumes the same exercise after the pool is reordered", () => {
    // Order is a curriculum decision and it moves (A6 reordered the whole rook
    // pool). Resume is keyed by id precisely so that reordering never teleports
    // a player to a different exercise.
    const target = ROOK[5];
    seed({ piece: "rook", currentId: target.id, stars: {} });

    const reversed = [...ROOK].reverse();
    const { result } = renderHook(() => useExerciseProgress("rook"), {
      wrapper: wrapperFor(fullCatalog(reversed)),
    });

    expect(result.current.currentExercise.id).toBe(target.id);
  });
});

describe("resume — a pool that is not ready yet is NOT a retired exercise", () => {
  it("keeps a valid currentId when the merged pool has not landed yet", () => {
    // THE BUG. The catalog context can hand over an incomplete pool on the first
    // pass. Validating the stored id against THAT pool cannot tell "not loaded
    // yet" from "deleted", so a live id was thrown away and the player was
    // dropped onto exercise 1.
    const target = ROOK[9];
    seed({ piece: "rook", currentId: target.id, stars: {} });

    // The catalog the provider hands down is read fresh on every render, so
    // swapping it here and re-rendering models exactly what Phase 2c does: a
    // short pool first, the merged pool a beat later.
    let catalog = fullCatalog(ROOK.slice(0, 2)); // merged catalog still in flight
    const { result, rerender } = renderHook(() => useExerciseProgress("rook"), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ExerciseCatalogProvider value={catalog}>{children}</ExerciseCatalogProvider>
      ),
    });

    // While the pool is short the player is parked on exercise 1 — fine, it is
    // the only thing that can be rendered. What must NOT happen is the id being
    // forgotten, because then the arrival of the real pool changes nothing.
    expect(stored().currentId).toBe(target.id);

    catalog = fullCatalog();
    rerender();
    expect(result.current.currentExercise.id).toBe(target.id);
  });

  it("never writes a pool-derived wipe back to storage", () => {
    // The destructive half. On the legacy path `loadProgress` persisted its own
    // result, so a migration run against an unready pool did not merely mis-read
    // the progress — it overwrote it. That is how a transient race became
    // permanent data loss.
    seed({
      piece: "rook",
      exerciseIndex: 9,
      stars: [3, 3, 3, 3, 3, 3, 3, 3, 3, 0],
    });

    const partial = fullCatalog(ROOK.slice(0, 2));
    renderHook(() => useExerciseProgress("rook"), {
      wrapper: wrapperFor(partial),
    });

    const after = stored();
    // Nine exercises were completed. Whatever shape storage is in, that fact must
    // survive a render against a pool that could only see two of them.
    const starCount = Array.isArray(after.stars)
      ? after.stars.filter((s: number) => s > 0).length
      : Object.values(after.stars as Record<string, number>).filter((s) => s > 0)
          .length;
    expect(starCount).toBe(9);
  });
});

describe("resume — rotation must not vote before progress has loaded", () => {
  /**
   * The second half of the resume bug, and the half that actually MOVED people.
   *
   * Today's visible set is chosen by star count — unplayed exercises float up, and
   * only the first few survive the cut. Before progress loads, `stars` is empty, so
   * every exercise looks unplayed and the cut falls to the session hash: a
   * different five every run, because a guest's seed is minted per session.
   *
   * `useRotationSteering` then navigates the player out of any exercise not in that
   * set — and persists the move. So a returning player was steered off their real
   * exercise by a set computed from progress the app had not read yet, landing
   * somewhere decided by a coin flip. In the browser this showed up as exercises 8
   * and 10 opening as exercise 1 on some runs and not others.
   *
   * `null` until hydrated is the honest answer: no opinion is better than a random
   * one, and every reader already treats null as "no rotation opinion yet".
   */
  it("keeps the resumed exercise inside today's set, so steering cannot evict it", () => {
    // Nine exercises mastered, resuming on the tenth. The tenth is the only
    // unplayed one, so a set computed from REAL progress must float it to the top
    // and cannot possibly exclude it — which is what makes the player safe from
    // steering. Computed from the empty pre-load stars, all ten look unplayed and
    // the cut is a coin flip, which is how the tenth got evicted from its own set.
    const target = ROOK[9];
    seed({
      piece: "rook",
      currentId: target.id,
      stars: Object.fromEntries(ROOK.slice(0, 9).map((ex) => [ex.id, 3])),
    });

    const { result } = renderHook(
      () =>
        useExerciseProgress("rook", {
          enabled: true,
          sessionSeed: "any-seed",
          dateUtc: "2026-07-14",
        }),
      { wrapper: wrapperFor(fullCatalog()) },
    );

    expect(result.current.currentExercise.id).toBe(target.id);
    expect(result.current.visibleExerciseIds?.has(target.id)).toBe(true);
  });
});

describe("resume — progress belongs to ids, not to positions", () => {
  it("does not hand a new exercise the stars of a retired one", () => {
    const brandNew: Exercise[] = [
      { ...ROOK[0], id: "rook-brand-new-1" },
      { ...ROOK[1], id: "rook-brand-new-2" },
    ];
    seed({ piece: "rook", exerciseIndex: 0, stars: [3, 3] });

    const { result } = renderHook(() => useExerciseProgress("rook"), {
      wrapper: wrapperFor(fullCatalog(brandNew)),
    });

    expect(result.current.progress.stars["rook-brand-new-1"] ?? 0).toBe(0);
    expect(result.current.progress.stars["rook-brand-new-2"] ?? 0).toBe(0);
  });

  /**
   * The decision, written down so nobody "fixes" it back (founder, 2026-07-14).
   *
   * Legacy `stars` is an array indexed by pool POSITION. The pool it was written
   * against is gone — A6 reordered the entire rook curriculum — so position 3 no
   * longer names the exercise it named when the number was stored. The array is
   * therefore AMBIGUOUS: nothing in it can tell us which exercise earned what.
   *
   * We drop it rather than guess. Crediting it by today's order would tell a
   * player they have mastered an exercise they never solved, and mastery unlocks
   * tiers — so the lie compounds. A player can re-earn stars in minutes. They
   * cannot un-learn a false claim the app made about what they know.
   *
   * Losing ambiguous progress beats certifying the wrong learning.
   */
  it("drops ambiguous legacy stars rather than credit the wrong exercise", () => {
    // A legacy record that says: nine exercises mastered, resume at the tenth.
    seed({
      piece: "rook",
      exerciseIndex: 9,
      stars: [3, 3, 3, 3, 3, 3, 3, 3, 3, 0],
    });

    const { result } = renderHook(() => useExerciseProgress("rook"), {
      wrapper: wrapperFor(fullCatalog()),
    });

    // Not one star is credited — not even to the exercises that plausibly earned
    // them. Under the post-A6 order we cannot say WHICH nine, and a partly-right
    // guess is still a wrong claim about a specific exercise.
    expect(Object.keys(result.current.progress.stars)).toHaveLength(0);
    expect(result.current.totalStars).toBe(0);

    // But `exerciseIndex` still ORIENTS. Resuming at slot 10 is a guess the player
    // can correct in one tap; it asserts nothing about what they learned.
    expect(result.current.currentExercise.id).toBe(ROOK[9].id);
  });

  it("leaves the ambiguous legacy record alone instead of overwriting it", () => {
    // Load stays read-only. If it wrote its own result back, a pool that had not
    // finished loading would burn the wipe into storage — which is exactly how the
    // original bug turned a transient race into permanent data loss.
    const legacy = { piece: "rook", exerciseIndex: 9, stars: [3, 3, 3] };
    seed(legacy);

    renderHook(() => useExerciseProgress("rook"), {
      wrapper: wrapperFor(fullCatalog()),
    });

    expect(stored()).toEqual(legacy);
  });
});
