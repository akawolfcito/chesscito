# F8 Save-any-match — Cluster Closure Handoff

**Date:** 2026-06-14
**Branch:** `main` (= `origin/main` = `6d03bdf5`, all pushed; `production` untouched)
**Build:** unit suite green on touched surfaces (84/84 + 64/64 + 13/13 across the session); `tsc` clean except 2 pre-existing errors in `use-mint-victory.test.ts:344,405` (vitest ignores them; chore tracked separately).

## What this cluster was
F8 = **Save any finished match** (win / loss / draw / resign) as an on-chain
collectible, not just victories. Phases a + b shipped earlier (see
`docs/handoffs/2026-06-14-save-any-match-phase-b-handoff.md`). This session
ran the **UX audit minors** from `docs/reviews/ux-review-2026-06-14.md` and
then executed the **Cluster Closure Protocol**.

## Shipped this session (8 commits, `f06fe369`..`6d03bdf5`)
Audit-driven minors:
- `4d04f135` — Arena ClaimSuccess: 3rd action spans full-width (`--triple`
  modifier) to kill the 2-col grid orphan. Defensive: only when `onSaveAgain`
  is set; 2-button case unchanged. **No VR fixture exercises the triple state**
  (win-success fixture has `onClaimVictory=undefined` → only 2 buttons) → fix
  is currently without visual coverage. Follow-up: add a triple-state fixture.
- `355355f5` — Coach: dedicated short `analysisPendingTile` ("Analyzing…",
  EN+ES) for the ~85px Ask Coach tile; the inline banner keeps the long copy.
- `5dd6a495` — Coach: removed dead `shareLinkUrl` prop from `GameActionsBar`
  (Share was refactored to a parent-owned `onShare()` callback long ago; prop
  was declared+destructured but never referenced). Also dropped the now-orphan
  `shareLinkEffective` in `coach-game-client`. **Prop stays live** in
  mint-receipt / arena / daily / victory-claim — only GameActionsBar dropped it.
- `805a548e` — Payments: Get Peones success "Done" promoted from a weak
  secondary text-link to `PrincipalButton`.
- `cbabbb94` — i18n: hardcoded `<span>Celo</span>` in profile-sheet → new
  `PROFILE_COPY.networkValue` (EN+ES). Closes a T2 hardcoded-English gap.
- `553d8a78` — a11y: hub "Start here" onboarding ribbon no longer
  `aria-hidden` → announced to screen readers.

Cluster closure:
- `6d03bdf5` — README "What's live" synced: Arena bullet + section now say
  "save any finished match" (was victory-only). NFT terminology kept (README is
  repo/technical-facing, N3 — the UI de-jargon brief T1 does not apply here).

## Cluster Closure Protocol — status
1. **GitHub housekeeping** — ✅ N/A. No F8 issue or milestone ever existed
   (F8 was tracked informally via memory/handoffs and worked directly on
   `main`, no feature branch). Only 3 open issues remain, all future backlog:
   #104 (M14 Treasure hunt), #101 (M13 Prize pool v2), #67 (M13 Exercise world map).
2. **README sync** — ✅ done (`6d03bdf5`).
3. **MEMORY.md sync** — ✅ updated (F8 → shipped/closed).
4. **Branch hygiene** — ⚠️ **DEFERRED, needs founder OK.** ~20 stale remote
   branches predate F8 (board-renderer, rook-*, scoreboard-contract, sprint-ui-*,
   etc.). None belong to F8. Deleting remote branches on the shared origin is
   semi-destructive → not mass-deleting without confirmation + per-branch
   `git log origin/main..origin/<branch>` merge verification. See "Next tasks".
5. **Handoff doc** — ✅ this file + `SESSION.md`.

## Next tasks
1. **Branch hygiene decision** (founder): approve a sweep of the ~20 stale
   remote branches. Procedure per branch: `git log origin/main..origin/<branch>`
   — if no unique commits (fully merged), `git push origin --delete <branch>`;
   if unique commits exist, keep or archive. List them with
   `git branch -r | grep -vE 'origin/(main|production|HEAD)'`.
2. **Remaining ux-review minors** (lower value / more care): AddCashCta null
   off-MiniPay has no web recovery (#93, touches fail-closed rail); CoachPaywall
   `h-[100dvh]` empty gap (#94, is it an intentional takeover?); hub-splash
   dashed placeholder (#97, needs art asset); dock locked 44px (#95, already the
   a11y minimum).
3. **Deferred Majors** (own specs): sheet-framing unification (4 shells =
   redesign); coin-emoji credits→Peón (blocked on backend credits→Peón unify).
4. **VR coverage** for the ClaimSuccess `--triple` state (add fixture variant).

## Blockers / open questions
- Branch hygiene needs founder sign-off (semi-destructive on shared remote).
- 2 pre-existing `tsc` errors in `use-mint-victory.test.ts` (chore, not F8).

## Notes
- `origin/main` = `6d03bdf5`; `production` intentionally untouched (pre-launch
  stable snapshot — promote is a separate explicit step).
- Read first next session: `docs/reviews/ux-review-2026-06-14.md` (remaining
  minors/majors) + this handoff.
