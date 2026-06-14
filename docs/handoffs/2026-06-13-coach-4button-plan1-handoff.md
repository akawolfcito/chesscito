# Handoff — Coach 4-button action model (Plan 1 of 3) SHIPPED to branch

**Date:** 2026-06-13
**Branch:** `feat/coach-analysis-value` (NOT merged; Plans 2 & 3 ride the same branch)
**Spec:** `docs/superpowers/specs/2026-06-13-coach-analysis-value-design.md` (v3)
**Plan:** `docs/superpowers/plans/2026-06-13-coach-4button-action-model.md`
**Red-team:** `docs/superpowers/specs/2026-06-13-coach-analysis-value-redteam.md`
**RCA:** `docs/handoffs/2026-06-13-coach-victory-flow-bug-rca.md`

## What shipped (Plan 1 — subagent-driven, all reviewed)

The action set **Play Again · Save · Share · Ask Coach** is now 4 independent,
always-present actions across the victory popup AND Match Review. This kills the
Save↔Trophy mutual exclusivity that produced the founder's "Save reappeared after I
saved" confusion. **Unlimited re-save is intended** (each save mints a collectible the
user pays for knowingly) — no guard blocks re-save or PRO re-purchase.

Commits (on `feat/coach-analysis-value`):
- `a3afef4d` + `1be1de7a` — Save tile stays on win after minting (T1)
- `a86b06f9` — Share on loss/draw match review (T2)
- `f97f7e1e` — 4-tile CSS (`data-count="4"`); the `share` i18n key already existed (T3)
- `5fd8df01` + `6435c896` — Share independent of mint + removed a duplicate `share`
  i18n key (T3 wrongly added it; it pre-existed) + dead match-card code (T4)
- `395841ab` + `3daea6d7` — post-save popup gained always-Share + Save-again
  (`onSaveAgain={guardedOnClaim}`, gated on persisted record) (T5)
- `05d023d3` — regression-lock test for single-tap mint idempotency (`claimingRef`) (T6)
- `945381f2` — `mint-receipt` accepts re-save (latest tokenId wins, no more 409) (T7)
- `c7b2f3f6` — refreshed 6 `vr10-coach-viewer-*` VR baselines (4-tile row), diffs
  visually validated at 390px (T8)
- `c2635779` — **integration fix:** `handleShare` in the viewer was a silent no-op on
  loss/unminted (used a null-terminated link); now falls back to `SHARE_COPY.url`
  like `shareLinkEffective`. + JSDoc slate refresh.

## Verification
- Full web unit suite: **3686/3686 passing** (was 3623 baseline; +tests).
- VR: `vr10-coach-viewer-*` refreshed + green; `vr9-arena-end-state-win-success` passed
  unchanged (its fixture does not exercise the new popup Save — see deferred items).
- Each task got per-task spec + quality review; a final holistic review caught the
  Share no-op (now fixed).

## Deferred / minor cleanup (noted by reviews, harmless, NOT blocking)
1. **Dead props (Minor):** `shareLinkUrl` on `GameActionsBar` and `shareStatus` on
   `VictoryClaimSuccess` are now unused (Share unconditional; `isShareReady` removed).
   Remove from Props + call sites in a cleanup pass. No behavior impact.
2. **VR fixture gap:** the `vr9-arena-end-state-win-success` fixture should pass
   `onSaveAgain` so the new post-save Save button is covered by a baseline.
3. **Viewer share is generic on unminted:** `navigator.share` shares `SHARE_COPY.url`
   (canonical site), not a match-specific card/page, when never minted. A match share
   PAGE (OG card as preview) for unminted games is a backlog feature. The popup path
   (ShareModal) already shows the `/api/og/match` card.

## Open product question for founder
- **Loss saveability:** Save = mint a *victory* collectible, so it is win-only today
  (loss/draw show Play Again · Share · Ask Coach). Confirm if a "save any match"
  collectible is ever wanted.

## NEXT — Plan 2 (Render-A lean), the higher-value fix
The original bug the founder reported (coach analysis never renders, lands on empty
Match Review) is **Plan 2**, not yet started. Render-A approach (no new dependency):
- Redirect to `/coach/[gameId]` ONLY on phase `result` (persisted), never on
  `fallback` (`arena/page.tsx:737`/`745`) — render fallback inline in the arena popup.
- Loading stays in the arena popup (existing `CoachLoading` poller); navigate only
  after persistence. Viewer cold-loads the persisted analysis (unchanged).
- Guard the empty-gameId Peón/credit spend (`use-coach-analysis.ts:196`) — move the
  not-persisted check before the spend.
See spec Plan 2 section. Then Plan 3 = cost ribbon on Ask Coach (Peón unified,
outcome-specific copy win/lose/draw/resigned).

## Recommendation
Plan 1 is a clean, shippable milestone. Given session length, start Plan 2 in a fresh
session (write its impl plan, then subagent-driven execution) to keep quality high.
Branch is local-only; decide merge/PR after Plan 2-3 or ship Plan 1 alone if desired.
