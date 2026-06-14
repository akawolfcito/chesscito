# Plan — F8 phase (b): Save in arena loss/draw/resign popups

**Date**: 2026-06-14 · **Branch**: `main` · **Spec**: `2026-06-14-save-any-match-collectible.md`
**Gate**: founder confirmed phase (a) verified (2026-06-14). Lifecycle UI = **inline + toast** (founder choice).

## Engine (parent — `app/[locale]/arena/page.tsx`)
- **E1** `mint` hook `result`: `isPlayerWin ? "win" : undefined` → `isEndState ? currentArenaResult() : undefined`
  (`mapArenaResult` already returns win/lose/draw/resigned, never undefined).
- **E2** `canClaim`: drop `isPlayerWin`; add `game.moveCount > 0` (0-move guard, contract reverts on 0).
  New: `isConnected && isCorrectChain && victoryNFTAddress != null && game.moveCount > 0`.
  (Only consumed by the end-state `onClaimVictory`; ArenaEndState only mounts in end state.)

## Component (`arena-end-state.tsx`) — loss/draw/resign branch
- **b1** Save affordance: secondary-styled button (`save.*` icon + price ribbon), label via
  `saveCtaLabelKey(result)` → `saveMatch`. Rendered only when `guardedOnClaim` present
  (guests/no-wallet → hidden, mirrors win). Placed after Coach section, before Play Again.
- **b2 (inline lifecycle)** drive off `claimPhase`:
  - `claiming` → Save button busy (disabled + spinner label), no full takeover.
  - `success` → `MintSuccessToast` (neutral F7) keyed on `claimData.tokenId`; local `toastDismissed` flag.
  - `error|cancelled|timeout` → inline error row + Retry (`onClaimVictory`) + `claimError` text.
- **b3** Hierarchy: Coach stays primary (`primary-on-lose`); Save is secondary; Play Again stays secondary.
- **b4** Neutral confirmation = `MintSuccessToast` (NOT win-themed `VictoryClaimSuccess`).
- **b6** Telemetry: `monetization.save_victory_tap` on Save tap + `save_victory_success` on success,
  both with `result` property. (Names unchanged — dashboard continuity, per spec Q3.)

## Copy (b5)
- Add to `ARENA_COPY` (editorial.ts EN + es.ts ES): `saveMatch` ("Save match" / "Guardar partida"),
  `saveMatchAriaLabel` ("Save match for {price}" / "Guardar partida por {price}").
  No em/en-dashes (anti-ai-prose gate).

## Tests (b7)
- New `arena-end-state.test.tsx`: Save renders on loss/draw/resign when `onClaimVictory` set; hidden
  when absent (guest) and when `moves===0`; tapping fires `save_victory_tap` + calls onClaimVictory;
  claiming→busy; success→toast; error→retry row. Label = "Save match".
- Engine: extend any existing canClaim/result coverage if present; else assert via component props.
- VR: new fixture variants `loss-save`, `loss-save-claiming`, `loss-save-success`, `loss-save-error`
  + baselines (vr9/vr10 family) at 390px.

## Order of commits (granular, run suite each)
1. b5 copy keys (EN+ES) — no behavior.
2. Engine E1+E2 (page.tsx) + test.
3. b1+b3 Save tile (component) + test (red→green).
4. b2 inline lifecycle (claiming/success/error) + test.
5. b6 telemetry result property + test.
6. b7 VR fixture variants + baselines.
7. Handoff + MEMORY sync.
