/**
 * ExerciseCatalogContext — db-backed-content Phase 2b-2 (client seam).
 *
 * The context carries the by-piece exercise pools (`ExerciseCatalog`).
 * Its default value is the compiled baseline `EXERCISES`, so any consumer
 * rendered WITHOUT a provider behaves byte-identically to a direct
 * `EXERCISES` import. Phase 2c mounts the provider with the merged
 * (baseline ⊕ overlay) pools at the /exercises server boundary.
 *
 * Coverage:
 *  - No provider → `useExerciseCatalog()` returns the baseline EXERCISES.
 *  - With a provider → returns the injected catalog (proves the seam, not
 *    just the default).
 */

import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  ExerciseCatalogProvider,
  useExerciseCatalog,
} from "@/lib/content/catalog-context";
import { EXERCISES } from "@/lib/game/exercises";
import type { ExerciseCatalog } from "@/lib/game/rotation";

describe("ExerciseCatalogContext", () => {
  it("returns the baseline EXERCISES when no provider is mounted", () => {
    const { result } = renderHook(() => useExerciseCatalog());
    expect(result.current).toBe(EXERCISES);
  });

  it("returns the injected catalog when wrapped in a provider", () => {
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
});
