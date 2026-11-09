/**
 * ContentCatalogContext — db-backed-content (Phase 2b-2 seam + overlay-full).
 *
 * The context carries the full read catalog: by-piece exercise pools,
 * labyrinth pools, and the descriptions map. Its default value is the
 * compiled baseline, so any consumer rendered WITHOUT a provider behaves
 * byte-identically to a direct baseline import. The /exercises server
 * boundary mounts the provider with the merged (baseline ⊕ overlay) catalog.
 *
 * Coverage:
 *  - No provider → selectors return the baseline (EXERCISES / LABYRINTHS /
 *    GENERATED_EXERCISE_DESCRIPTIONS).
 *  - With a provider → selectors return the injected catalog (proves the
 *    seam, not just the default).
 *  - Back-compat: the exercises-only `ExerciseCatalogProvider` still works.
 */

import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  ContentCatalogProvider,
  ExerciseCatalogProvider,
  useExerciseCatalog,
  useExerciseDescriptions,
  useLabyrinthCatalog,
  type ContentCatalog,
} from "@/lib/content/catalog-context";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import type { ExerciseCatalog } from "@/lib/game/rotation";

describe("ContentCatalogContext — no provider (baseline default)", () => {
  it("useExerciseCatalog returns the baseline EXERCISES", () => {
    const { result } = renderHook(() => useExerciseCatalog());
    expect(result.current).toBe(EXERCISES);
  });

  it("useLabyrinthCatalog returns the baseline LABYRINTHS", () => {
    const { result } = renderHook(() => useLabyrinthCatalog());
    expect(result.current).toBe(LABYRINTHS);
  });

  it("useExerciseDescriptions returns the baseline descriptions", () => {
    const { result } = renderHook(() => useExerciseDescriptions());
    expect(result.current).toBe(GENERATED_EXERCISE_DESCRIPTIONS);
  });
});

describe("ContentCatalogContext — with ContentCatalogProvider", () => {
  const injected: ContentCatalog = {
    exercises: { ...EXERCISES, rook: EXERCISES.rook.slice(0, 1) },
    labyrinths: { ...LABYRINTHS, rook: LABYRINTHS.rook.slice(0, 1) },
    descriptions: { "rook-overlay": "Overlay description" },
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ContentCatalogProvider value={injected}>{children}</ContentCatalogProvider>
  );

  it("useExerciseCatalog returns the injected exercise pools", () => {
    const { result } = renderHook(() => useExerciseCatalog(), { wrapper });
    expect(result.current).toBe(injected.exercises);
    expect(result.current.rook).toHaveLength(1);
  });

  it("useLabyrinthCatalog returns the injected labyrinth pools", () => {
    const { result } = renderHook(() => useLabyrinthCatalog(), { wrapper });
    expect(result.current).toBe(injected.labyrinths);
    expect(result.current.rook).toHaveLength(1);
  });

  it("useExerciseDescriptions returns the injected descriptions", () => {
    const { result } = renderHook(() => useExerciseDescriptions(), { wrapper });
    expect(result.current["rook-overlay"]).toBe("Overlay description");
  });
});

describe("ContentCatalogContext — back-compat ExerciseCatalogProvider", () => {
  it("the exercises-only provider still drives useExerciseCatalog", () => {
    const injected: ExerciseCatalog = {
      ...EXERCISES,
      rook: EXERCISES.rook.slice(0, 1),
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ExerciseCatalogProvider value={injected}>
        {children}
      </ExerciseCatalogProvider>
    );
    const { result } = renderHook(() => useExerciseCatalog(), { wrapper });
    expect(result.current).toBe(injected);
    expect(result.current.rook).toHaveLength(1);
  });

  it("leaves labyrinths + descriptions at baseline when only exercises are provided", () => {
    const injected: ExerciseCatalog = { ...EXERCISES };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ExerciseCatalogProvider value={injected}>
        {children}
      </ExerciseCatalogProvider>
    );
    const lab = renderHook(() => useLabyrinthCatalog(), { wrapper });
    expect(lab.result.current).toBe(LABYRINTHS);
  });
});
