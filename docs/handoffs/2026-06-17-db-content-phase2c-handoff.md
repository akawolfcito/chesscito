# Handoff — db-backed-content Phase 2c (mount + flag)

**Date:** 2026-06-17
**Branch merged:** `feat/db-content-phase2c-mount` → `main` (PR #131, `58382d8d`)
**Suite:** 3894/3894 · `tsc --noEmit` clean · eslint clean

## State

Phase 2c is **done and merged**. The read path is now fully wired: the
`/exercises` server boundary mounts `<ExerciseCatalogProvider>` with the merged
(baseline ⊕ overlay) exercise pools — **but gated behind
`CONTENT_OVERLAY_ENABLED`, which defaults OFF**. With the flag off the page
renders `<ExercisesScreen>` directly, no provider, zero DB hits → byte-identical
to pre-2c. Prod is unaffected.

## What shipped

| File | Change |
| --- | --- |
| `lib/content/overlay-flag.ts` (new) | `CONTENT_OVERLAY_ENABLED = process.env.CONTENT_OVERLAY_ENABLED === "true"`. Server-only (no `NEXT_PUBLIC_`). |
| `app/[locale]/exercises/page.tsx` | Now `async`. Flag ON → `await getMergedCatalog()`, mount `<ExerciseCatalogProvider value={merged.exercises}>` around the screen; `pieceHasExercises` validates against merged pools. Flag OFF → render screen directly, no provider, no merged read. |
| `app/[locale]/exercises/__tests__/page.test.tsx` | Async + flag OFF (baseline, no provider, `getMergedCatalog` not called) and flag ON (provider with merged pools, child screen, validation against merged pools) scenarios. |

**Hydration contract (red-team P0):** merged pools are serialized into the
client boundary as the provider `value`, so SSR and the first client render read
the same catalog — no mismatch, no client re-fetch.

## Tests

TDD (red → green). 9 page tests (was 5). Net suite +4 → 3894/3894. Cache-bust
contract already proven across existing tests (no new test needed): the admin
`route.test.ts` revalidates `"content"` on write; `merged-catalog.test.ts`
loader reflects fresh rows + baseline-only fallback. The warm-cache "zero DB
hits" property is an `unstable_cache` framework guarantee (not unit-testable in
plain vitest).

## Out of 2c scope (follow-up)

- **Descriptions + `LABYRINTHS` overlay injection.** `ExerciseCatalogContext`
  carries exercise pools only (2b-2 decision). An overlay edit to a description
  or a labyrinth won't surface until the context is widened. Fold into a
  follow-up before enabling overlay labyrinths/descriptions in prod.

## Next — Phase 3 (flip + observe)

Before flipping `CONTENT_OVERLAY_ENABLED=true` in any env:
1. **Founder decision — Senda re-open UX** (spec §Open questions): overlay grows
   a pool the player already completed → (a) leave completed + surface the new
   exercise as an optional extra (spec default), or (b) re-open the senda.
2. **Apply migration `content_overlay` to hosted** — still committed-only, NOT
   applied (CI/deploy step).
3. Enable on dev/preview first; log `source` + `overlayCount` + overlay fetch
   latency; `CONTENT_OVERLAY_ENABLED=false` remains the kill-switch (fully
   bypasses the loader, no DB call).
4. Add VR baselines for the exercises surface (none exist).

Wolfcito 🐾 @akawolfcito
