# Handoff — F8 Save-any-match phase (b): Save in arena loss/draw/resign popups

**Date**: 2026-06-14
**Branch**: `main` (5 commits this session, NOT yet pushed). Head = `e71c66cf`.
**Spec**: `docs/superpowers/specs/2026-06-14-save-any-match-collectible.md` + `-phase-b-plan.md`
**Resume trigger**: user says **"continuemos"** → see NEXT.

## What shipped this session (phase b — code complete, local)
Commits `de8a18c2`..`e71c66cf`. SDD→TDD→EDD. Suite **3725/3725** (+9 new).

Phase (a) gave the Match Review viewer a Save path for any outcome. Phase (b)
brings Save directly to the arena loss/draw/resign popup (`arena-end-state`),
which previously had Play Again + Coach only — no mint state machine.

- **`de8a18c2` copy** — `ARENA_COPY.saveMatch` / `saveMatchAriaLabel` (neutral
  non-win label) + `saveError` / `saveRetry` (inline failure row). EN + ES, no
  em-dashes.
- **`7229a5e7` engine** (`app/[locale]/arena/page.tsx`) — the win-only gate is
  gone: `mint` hook now feeds the real `mapArenaResult(...)` (was
  `isPlayerWin ? "win" : undefined`); `canClaim` drops `isPlayerWin`, adds
  `game.moveCount > 0` (contract reverts on 0 moves). Win flow byte-unchanged.
- **`b89f0d2e` component** (`arena-end-state.tsx` + `globals.css` + test):
  - **b1/b3** secondary Save tile in the loss branch (Coach stays primary),
    label via `saveCtaLabelKey(result)` → "Save match", optional price ribbon.
    Hidden for guests (no `onClaimVictory`), unpersisted records, and 0-move
    games (`guardedOnClaim && !isTooShort` — double-blocked with the contract).
  - **b2/b4 inline lifecycle** (founder choice, NOT win-themed full takeover):
    busy button while `claimPhase==="claiming"`, neutral `MintSuccessToast`
    (F7) on success keyed on tokenId, inline red retry row on
    error/cancelled/timeout. New hooks (`saveToastDismissed`,
    `saveSuccessFiredRef`) run guarded by `!isPlayerWin`.
  - **b6** `monetization.save_victory_tap` / `_success` fire with a `result`
    property (+ existing `context`); event names unchanged (dashboard
    continuity). Mirrors the win path's events.
  - New `arena-end-state.test.tsx` (9 cases): render/hide gates, label,
    tap→telemetry+onClaimVictory, claiming busy, success toast, error retry.
- **`e71c66cf` VR** — 4 fixture variants (`loss-save{,-claiming,-success,-error}`)
  + baselines at 390px minipay. **Visually verified** all four: Coach primary,
  Save secondary w/ "$0.005" ribbon, green "Saved on-chain · #42" toast on
  success, red "Insufficient gas… RETRY" row on error. Existing loss baselines
  unchanged (moves=0 keeps Save hidden).

## Acceptance criteria — phase (b) status
- [x] `arena-end-state` loss/draw/resign renders a Save affordance.
- [x] Full mint lifecycle (claiming/success/error) wired on the loss popup.
- [x] Save label "Save match" (EN+ES), `saveCtaLabelKey` drives it.
- [x] 0-move games never show Save (UI), regression-tested.
- [x] `save_victory_tap/_success` carry `result`; names unchanged.
- [x] VR baselines refreshed for the new Save states.
- [x] Full unit suite green (3725/3725); em-dash gate green.

## NEXT (in order)
1. **Push `main`** (5 commits unpushed) — `production` untouched.
2. **Founder manual smoke of phase (b)**: play & LOSE in `/en/arena` → on the
   loss popup tap **Save match** → confirm real mint + the green Saved toast,
   then test a failed mint (reject in wallet) shows the retry row. (Not
   smoke-testable headless — needs wallet + gameplay.)
3. After founder OK → **Cluster Closure Protocol** (CLAUDE.md): close the F8
   issue/milestone, README "What's live" if changed, MEMORY sync to "shipped",
   branch hygiene.

## Deferred / backlog (non-blocking, carried from phase a)
- Pre-existing tsc errors in `src/lib/coach/__tests__/use-mint-victory.test.ts`
  (lines 344, 405 — "No overload matches"). Present on clean HEAD, NOT from this
  work; vitest ignores them (3725 green). Clean up in a separate chore.
- Inline loss error row loses the win path's rich recovery (`AddCashCta`
  MiniPay deeplink on insufficient funds). Accepted trade for the neutral inline
  treatment (founder chose inline+toast). Revisit if loss-save conversion shows
  funnel drop on funding failures.
- OG match card still byte-identical for win/lose/resigned (outcome-specific OG
  art = backlog). Dead props `shareLinkUrl`/`shareStatus`. Anti-cheat cosmetic
  (session-binding deferred unless collectibles feed rewards).

## VR gotcha (if you touch baselines again)
`test:e2e:visual` reuses an existing :3000 dev server + stale `.next`. This
session used a clean server: `rm -rf .next` + `PORT=3947 pnpm dev` +
`BASE_URL=http://localhost:3947 ... --update-snapshots`. New PNGs write fresh
(no stale-diff trap); only *updating* existing baselines needs the full dance.
