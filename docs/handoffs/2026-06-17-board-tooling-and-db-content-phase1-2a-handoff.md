# Handoff — Board tooling + db-content Phase 1 & 2a (2026-06-17)

## State: all merged to `main` (= `origin/main` = `a6de9721`)
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

## NEXT (entry point) — db-content Phase 2b then 2c
- **2b — per-consumer injection seam (~8 files)**: thread an injected catalog
  with **default arg = the baseline import** so flag-off is byte-identical.
  Files (spec §Read-path integration table): `lib/game/exercises.ts`,
  `lib/game/rotation.ts`, `lib/training/path.ts`, `lib/game/progress-adapter.ts`,
  `lib/hub/derive-reward-tiles.ts`, `hooks/use-exercise-progress.ts`,
  `hooks/use-rotation-steering.ts`, `components/exercises/exercises-screen.tsx`.
  **Proof obligation:** full suite green + `tsc` clean with no provider (flag
  off) before enabling.
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
