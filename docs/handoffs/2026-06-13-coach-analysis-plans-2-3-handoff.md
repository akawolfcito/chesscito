# Handoff — Coach analysis cluster, Plans 2 & 3 COMPLETE (branch ready to merge)

**Date:** 2026-06-13
**Branch:** `feat/coach-analysis-value` (NOT merged; all 3 plans now ride it)
**Spec:** `docs/superpowers/specs/2026-06-13-coach-analysis-value-design.md` (v3)
**Prior handoff:** `docs/handoffs/2026-06-13-coach-4button-plan1-handoff.md` (Plan 1)

## Status: all 3 plans shipped to the branch

- **Plan 1** (prior session) — 4-button action model + single-tap idempotency.
- **Plan 2** (this session) — Render-A redirect fix.
- **Plan 3** (this session) — cost ribbon + outcome-specific viewer copy.

Full web unit suite: **3702/3702**. VR vr9 + vr10 regenerated + green (no `--update`).

## Plan 2 — Render-A (2 commits)
- `9300f674` — `use-coach-analysis.ts`: moved the `!analyzeGameId` not-persisted
  check BEFORE the Peón/credit spend, so a no-gameId tap never debits. Removed the
  now-unreachable post-spend duplicate guard.
- `8b3d830a` — extracted `lib/coach/coach-redirect.ts`
  `shouldRedirectToCoachViewer(phase, response)`; `arena/page.tsx` now redirects to
  `/coach/[id]` ONLY on a persisted `full` result (phase `result`), never on
  `fallback`. Kills the empty Match Review (founder bug). Fallback renders inline in
  the arena popup (existing degraded path); loading stays in the arena `CoachLoading`
  poller. 5 helper tests + 1 hook guard test.

## Plan 3 — cost ribbon + outcome copy (5 commits)
Founder decisions this session: **keep the already-shipped lose/draw copy** (friendly
"Let's see what happened." / "How did this end?", + ES), and **ribbon on all 4 coach
CTAs** (spec listed 3; arena-end-state loss/draw/resign is the 4th).
- `afa64bae` — `components/coach/coach-cost-ribbon.tsx` `CoachCostRibbon` + CSS
  `.coach-cost-ribbon` (variants `--cta` corner / `--tile` centered; `--pro` crown
  / `--peon` w-pawn). Decorative (aria-hidden); cost reaches AT via labels/hints. 5 tests.
- `24bc7956` — ribbon on win popup coach CTAs (victory-celebration + victory-claim-success).
- `6e6c5464` — ribbon on arena-end-state loss/draw/resign CTA (threaded `proActive`).
- `185ecef4` — viewer (game-actions-bar): outcome-specific pre-analysis Ask Coach label
  (askCoachWin/Lose/Draw, resigned=lose; EN editorial + ES catalog) + tile ribbon. 8 tests.
- `e51eabd2` — gate ribbon to reachable (`!disabled`) CTAs so no cost shows on a
  disabled/too-short action; refreshed vr9 (6 popups) + vr10 (6 viewer) baselines,
  visually validated at 390px. TX-state vr9 baselines untouched (no coach CTA).

## Currency model (debt logged)
To the user the coach currency is the **Peón** ("♟ 1"); the backend credits-first
consumption (3 seeded credits → Peones → paywall) is an implementation detail. Backlog:
unify Coach credits → Peones in the backend (aligns with the planned rename).

## VR gotcha discovered (worth remembering)
`pnpm test:e2e:visual` reuses an existing dev server (`reuseExistingServer`) and a
stale `.next` cache served pre-edit client JS — baselines came out without the ribbon
even though SSR/curl + a clean-browser screenshot showed it correctly. Also Playwright
1.58 `--update-snapshots` only rewrites *changed* shots; a sub-1% ribbon diff was kept
as "unchanged" against the stale baseline. **Fix:** `rm -rf .next`, start a fresh
`PORT=39xx pnpm dev`, point Playwright at it via `BASE_URL`, and `rm` the target
baselines (force "missing" → always rewritten) before `--update-snapshots`.

## Deferred / known limitations (harmless)
1. Viewer can't distinguish guest from free-connected (both `proActive=false`); the
   ribbon shows "♟ 1" for non-PRO in the viewer. Guest=no-ribbon (spec) only matters
   in arena quick-review, where the wallet is present.
2. Plan 1 dead props still pending cleanup: `shareLinkUrl` (GameActionsBar),
   `shareStatus` (VictoryClaimSuccess).
3. `CoachAnalysisCta` `secondary-on-win` branch is now unused (only `primary-on-lose`
   is called); safe to prune later.

## NEXT
- **Decide merge/PR** for `feat/coach-analysis-value` (local-only; `main`/`production`
  still at `04dfb1a5`). All 3 plans are a clean, shippable milestone.
- On merge, run Cluster Closure Protocol (README/MEMORY sync, branch hygiene, smoke).
- Open product question (founder): save non-victory matches? (Save is win-only today.)
