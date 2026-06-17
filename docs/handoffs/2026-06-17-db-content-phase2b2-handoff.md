# Handoff — db-backed-content Phase 2b-2 (client injection seam)

**Date:** 2026-06-17
**Branch merged:** `feat/db-content-phase2b-client` → `main` (PR #130, `c8924426`)
**Suite:** 3890/3890 · `tsc --noEmit` clean · eslint clean

## State

Phase 2b-2 (the client half of the Phase 2b injection seam) is **done and
merged**. With Phases 1, 2a, 2b-1 and now 2b-2 landed, the entire read path
is plumbed to consume an injectable catalog — but **no provider is mounted
yet**, so every consumer falls through to the compiled baseline `EXERCISES`.
The flag-off read path is byte-identical to before this PR.

## What shipped

| File | Change |
| --- | --- |
| `lib/content/catalog-context.tsx` (new) | `ExerciseCatalogContext` (default = baseline `EXERCISES`), `<ExerciseCatalogProvider value>`, `useExerciseCatalog()`. Intentionally does **not** throw when consumed outside a provider — the baseline default is the designed fallback, not misuse. |
| `lib/exercises/visible-set.ts` | `computeVisibleExerciseIds(args, catalog = EXERCISES)` — optional 2nd arg threaded to `getCanonicalFive`, `normalizeStarsById`, `getVisibleExercisesForToday`. Closed the 2b-1 seam gap (visible-set was not injected then). |
| `hooks/use-rotation-steering.ts` | Reads `useExerciseCatalog()`; steering target index resolves against the injected pool. `catalog` added to effect deps. |
| `hooks/use-exercise-progress.ts` | Derives `pool`/`count` from the context; threads `catalog` into `loadProgress`, `sanitizeStarsById` (now take `pool: Exercise[]`), progress-adapter totals, and `computeVisibleExerciseIds`. `completeExercise`/`advanceExercise`/`goToExercise` `useCallback` deps gained the stable `pool`/`catalog` refs. |
| `components/exercises/exercises-screen.tsx` | The 5 `EXERCISES[selectedPiece]` reads now read `catalog[selectedPiece]` via `useExerciseCatalog()`; `EXERCISES` import removed. `LABYRINTHS` stays on the direct import (overlay labyrinths out of 2b-2 scope). |

## Tests

TDD throughout (Red → Green per change). New injection tests:
- `lib/content/__tests__/catalog-context.test.tsx` — default = baseline; provider override changes the pool (2).
- `hooks/__tests__/use-rotation-steering.test.tsx` (renamed `.ts`→`.tsx` for the JSX wrapper) — steering target resolves against an injected swapped pool (+1).
- `lib/exercises/__tests__/visible-set.test.ts` — visible set computed against an injected single-exercise pool (+1).
- `hooks/__tests__/use-exercise-progress-catalog-injection.test.tsx` — `count`/`isLastExercise` follow an injected single-exercise pool, not the 15-baseline (+1).

The **8 existing `use-exercise-progress` test files** pass unchanged (no provider → baseline → byte-identical). That is the 2b-2 acceptance proof.

## Next — Phase 2c (mount + flag)

The read path is enabled here. Steps (see `docs/specs/db-backed-content.md`):
1. At the `/exercises` **server boundary**, call `getMergedCatalog()` (Phase 2a loader, cached + tagged `"content"`) and pass the merged `exercises` pools down to `<ExercisesScreen>`.
2. Wrap the client tree in `<ExerciseCatalogProvider value={pools}>` (exercises-screen receives `pools` as a prop and mounts the provider around its children).
3. **Hydration contract** (red-team P0 hydration-mismatch): exercises-screen is `"use client"`. The SSR pass and the first client render must read the **same** pools, or React throws a hydration mismatch. Read spec §"Hydration contract" before wiring — the merged pools must be serialized into the client boundary, not re-fetched on the client.
4. Gate the whole thing behind `CONTENT_OVERLAY_ENABLED` (flag OFF → pass baseline / no provider → today's behavior).
5. **Cache-bust test**: write route `revalidateTag("content")` → next `/exercises` load serves the new overlay (acceptance criterion).

### Open question before enabling 2c
**Senda re-open UX**: when an overlay appends a new exercise to a piece whose senda the player already completed, does the senda re-open (new pending exercise) or stay closed? Founder decision (a) vs (b) — see spec §Open questions. Decide before flipping `CONTENT_OVERLAY_ENABLED`.

### Also pending (carried from prior handoffs)
- Phase 1 migration `content_overlay` is committed but **NOT applied to hosted** (CI/deploy step).
- No VR baselines for the exercises surface.
- `LABYRINTHS` overlay injection (exercises-screen still reads baseline labyrinths) — out of 2b-2; fold into 2c or a follow-up if overlay labyrinths are in scope.

Wolfcito 🐾 @akawolfcito
