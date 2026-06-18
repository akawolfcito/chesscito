# Handoff — board procedural migration + content-staging start

**Date**: 2026-06-17
**Branch**: `main` (clean) — last commit `23bba3ba`

## Shipped this session (all merged to `main`)

### Board procedural migration — COMPLETE (P0 → P4)
The four board surfaces now render on the programmatic `GameBoard` (tile grid +
candy frame + frame-band coords); the background-image board is fully retired.
- **P1** (#135) board.tsx onto GameBoard + overlay layer + per-surface inset.
- **P2** (#136) arena-board + `orientation` (white/black flip on tiles + overlay).
- **P3** (#137) thumbnail stays **image-based by design** (read-only, in lists →
  64-tile cost not worth it; when final art lands, swap its `<img>` to a flat
  composite + recalibrate inset).
- **fixes** (#138) z-order (pieces above frame) + arena height-aware fit.
- **P4a** (#139) flip exercises/daily/arena/mini-arena ON + a11y parity
  (`role="gridcell"` + "Square a1") + VR baselines refreshed.
- **P4b** (#140) retire dual-path/flag/image branch + dead CSS + `/dev/board-
  calibration`. `board-ch.png` kept (thumbnail only).
- **tile fix** (#141) tiles render texture — `background-image` was missing the
  `image-set(...)` wrapper (invalid CSS → flat-color fallback); moved to
  `.game-board-tile-{light,dark}` classes with dual `-webkit-image-set`/`image-set`.
- Final art confirmed: the green tiles + frame in `/art/board` ARE final (founder).

### Content-staging model — SPEC + slice 1
Replaces the on/off `CONTENT_OVERLAY_ENABLED` with **two-version, per-stage
overlay rows** (`draft`/`preview`/`published`); a puzzle holds a live `published`
AND an in-progress `draft` of the same id — editing never disturbs prod until
promote. Cache refresh = a **60s TTL** (no cross-deployment fan-out). PK widens to
`(kind,id,stage)`.
- **Spec** `docs/specs/content-staging-model.md` (+`-redteam.md`) — READY, P0s
  folded, all 3 founder open Qs resolved (#142, #143).
- **Slice 1** (#144) — SDD types (`ContentStage`, `STAGE_RANK`, `stage` field,
  `ContentStageRequest`/`Result`) + pure `lib/content/stage.ts`
  (`visibleStages`, `envStageFloor` kill-switch, `resolveVisibleRows`
  two-version resolution), 12 TDD tests. Write route now sets `stage:'draft'`.

## Content-staging model — COMPLETE (slices 1–5, all merged)
- **S1** (#144) stage types + pure helpers (`visibleStages`/`envStageFloor`/
  `resolveVisibleRows`).
- **S2** (#145) migration `20260617130000` (PK → `(kind,id,stage)`, `stage`
  column) + transactional `promote_content` RPC. Write route `onConflict` widened.
- **S3** (#146) stage-aware read path: `loadMergedCatalog` filters by
  `visibleStages(floor)` + `resolveVisibleRows`, `revalidate: 60` TTL, cache key
  includes the floor; `/exercises` gates on `envStageFloor()`;
  `CONTENT_OVERLAY_ENABLED` / `overlay-flag.ts` removed.
- **S4** (#147) `POST /api/admin/content/stage` promote/demote via the RPC,
  revalidates own tag (no fan-out).
- **S5** (#148) builder "Saved as draft" copy (Save ≠ live to players).

### Remaining (NOT code — founder-ops + deferred)
1. **Rollout runbook** (spec §"Rollout (operational)") to actually turn it on in
   hosted: **verify current `CONTENT_OVERLAY_ENABLED` in preview AND prod first**,
   `supabase db push` the migration, set `CONTENT_STAGE` per env (prod=published,
   preview=preview, local=draft) + `ADMIN_TOKEN` + local `OVERLAY_PUBLISH_BASE_URL`,
   deploy. Rollback = unset `CONTENT_STAGE` (baseline-only, no redeploy).
2. **RPC integration test** — deferred (needs Docker / `npx supabase start`):
   assert `promote_content` atomicity (partial-failure / concurrent), supersede,
   skip-stage. Route + helpers are unit-tested; only the SQL transaction is uncovered.
3. **Builder promote/demote UI** — out of scope of the spec (data+API only). The
   promote API works; buttons + the from-mismatch 404-lists-stages refinement are a
   follow-up.

## Open / founder-ops (not code)
- **db-content Phase 3 rollout** is now superseded by the staging model. When
  slices 2–5 ship, run the spec's "Rollout (operational)" runbook: **verify the
  current `CONTENT_OVERLAY_ENABLED` value in preview AND prod first**, apply the
  migration to the shared Supabase, set `CONTENT_STAGE` per env (prod=published,
  preview=preview, local=draft) + `ADMIN_TOKEN` + local `OVERLAY_PUBLISH_BASE_URL`,
  deploy, then drop the old flag.
- **Shared Supabase across localhost/preview/prod** (confirmed by founder): data
  is shared; the flag + cache are per-deployment. The builder writes to the
  baseline repo files locally AND (once wired) the overlay.
- Board: nothing pending — fully live, ready for the next prod promote.

## Notes
- Suite **3963/3963**, tsc + eslint clean at handoff.
- Command hygiene: `git -C`/`pnpm -C`, simple commands, no compound/heredocs.
- Auto-merge solo on main is in effect (PRs are traceability-only).
