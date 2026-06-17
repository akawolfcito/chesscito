"use client";

/**
 * ExerciseCatalogContext — db-backed-content Phase 2b-2 (client seam).
 *
 * Carries the by-piece exercise pools (`ExerciseCatalog`) that the client
 * surfaces read. The default value is the compiled baseline `EXERCISES`,
 * so a consumer rendered WITHOUT a provider behaves byte-identically to a
 * direct `EXERCISES` import — this is what keeps the flag-off read path
 * unchanged in Phase 2b.
 *
 * Phase 2c mounts `<ExerciseCatalogProvider>` at the /exercises server
 * boundary with the merged (baseline ⊕ overlay) pools, behind
 * `CONTENT_OVERLAY_ENABLED`. Until then no provider is mounted and every
 * consumer falls through to the baseline default.
 *
 * Note: unlike most context hooks here, `useExerciseCatalog` does NOT
 * throw when consumed outside a provider — the baseline default is the
 * intended fallback, not a misuse.
 */

import { createContext, useContext, type ReactNode } from "react";
import { EXERCISES } from "@/lib/game/exercises";
import type { ExerciseCatalog } from "@/lib/game/rotation";

const ExerciseCatalogContext = createContext<ExerciseCatalog>(EXERCISES);

export function ExerciseCatalogProvider({
  value,
  children,
}: {
  value: ExerciseCatalog;
  children: ReactNode;
}) {
  return (
    <ExerciseCatalogContext.Provider value={value}>
      {children}
    </ExerciseCatalogContext.Provider>
  );
}

/** Returns the active by-piece exercise pools. Baseline `EXERCISES` when
 *  no provider is mounted (Phase 2b flag-off path). */
export function useExerciseCatalog(): ExerciseCatalog {
  return useContext(ExerciseCatalogContext);
}
