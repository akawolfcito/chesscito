# UX-review Minors Sweep — Session Handoff

**Date:** 2026-06-14
**Branch:** `main` = `origin/main` = `4dffc5f0` (all pushed; `production` untouched)
**Build:** affected unit suites green all session; `tsc` clean except 2 pre-existing
errors in `use-mint-victory.test.ts:344,405` (vitest ignores them; chore tracked
separately). Zero VR baseline churn this whole sweep.

## Context
Follow-on to the F8 cluster closure (`docs/handoffs/2026-06-14-f8-cluster-closure-handoff.md`).
Worked the remaining Minors in `docs/reviews/ux-review-2026-06-14.md`, skipping
or deferring the ones that are design calls / need assets / touch the fail-closed
rail. Cross-checked each before acting (the coin-emoji lesson) — two findings were
deliberately NOT applied as written.

## Shipped this sweep (9 minor commits, `4d04f135`..`4dffc5f0`)
- `4d04f135` #71 — ClaimSuccess: 3rd action spans full-width (`--triple`) to kill
  the 2-col grid orphan. No fixture exercises the triple state (still no VR cover).
- `355355f5` #85 — Coach: short `analysisPendingTile` ("Analyzing…") for the ~85px
  Ask Coach tile; banner keeps the long copy.
- `5dd6a495` #86 — Coach: removed dead `shareLinkUrl` prop from GameActionsBar
  (Share is parent-owned `onShare()`); also dropped orphan `shareLinkEffective`.
- `805a548e` #92 — Payments: Get Peones success "Done" → PrincipalButton.
- `cbabbb94` #96 — i18n: hardcoded `<span>Celo</span>` → PROFILE_COPY.networkValue.
- `553d8a78` #98 — a11y: hub "Start here" ribbon no longer aria-hidden.
- `76621240` #90 — Exercises: mission-sheet Save buttons keep a "Saving…" label
  beside the spinner (new MISSION_DETAIL_COPY.saving, EN+ES).
- `04890104` #81 — Arena: removed dead `secondary-on-win` branch from
  CoachAnalysisCta + orphan i18n keys + `.arena-result-coach-wrap` CSS (−64 lines).
- `41a23ae7` #84 — a11y: honest "Close" aria on the 5 result-popup X's
  (`ARENA_COPY.closeResultAria`); `evaluateXClose` never routes to /hub, so
  "Back to Hub" lied. `backToHubAria` kept on the genuine back controls.
- `4dffc5f0` #82 — Arena: mint error copy names the collectible
  ("Couldn't save your collectible") so it reads distinctly from the off-chain
  "Match not saved" persist error, without breaking the shared rose error visual.

## NOT applied (cross-check / deferred — decisions, not bugs)
- **#88** tokenId vs receipt — considered DONE. The T1 relabel "View receipt"
  makes the tx-hash link consistent (a receipt = the transaction). Whether the
  header `#N` should be independently viewable on the token page is a product
  decision, deferred.
- **#91** 3 stacked pills (nowLabyrinth brown / saveScore green / saveOnChain
  brown) — design call. Green may be intentional (free save vs on-chain premium).
  Not unified unilaterally.

## Remaining Minors (none are "clean" — each needs a decision or an asset)
- #91 unify pill colors → founder design call.
- #93 AddCashCta renders null off-MiniPay → insufficient-balance has no web
  recovery. Touches the fail-closed payment rail → needs care.
- #94 CoachPaywall `h-[100dvh]` empty gap → is the takeover intentional?
- #95 dock locked 44px → already the a11y minimum; likely WONTFIX.
- #97 hub-splash dashed placeholder → needs a real art asset.

## Deferred Majors (own specs)
- Sheet-framing unification (4 shells = redesign).
- coin-emoji credits→Peón (blocked on backend credits→Peón unify).
- VR coverage for the ClaimSuccess `--triple` state.

## Blockers / open questions
- 2 pre-existing `tsc` errors in `use-mint-victory.test.ts` (chore, not this work).
- No blockers — the clean Minors are exhausted; what remains needs founder input.

## Notes
- `production` is the pre-launch stable snapshot — promote is a separate explicit step.
- Read first next session: `docs/reviews/ux-review-2026-06-14.md` (remaining
  Minors/Majors) + this handoff.
