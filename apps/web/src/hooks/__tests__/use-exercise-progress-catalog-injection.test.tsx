/**
 * useExerciseProgress — catalog injection seam (db-content Phase 2b-2).
 *
 * The hook derives its active pool from `ExerciseCatalogContext` rather
 * than the baseline `EXERCISES` import. With no provider the default is
 * baseline (covered byte-identically by the other 7 test files); here we
 * mount a provider with a single-exercise rook pool and prove the hook's
 * pool-derived affordances (count → isLastExercise) follow the injected
 * catalog, not the 15-exercise baseline.
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

import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { useExerciseProgress } from "@/hooks/use-exercise-progress";
import { ExerciseCatalogProvider } from "@/lib/content/catalog-context";
import { EXERCISES } from "@/lib/game/exercises";
import type { ExerciseCatalog } from "@/lib/game/rotation";

beforeEach(() => localStorage.clear());
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("useExerciseProgress catalog injection", () => {
  it("derives count/isLastExercise from the injected pool, not baseline", () => {
    // Single-exercise rook pool: index 0 is the last exercise.
    const injected: ExerciseCatalog = {
      ...EXERCISES,
      rook: [EXERCISES.rook[0]],
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ExerciseCatalogProvider value={injected}>
        {children}
      </ExerciseCatalogProvider>
    );
    const { result } = renderHook(() => useExerciseProgress("rook"), {
      wrapper,
    });
    // Baseline rook has >1 exercises → isLastExercise would be false at
    // index 0. With the injected single-exercise pool it must be true.
    expect(result.current.currentExercise.id).toBe(EXERCISES.rook[0].id);
    expect(result.current.isLastExercise).toBe(true);
  });
});
