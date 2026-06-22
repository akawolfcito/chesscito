# Red Team Review — exercises-save-flow-simplification

**Date**: 2026-06-21
**Reviewer mindset**: hostile QA + senior engineer

---

## Findings

### P0 — Must address before implementation

**[LITE GATE LEAKS] `getContextAction` still returns `"connectWallet"` for disconnected Lite users when `badgeEarned`**
- The spec says "suppress `connectWallet` when the only pending action would be `submitScore` in Lite" (Behavior §22). But `getContextAction` also returns `"connectWallet"` when `badgeClaimable=true && !isConnected` — and badge claim is valid in Lite. This is NOT suppressed and shouldn't be. The spec text conflates two cases: (a) connectWallet for score-only → suppress in Lite ✓; (b) connectWallet for badge-only → keep in Lite ✓. The condition "the only pending action would be `submitScore`" captures (a) correctly, but the spec implementation notes are ambiguous. The contract must be precise: suppress `"connectWallet"` in Lite **only when `!badgeClaimable && scorePendingNew`** (i.e., score is the only pending action).
- Why blocking: mis-implementation would hide the wallet CTA a Lite player needs to claim their badge — they'd complete a piece and see nothing actionable.
- Fix: tighten the Behavior §22 wording and update `getContextAction` tests to cover this path explicitly.

**[TIMING RACE] "Saved" toast fires simultaneously with WELL DONE phase-flash**
- Behavior §4 says the toast fires "after the auto-advance timer (1 500 ms), not simultaneously." But the auto-advance is scheduled with `autoReset.schedule(() => ..., 1500)`. If the toast is wired inside `handleMove` BEFORE the `autoReset.schedule` call (which is the natural insertion point), it will fire immediately on `setPhase("success")`, competing visually with the WELL DONE flash. The spec must define the EXACT callsite. Looking at `exercises-screen.tsx:1522–1591`, `setPhase("success")` and `completeExercise` fire synchronously; `autoReset.schedule` fires 1 500 ms later. The toast must fire at the START of the `autoReset.schedule` callback, not at `completeExercise` time.
- Why blocking: fires a "Saved" over the celebratory flash — wrong emotional beat, makes WELL DONE illegible.
- Fix: specify callsite explicitly: toast fires inside the `autoReset.schedule` callback, the first line before the labyrinth/advance/complete branch.

**[LABYRINTH PATH BREAK] "Saved" toast must be suppressed during labyrinth mode**
- The spec covers exercise completion but the `autoReset.schedule` callback also fires for labyrinth completion (via `handleLabyrinthSelect`). Labyrinth completions use a DIFFERENT state path (`setLabyrinthCompleted`) — the "Saved" toast must not fire there. Labyrinths write `recordLabyrinthBest` (not `completeExercise`) and have their own overlay.
- Why blocking: would show "Saved" over the labyrinth completion overlay, which already shows star count and "New best!" — wrong signal.
- Fix: add a guard: toast only fires when NOT in labyrinth mode (`!labyrinthMode`) and inside the exercise success path specifically.

**[WELCOME PACK CTA LOCATION] Spec doesn't define WHERE the inline CTA renders in Exercises**
- Behavior §13 says "surface inline in the Exercises screen" but does not specify the layout slot. The exercises screen has: mission panel top, board center, contextual action slot below board, persistent dock bottom. Placing it in the wrong slot breaks mobile layout (overlaps board or creates a second action-carpet below the board).
- Why blocking: ambiguous slot → implementer guesses → layout breakage, likely duplicate visual with the existing ContextualActionSlot.
- Fix: specify the render slot. Recommendation: below the board in the same slot as the ContextualActionSlot — when `welcomePack.state !== "claimed"` and no other CTA is pending, render WelcomePack claim; when badge claim is also pending, badge claim takes priority (matching the existing "one resolutive CTA" pattern).

---

### P1 — Should address

**[SCORE PARITY GHOST] In Full, `isSavedAtParity` state leaves no save CTA but no feedback either**
- Currently when `isSavedAtParity = true` (local score == last saved score), no button appears — that's correct. But the player sees no confirmation. After this spec lands, the "Saved" local toast fires on EVERY exercise completion regardless. This means that after saving on-chain and then replaying the same piece, the player sees "Saved" (local) but the on-chain Save button is gone. Some players may interpret the local "Saved" as their score being freshly submitted on-chain. Copy must distinguish or the local toast must be visually minimal enough not to imply blockchain persistence.
- Risk if ignored: user confusion in Full — "I got 'Saved' so why isn't my score in the leaderboard?" is a likely support scenario.
- Recommendation: keep the local "Saved" toast as-is (it IS saved locally), but ensure the leaderboard entry point (dock tab) remains the signal for on-chain status.

**[LITE + BADGE CLAIM + WRONG CHAIN] No inline "Switch network" guidance in Lite**
- In Full, `getContextAction` can return `"switchNetwork"` when wallet is connected but on wrong chain. In Lite, this is still valid (badge claim needs correct chain). But the spec says nothing about the network-switch path in Lite — it should be preserved. The existing `ContextualActionSlot` already handles `"switchNetwork"` generically. This likely "just works" but the spec should call it out to avoid a Lite-mode PR that strips the switch path.
- Risk if ignored: Lite player with wrong network sees nothing actionable even though they have an earned badge.

**[WELCOME PACK STATE HYDRATION] SSR renders wrong state on first paint**
- `useWelcomePackClaim` initializes from `readCache(walletLower)` (localStorage). On SSR (or cold mount before effect fires), `walletLower` is undefined and the initial state is `"connect"` or `"idle"`. The effect updates async from `/api/welcome-pack/status`. If the inline CTA renders on SSR, it will flash from visible → invisible (or vice versa) during hydration.
- Risk if ignored: layout shift on the Exercises screen on first load in MiniPay — the existing ShopSheet avoids this because it's behind a tap. Inline CTA is always-on-mount.
- Recommendation: gate the inline CTA render with `welcomePack.state !== "claimed" && welcomePack.state !== "claiming"` AND only render client-side (after hydration). The existing pattern uses `useEffect` hydration — match it.

**[CONNECT PROMPT — INCORRECT SUPPRESSION GUARD]**
- Behavior §9: "the 'Connect to save' prompt is suppressed in Lite". The prompt fires at `exercises-screen.tsx:1530`: `if (!isConnected && computeStars(movesCount, currentExercise.optimalMoves) === 3) { starsConnectPrompt.show(); }`. Adding `&& !CHESSCITO_LITE_MODE` here is a single-line fix. But the spec doesn't call this out as a concrete code location. If the implementer looks in `context-action.ts` instead (wrong file), the suppression is missed.
- Risk if ignored: Lite players on perfect exercise see "Connect to save your score" — which implies an on-chain save that doesn't exist in Lite.

---

### P2 — Nice to clarify

**[COPY KEY AUDIT] "Saved" toast key may already exist**
- The spec says "Add `"Saved"` / `"Guardado"` key if not already present." The existing `showToast` calls use already-translated strings (e.g., `tFooter("submitCanceled")`). `FOOTER_CTA_COPY` in `editorial.ts` should be audited before adding a new key — it may already have a "saved" variant. If it doesn't, the new key must be added to both `en.json` and `es.json` i18n catalogs, not just `editorial.ts`.

**[ON-CHAIN SAVE BUTTON — DUAL PATH CONFUSION]**
- The spec correctly hides both `submitScore` (off-chain) and `handleSaveScoreOnChain` (on-chain) in Lite. But the spec's "action audit table" lists "Save Score (off-chain)" and "Save Score (on-chain)" as separate rows — which they are at the handler level, but they share the same `"submitScore"` action type in `getRewardActions`. The on-chain path (`handleSaveScoreOnChain`) is triggered separately in the JSX from the off-chain path — spec should clarify which JSX site each maps to, or the implementer may only suppress one.

**[BADGE CLAIM PRIORITY IN LITE — SPEC VS CODE]**
- Behavior §11 says badge claim is the "PRIMARY on-chain action" in Lite. The existing `getContextAction` already returns `"claimBadge"` before `"submitScore"` (Badge > Score priority at line 46–47 of `context-action.ts`). Since `submitScore` is suppressed in Lite, badge claim naturally becomes the only remaining action without any code change to priority order. The spec claim about "primary" is correct by deletion, not by new priority logic. Clarify this to avoid accidental re-ordering.

---

## Categories audited

### Contract gaps
- `RewardActionOptions.liteMode` is `boolean | undefined` (optional). Should the default be `false` (Full behavior) — yes, that's implied but should be explicit in the type.
- `LocalSaveFeedback` type is defined in the spec but never consumed — it's informational. The actual implementation uses the existing `showToast` string function, not a typed feedback object. Remove from contracts or mark as aspirational.
- `ClaimVisibility` type is useful documentation but is not a real runtime type — it's a derived boolean map. It should be comments or a pure function, not an exported type, unless there's a component consuming it.

### Behavioral ambiguity
- "After any exercise completion, a 'Saved' toast appears within 100 ms of `completeExercise` being called" (AC §2) — this fires even for replay exercises where the player already has 3★. Is that correct? Replays don't advance progress. Probably yes (local write still happens), but spec should confirm.
- "Welcome Pack inline CTA" — what happens if the player taps it while in labyrinth mode? The modal interaction should be defined (probably: allow claim, board pauses).

### Hidden assumptions
- Assumes `CHESSCITO_LITE_MODE` is evaluated at module import time (it is — `process.env` compile-time constant). No runtime flag switching needed.
- Assumes `useWelcomePackClaim` can be mounted in `exercises-screen.tsx` without side effects — it's already mounted there (`const welcomePack = useWelcomePackClaim(...)`), so the inline CTA just needs to consume `welcomePack.state`. No new hook mount needed.
- Assumes Welcome Pack Claim requires `personal_sign` (confirmed MEMORY.md: MiniPay supports `personal_sign`).

### Backward compatibility
- `getRewardActions` signature change (adding optional second arg) is backward-compatible. Existing callers pass only `state` → `liteMode` defaults to `undefined` → falsy → Full behavior.
- No localStorage schema changes. No migration needed.
- Tests: `context-action.ts` has unit tests — they must be updated to cover the `liteMode=true` path. Without new tests the change has no coverage.

### Security & data
- No new API surface. No new wallet interactions. Badge claim path unchanged.
- "Saved" toast reveals that local progress exists — acceptable (it does exist).

### Test coverage gaps
- No acceptance criterion covers the TIMING of the local save toast (fires after 1 500 ms, not on `completeExercise`). If not tested, the timing regression is invisible.
- No AC covers the labyrinth-mode guard (toast must not fire during labyrinth completion).
- The `liteMode` path in `getContextAction` for "connectWallet suppressed only when score-only" has no dedicated AC — only the suppress case is covered.

### Operational readiness
- The "Saved" toast is identical to existing toasts — no new observability needed.
- If the Welcome Pack inline CTA breaks, the fallback is: Lite player can't claim the pack inline (it just doesn't appear). The pack is still claimable on Full if they switch builds. Acceptable regression surface — log `useWelcomePackClaim` status on claim attempt.
- Rollback: `CHESSCITO_LITE_MODE=false` restores Full behavior on all surfaces instantly.

---

## Verdict — UPDATED 2026-06-21

**READY FOR TDD** — all P0 findings resolved in spec revision.

| P0 | Status |
|---|---|
| P0-1 Lite gate leaks | ✅ Resolved — precise decision table in Behavior §22; new ACs cover all 4 wallet/chain/badge states |
| P0-2 Toast timing race | ✅ Resolved — callsite pinned to first line of `autoReset.schedule` callback; Behavior §4–5 rewritten |
| P0-3 Labyrinth path break | ✅ Resolved — `!labyrinthMode` guard in Behavior §5; AC confirms no toast during labyrinth overlay |
| P0-4 Welcome Pack CTA location | ✅ Resolved — slot defined as `ContextualActionSlot` slot; priority order + SSR hydration guard in Behavior §16–17 |

P1 risks documented in spec §Remaining Risks. None block TDD.

**Next**: run `/tdd` to start implementation.

P1 and P2 findings can be addressed in the AC checklist without blocking the spec revision.
