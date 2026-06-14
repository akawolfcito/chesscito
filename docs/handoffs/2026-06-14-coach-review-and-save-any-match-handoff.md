# Handoff — Coach review fixes + Save-any-match F8 phase (a)

**Date**: 2026-06-14
**Branch**: `main` (all pushed; `origin/main` = `30b41e48`). `production` untouched.
**Resume trigger**: user says **"continuemos"** → start **F8 phase (b)** (see NEXT).

## What shipped to main this session

### Founder review of the coach-analysis cluster — 8 of 9 fixes (F1–F7, F9)
Commits `07fc211f`..`2cc4989e`. All in `main`, smoke PASS, suite green.
- **F1** ribbon escaped the button → added `position:relative` to
  `.arena-result-primary-cta--amber` (anchors all 3 arena coach CTAs).
- **F2** loading "Coach is thinking" → forest panel shell (`VictoryPopupShell`),
  dropped the cream `CandyGlassShell`.
- **F3** PRO chip → text-only "PRO" (removed crown icon); free keeps "♟ 1".
- **F4** analysis not visible on first land → removed the #116 RSC prefetch
  (it cached a pre-analysis snapshot); the redirect push now fetches fresh.
- **F5** viewer Ask Coach label → reverted to neutral "Ask Coach" (outcome
  copy stays on arena popups only). Ribbon kept.
- **F6** 0-move close → routes to the Journal (`/coach/history`) + added a PLAY
  shortcut there (was an empty `/coach/[id]` board). `evaluateXClose` gained a
  `tooShort` flag.
- **F7** save confirmation → `MintSuccessToast` ("✓ Saved on-chain · #N") in the
  viewer on every save/re-save.
- **F9** token "#N" chip → folded into the Match Review header subtitle.
- VR `vr9`/`vr10` baselines refreshed + validated at 390px.

### F8 — Save any match outcome (phase a)
Spec: `docs/superpowers/specs/2026-06-14-save-any-match-collectible.md` (+ `-redteam.md`).
Commits `43e9aff3`, `3b1ca367`, `30b41e48`. SDD→TDD→EDD, suite **3716/3716**.
- **Contract is outcome-agnostic** (verified `VictoryNFTUpgradeable.mintSigned`:
  no result field, no win branch). **No contract change.**
- Backend `sign-victory`: `replayForLegality` (dropped checkmate + mate-by-player
  asserts) + anti-cheat heuristic #1 (`timeMs >= totalMoves * 250ms`).
  `playerColor` kept but inert.
- `use-mint-victory`: `result` widened to `CoachGameResult`; canClaim drops the
  `=== "win"` requirement.
- Viewer passes the real result into the mint (was hardcoded "win"); Save tile
  renders on every outcome via `saveCtaLabelKey(result)` → "Save Victory" (win) /
  "Save match" (non-win, new `COACH_VIEWER_COPY.saveMatch` EN+ES).
- Funnel: `coach_viewer_mint_tap` carries `result`.
- **Anti-cheat posture = cosmetic** (founder-approved): collectible = "a legal
  game I submitted"; not tied to ranking/reward, so forging buys only vanity.
  Session-binding deferred (reopen only if collectibles ever feed rewards).

## Smoke (preview `chesscito-lnl5eiu42`, Ready) — PASS
- Routes 200: `/`, `/en/hub`, `/en/arena`, `/en/coach/history`, `/en/exercises`, `/en/about`.
- `sign-victory`: legal non-mate → 200 (was 400); win → 200; illegal → 400;
  timing 500ms/4moves → 400 "Implausible move cadence"; bad origin → 403.
- OG cards `result=win|lose|draw|resigned` → all 200 image/jpeg (spec Q2 resolved).

## Pending — founder manual verify of F8 phase (a)
NOT smoke-testable (needs wallet + gameplay): play & LOSE in `/en/arena` →
Match Review → tap **Save match** → confirm the loss mints + the F7 toast fires.
Do this before phase (b).

## NEXT — F8 phase (b): Save in the arena loss/draw/resign popups
Scope (from spec/red-team; b2 is the big one):
- **b1** Save affordance in `arena-end-state` loss/draw/resign layout (today:
  Play Again · Coach · Share, no Save).
- **b2** Wire the full mint lifecycle there (claiming/success/error) — these
  popups have NO mint state machine (only the win `VictoryCelebration` path does).
- **b3** Button hierarchy: where Save sits vs Coach Review (the loss/draw primary).
- **b4** Neutral post-save confirmation (`VictoryClaimSuccess` is win-themed) or reuse the toast.
- **b5** `saveMatch` copy in the arena i18n namespace (helper already exists).
- **b6** `monetization.save_victory_tap/success` + `result` property (phase a only
  did the viewer's `coach_viewer_mint_tap`).
- **b7** VR baselines for the loss/draw/resign popups with Save + lifecycle states + tests.

## Deferred / backlog (non-blocking)
- OG match card does NOT visually differ by outcome (win/lose/resigned are
  byte-identical, ~117KB; draw differs). Outcome-specific OG art = backlog.
- Plan-1 dead props `shareLinkUrl` (GameActionsBar) / `shareStatus`
  (VictoryClaimSuccess); `CoachAnalysisCta secondary-on-win` unused.
- Backend Coach credits → Peón unification (currency-model debt).
- VR fixtures don't pass `claimPrice`, so Save tiles render without the price
  ribbon in baselines (cosmetic gap, all variants).

## Manual QA reference
`docs/reviews/2026-06-13-coach-cluster-manual-qa.md` (the F1–F9 checklist).
