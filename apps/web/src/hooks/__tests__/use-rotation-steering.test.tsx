import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

import { EXERCISES } from "@/lib/game/exercises";
import { ExerciseCatalogProvider } from "@/lib/content/catalog-context";
import type { ExerciseCatalog } from "@/lib/game/rotation";
import {
  useRotationSteering,
  type RotationSteeringOptions,
} from "@/hooks/use-rotation-steering";

/**
 * Slice 3B gate (red-team P0-2, spec B8): while the labyrinth layer is
 * active, rotation steering must NOT yank the player back to an
 * exercise. Before this hook existed, the inline effect in
 * exercises-screen.tsx (915-927 at ab634b25) had no labyrinth check at
 * all — with rotation ON and a persisted exerciseIndex outside today's
 * visible set, `goToExercise` fired even mid-labyrinth.
 */

const ROOK_IDS = EXERCISES.rook.map((ex) => ex.id);

function makeOptions(
  overrides: Partial<RotationSteeringOptions> = {},
): RotationSteeringOptions {
  return {
    enabled: true,
    // Visible set excludes the current exercise → steering wants to jump.
    visibleExerciseIds: new Set(ROOK_IDS.slice(1, 6)),
    currentExerciseId: ROOK_IDS[0],
    piece: "rook",
    // Sparse id-keyed best-stars map: absent id = not played (→ 0).
    stars: {},
    goToExercise: vi.fn(),
    suspended: false,
    ...overrides,
  };
}

describe("useRotationSteering", () => {
  it("steers to the first incomplete visible exercise (legacy behavior)", () => {
    const options = makeOptions();
    renderHook(() => useRotationSteering(options));
    expect(options.goToExercise).toHaveBeenCalledWith(1);
  });

  it("prefers the first INCOMPLETE visible exercise over the first visible", () => {
    // First visible exercise (pool index 1) already complete → jump to index 2.
    const stars = { [ROOK_IDS[1]]: 3 };
    const options = makeOptions({ stars });
    renderHook(() => useRotationSteering(options));
    expect(options.goToExercise).toHaveBeenCalledWith(2);
  });

  it("does nothing when the current exercise is already visible", () => {
    const options = makeOptions({
      visibleExerciseIds: new Set(ROOK_IDS.slice(0, 5)),
    });
    renderHook(() => useRotationSteering(options));
    expect(options.goToExercise).not.toHaveBeenCalled();
  });

  it("does nothing when rotation is disabled (OFF path, no regression)", () => {
    const options = makeOptions({ enabled: false });
    renderHook(() => useRotationSteering(options));
    expect(options.goToExercise).not.toHaveBeenCalled();
  });

  it("does nothing when the visible set is null or empty", () => {
    const nullSet = makeOptions({ visibleExerciseIds: null });
    renderHook(() => useRotationSteering(nullSet));
    expect(nullSet.goToExercise).not.toHaveBeenCalled();

    const emptySet = makeOptions({ visibleExerciseIds: new Set<string>() });
    renderHook(() => useRotationSteering(emptySet));
    expect(emptySet.goToExercise).not.toHaveBeenCalled();
  });

  // ── P0-2 regression guards ──────────────────────────────────────

  it("NEVER steers while suspended (labyrinth layer active)", () => {
    const options = makeOptions({ suspended: true });
    renderHook(() => useRotationSteering(options));
    expect(options.goToExercise).not.toHaveBeenCalled();
  });

  it("stays suspended across visible-set changes mid-labyrinth", () => {
    const goToExercise = vi.fn();
    const { rerender } = renderHook(
      (props: RotationSteeringOptions) => useRotationSteering(props),
      { initialProps: makeOptions({ suspended: true, goToExercise }) },
    );
    // Daily set rotates / steering target changes while the player is
    // still inside the labyrinth — still no jump.
    rerender(
      makeOptions({
        suspended: true,
        goToExercise,
        visibleExerciseIds: new Set(ROOK_IDS.slice(2, 7)),
      }),
    );
    expect(goToExercise).not.toHaveBeenCalled();
  });

  it("resumes steering after leaving the labyrinth layer", () => {
    const goToExercise = vi.fn();
    const { rerender } = renderHook(
      (props: RotationSteeringOptions) => useRotationSteering(props),
      { initialProps: makeOptions({ suspended: true, goToExercise }) },
    );
    expect(goToExercise).not.toHaveBeenCalled();
    rerender(makeOptions({ suspended: false, goToExercise }));
    expect(goToExercise).toHaveBeenCalledWith(1);
  });

  // ── Phase 2b-2: catalog injection seam ──────────────────────────
  // The steering index is resolved against the INJECTED pool, not the
  // baseline import. Swapping the first two rook exercises moves
  // ROOK_IDS[1] to pool index 0, so the steering target shifts from 1
  // (baseline) to 0 — proving the hook reads the context catalog.
  it("resolves the steering target against the injected catalog", () => {
    const injected: ExerciseCatalog = {
      ...EXERCISES,
      rook: [EXERCISES.rook[1], EXERCISES.rook[0], ...EXERCISES.rook.slice(2)],
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ExerciseCatalogProvider value={injected}>
        {children}
      </ExerciseCatalogProvider>
    );
    const options = makeOptions({
      visibleExerciseIds: new Set([ROOK_IDS[1]]),
      currentExerciseId: ROOK_IDS[0],
    });
    renderHook(() => useRotationSteering(options), { wrapper });
    expect(options.goToExercise).toHaveBeenCalledWith(0);
  });
});
