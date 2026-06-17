# Handoff — db-content overlay-full

**Date:** 2026-06-17
**Branch merged:** `feat/db-content-overlay-full` → `main` (PR #132, `11601bee`)
**Suite:** 3918/3918 · `tsc --noEmit` clean · eslint clean
**Spec:** `docs/specs/db-content-overlay-full.md` (+ `-redteam.md`, 3 P0s folded)

## What shipped (7 TDD stages, atomic commits)

| Stage | Change |
| --- | --- |
| S1 | `catalog-context.tsx` → `ContentCatalog {exercises,labyrinths,descriptions}` + `ContentCatalogProvider`. `useExerciseCatalog()` return unchanged (back-compat); new `useLabyrinthCatalog()` / `useExerciseDescriptions()`. `ExerciseCatalogProvider` kept as exercises-only back-compat alias (2 hook tests use it). |
| S2 | `resolveExerciseDescription` gains 5th param `descriptions` (default baseline). |
| S3 | `/exercises/page.tsx` mounts the **full** `ContentCatalogProvider` (was exercises-only). |
| S4 | exercises-screen labyrinth list + king-gate (`:2878`) + `buildTrainingPath` read `useLabyrinthCatalog()` (list AND gate share one source — red-team P0); exercise-drawer threads `useExerciseDescriptions()`. |
| S5 | Extracted `lib/content/baseline-write.ts` (`writeBaselineRecord`/`readBaselineRecords`); `/api/dev/labyrinth` is now a thin wrapper (one write path — red-team P0). |
| S6 | New dev-only `/api/dev/publish` proxy: baseline json + live overlay in one call; `ADMIN_TOKEN` server-side only; sanitized errors (no token/raw body); normalized `OVERLAY_PUBLISH_BASE_URL`; 404 in prod. |
| S7 | Builder Save + disable/enable toggle publish via the proxy; ok/warn/err toasts via pure `formatPublishResult` + commit nudge + debounce ("Publishing…"). |

All behind `CONTENT_OVERLAY_ENABLED` (default OFF → no provider → baseline,
byte-identical, zero DB hits).

## New env (LOCAL builder machine only)
- `OVERLAY_PUBLISH_BASE_URL` — publish target (e.g. `https://preview.chesscito.com`).
- `ADMIN_TOKEN` — must match the target env's token.
Both server-side; read by `/api/dev/publish`, never sent to the browser.

## Now possible (vs Phase 2c which was exercises-only)
- Edit/add/disable **labyrinths** live (no redeploy).
- Edit exercise **descriptions** (`explanation`) live.
- Publish from the builder in **one click** (`/dev/labyrinth-builder` Save) instead of curl.

## Next (unchanged Phase 3 ops — founder)
See `docs/runbooks/2026-06-17-db-content-phase3-runbook.md` (+ overlay-full addendum):
1. `supabase db push` (migration to hosted — still commit-only).
2. Vercel env per scope: `ADMIN_TOKEN` + `CONTENT_OVERLAY_ENABLED=true` (preview first).
3. Local `.env`: `OVERLAY_PUBLISH_BASE_URL` + `ADMIN_TOKEN` for builder publish.
4. Smoke on preview → flip prod. `CONTENT_OVERLAY_ENABLED=false` = kill-switch.

## Open / queued
- **Builder wall asset**: use `design/labyrinths/wall1.png` instead of the black
  square (queued task, needs the image triplet png/webp/avif in `public/art/**`).
- Click-time preview-vs-prod target picker (env-config only for now).
- VR baselines for the exercises surface (none exist).

Wolfcito 🐾 @akawolfcito
