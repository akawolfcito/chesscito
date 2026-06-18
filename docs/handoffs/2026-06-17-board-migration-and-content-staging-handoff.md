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

## Next: remaining content-staging slices (resume here)
Continue the `/tdd` cycle, one slice per PR:
1. **Slice 2 — migration + RPC**: alter `content_overlay`: PK → `(kind,id,stage)`,
   add `stage text not null default 'draft' check (...)`, down-script; add the
   `promote_content(kind,id,from,to)` `plpgsql` RPC (delete rows ≤ rank(to) except
   the moved one + update stage, in ONE transaction). Commit-only (hosted apply =
   deploy). Integration test on local Supabase (`npx supabase start`).
2. **Slice 3 — read path**: `merged-catalog.ts` `fetchOverlayRows` filters by
   `visibleStages(envStageFloor())` then `resolveVisibleRows`; cache with
   `revalidate: 60`; `/exercises` boundary gates on `envStageFloor()` (not the old
   flag). Per-env-tier tests.
3. **Slice 4 — promote route**: `POST /api/admin/content/stage` → calls the RPC,
   revalidates own tag (no fan-out). Tests: promote/demote/skip-stage/404/bad-token.
4. **Slice 5 — retire flag + UX**: remove `CONTENT_OVERLAY_ENABLED` /
   `overlay-flag.ts`; builder Save labels "Saved as draft" (promote UI = later
   follow-up). Fold remaining red-team P1s (cache key includes stage floor,
   `from` mismatch error message).

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
