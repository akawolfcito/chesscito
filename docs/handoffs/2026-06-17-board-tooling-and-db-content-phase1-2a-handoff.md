# Handoff — Board tooling + db-content Phase 1, 2a & 2b-1 (2026-06-17)

## State: all merged to `main` (= `origin/main`, head `12d6b6cc`, PRs #123–#128)
Solo-on-main convention: PRs are traceability-only, auto-merged. `production` is
a separate snapshot — none of this is promoted to prod.

### Shipped this session
1. **db-content Phase 1** (PR #123) — write side:
   - `src/lib/content/overlay-types.ts` (contracts)
   - migration `apps/web/supabase/migrations/20260617000000_content_overlay.sql`
     (table `content_overlay`, PK `(kind,id)`, RLS no grants)
   - `POST /api/admin/content` — `ADMIN_TOKEN` 503/403 · rate-limit 429 ·
     BFS-validate via `buildCatalog` 400 · upsert + `revalidateTag("content")` +
     audit. 6 tests.
   - **Migration validated locally** (`docker exec psql` against the running
     local stack): table/PK/checks/RLS match the spec. **NOT applied to hosted**
     (CI/deploy). It was applied ad-hoc to the local DB (not via migration
     tracking) — a `supabase db reset` re-applies it cleanly.
2. **db-content Phase 2a** (PR #126) — merged catalog loader, **pure + additive,
   no consumer reads it yet**:
   - `src/lib/content/merged-catalog.ts`: `mergeOverlay` (append/replace/
     remove-disabled/descriptions/sort, re-BFS-verify + drop bad rows, never
     throws) + `getMergedCatalog` (`unstable_cache` tag `"content"`) +
     `loadMergedCatalog` (fetch w/ 2s timeout, baseline-only fallback).
   - `MergedCatalog`/`BaselineCatalog` types. 11 tests. content+game 742/742.
3. **Dev board tooling** (PR #124) + **builder wired** (PR #125):
   - `/dev/board-calibration` — grid-vs-bg-art alignment tuner + Figma SVG gen
     (`scripts/gen-board-grid-svg.mjs`).
   - `app/dev/_components/procedural-board.tsx` — programmatic board (no bg
     image): textured tiles ARE the board (cells square by construction), candy
     frame PNG overlay (`public/dev/tablero/*`), lime coords on the frame band.
   - `/dev/labyrinth-builder` now previews on this board (real piece sprites,
     star goal, wall tint, capture ring, BFS dot, trace number). Verified 390px.
   - Backlog `docs/backlog/2026-06-17-isolate-dev-tools-into-separate-app.md`
     (move /dev into `apps/tech`). All /dev are local-only (`NODE_ENV` → 404 on
     Vercel).

## Phase 2b-1 ✅ DONE (PR #128) — injection seam in the PURE helpers
Optional `catalog` param (default = baseline) added to the pure read-path
helpers, so a merged catalog can be threaded without behaviour change:
- `rotation.ts` — new `ExerciseCatalog` type; `getExercisePool`,
  `getCanonicalFive`, `getPieceMasteryStars` take `catalog = EXERCISES`;
  `getVisibleExercisesForToday` gains `opts.catalog`.
- `training/path.ts` — new `TrainingCatalog`; `buildTrainingPath` gains
  `input.catalog` (exercises + labyrinths).
- `progress-adapter.ts` — all 5 helpers take `catalog = EXERCISES`.
- `derive-reward-tiles.ts` — `input.catalog` gates `hasExercises`.
- 6 injection tests (`src/lib/game/__tests__/catalog-injection.test.ts`);
  game+training+hub 631/631; tsc + eslint clean. Flag-off byte-identical.

## NEXT (entry point) — db-content Phase 2b-2 then 2c
- **2b-2 — client half (CatalogContext)**: add a `CatalogContext` + `useCatalog`
  (default = baseline when no provider) and make the CLIENT consumers read pools
  from it and pass them to the now-injectable pure helpers:
  `hooks/use-exercise-progress.ts` (⚠️ **8 dependent test files**),
  `hooks/use-rotation-steering.ts`, `components/exercises/exercises-screen.tsx`.
  `result-overlay.tsx` (only `EXERCISES_PER_PIECE`) and `mission-panel-candy.tsx`
  (no pool reads) need NO change. No provider mounted yet → baseline
  (byte-identical). **Proof:** full suite green + `tsc` clean, flag off.
- **2c — hydration + flag**: mount `CatalogProvider` at the `/exercises` server
  boundary with `getMergedCatalog()` pools (passed as a prop), gate with
  `CONTENT_OVERLAY_ENABLED` (default off). **Cache-bust integration test** lands
  here (write → revalidateTag → next read reflects it; warm cache = 0 DB hits).
  Also: `app/[locale]/exercises/page.tsx` + `hub/page.tsx` (server validators)
  and `api/sign-labyrinth/route.ts` (server validator) still read baseline —
  decide in 2c whether they consume the merged catalog too.
- **2c — hydration contract + flag**: `/exercises` server boundary calls
  `getMergedCatalog()` and passes `pools` as a prop into a `CatalogProvider`;
  client renders only from the prop. Gate with `CONTENT_OVERLAY_ENABLED`
  (default off). **Cache-bust integration test lands here** (write →
  revalidateTag → next read reflects it; warm cache = 0 DB hits).
- Then: apply migration to hosted (deploy/CI), set `ADMIN_TOKEN` env, flip flag
  + observe (`source`/`overlayCount`/latency).

## Open questions
- **Senda re-open UX** (decide before 2c enable): a live addition that grows a
  pool the player already completed — leave completed + surface the new puzzle
  as optional extra (default), or re-open the senda? (spec Open questions)
- Wall/capture marker visuals in the builder are placeholders (dark tint / red
  ring) — fine for dev; revisit if the procedural board graduates to `/exercises`.

## Gotchas
- Two local Supabase stacks can collide on port 54322 (orphan repo-root
  `/supabase/` = project `qxwztvfazronkshgkckk` vs `--workdir apps/web` =
  `web`). The user's 4h-up stack is `qxwztvfazronkshgkckk`. Always
  `--workdir apps/web`.
- Host disk ~98% full → Docker (supabase start) hit "No space left"; freed via
  `docker builder prune`. Disk pressure is a recurring env issue.
- The procedural board must be wired into the REAL game only via a spec
  (touches arena/thumbnail/OG) — see memory [[procedural-board-for-labyrinth-builder]].
