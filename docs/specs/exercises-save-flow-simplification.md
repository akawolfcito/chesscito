    # Spec — exercises-save-flow-simplification

    **Date**: 2026-06-21
    **Status**: revised — P0 findings resolved (2026-06-21)

    ## Problem

    In Exercises (both Lite and Full), when a wallet is connected the player can see simultaneously: Daily slot, Hint button, Save score, Claim badge, Training path, Badges dock, Pieces dock, Trophies dock, Leaders dock. On a 390 px MiniPay screen this produces an "alarm carpet" — every element competes for attention.

    The deeper issue: local save (automatic, always-on) and on-chain save (explicit, gas/Peones) are presented as interchangeable peers when they serve very different roles. In Lite, the on-chain path adds friction without user value — Lite players track habits, not leaderboard positions.

    ## Goal

    Separate local save (silent, automatic) from on-chain save (gated, explicit), remove on-chain save from Lite entirely, and suppress any CTA that has nothing pending so Exercises can breathe.

    ## Non-goals

    - Redesign the persistent dock or change dock item routing.
    - Change Daily Focus, Focus Passport, Achievements, or Welcome Package behavior.
    - New backend, DB, contract, or env var changes.
    - Remove on-chain save from Full mode.
    - Implement Content Loop or any new gameplay feature.
    - Cross-device sync of local progress (deferred in `deferred-work.md`).

    ---

    ## Contracts (SDD)

    ```ts
    // lib/game/context-action.ts — existing types, addendum for Lite

    /** Existing union — no new members needed. */
    export type ContextAction =
    | "submitScore"   // off-chain (Peones) — Full only
    | "useShield"
    | "claimBadge"
    | "retry"
    | "connectWallet"
    | "switchNetwork"
    | null;

    /** Existing union — no change. */
    export type RewardAction = Extract<ContextAction, "submitScore" | "claimBadge">;

    /**
    * P0-1 RESOLVED — getRewardActions must accept a `liteMode` flag.
    *
    * Rules in Lite:
    *   - "submitScore" is NEVER returned regardless of wallet state.
    *   - "claimBadge" IS returned when badgeEarned + connected + correctChain.
    *   - Default (liteMode=false or undefined) → Full behavior, no change.
    */
    export type RewardActionOptions = {
    liteMode?: boolean; // default false
    };

    /**
    * P0-1 RESOLVED — getContextAction precise Lite rules.
    *
    * When liteMode=true:
    *   phase=failure   → "useShield" (if shields) | "retry"           (unchanged)
    *   badgeClaimable
    *     + connected + correctChain  → "claimBadge"
    *     + !connected                → "connectWallet"    ← kept (badge needs wallet)
    *     + connected + wrongChain    → "switchNetwork"    ← kept (badge needs chain)
    *   scorePendingNew only (no badge)
    *     + any wallet state          → null               ← suppressed in Lite
    *   badgeClaimable + scorePendingNew
    *     → badge path wins; score is IGNORED in Lite
    *   neither pending              → null
    *
    * When liteMode=false (default):
    *   existing behavior unchanged.
    */

    // hooks/use-save-score-state.ts — no shape change needed; same local key.

    // Claim visibility — documentation-only (not a runtime type).
    // Welcome Pack Claim visible in Lite iff:
    //   welcomePack.state !== "claimed" && CHESSCITO_LITE_MODE
    //   (ShopSheet blocked in Lite — claim must surface inline)
    // In Full: accessible via ShopSheet dock — no inline CTA needed.
    //
    // Badge Claim visible (Lite + Full) iff:
    //   badgeEarned && !hasClaimedBadge && isConnected && isCorrectChain
    //
    // On-chain Save visible iff:
    //   !CHESSCITO_LITE_MODE && isConnected && isCorrectChain && scorePendingNew
    //
    // Off-chain Save (Peones) visible iff:
    //   !CHESSCITO_LITE_MODE && isConnected && isCorrectChain && scorePendingNew
    ```

    ---

    ## Behavior

    ### Local Save (automatic)

    1. Given a player completes an exercise (piece reaches target), when `completeExercise(movesCount)` fires, the progress is already persisted to `chesscito:progress:{piece}` — no new code needed for the write.
    2. After completion, show a quiet feedback: a transient toast with "Saved" (EN) / "Guardado" (ES), 1 200 ms, no action required, using the existing `showToast` channel in exercises-screen.
    3. The toast fires in BOTH Lite and Full, connected or disconnected. It is the only save affordance a Lite-disconnected player ever sees.
    4. **P0-2 RESOLVED — Callsite**: The "Saved" toast MUST NOT fire at `completeExercise(movesCount)` time. It fires as the **first line** of the `autoReset.schedule(callback, 1500)` callback, AFTER the WELL DONE phase-flash has had its window. The callback already branches into labyrinth-advance / exercise-advance / piece-complete paths — the toast call goes before that branch. This prevents the toast from competing with the phase-flash UI.
    5. **P0-3 RESOLVED — Labyrinth guard**: The "Saved" toast fires ONLY when `!labyrinthMode`. In labyrinth mode, the completion path calls `setLabyrinthCompleted(...)` and shows its own overlay — the toast must not appear there. Guard: `if (!labyrinthMode) { showToast(t("localSaved"), 1200); }` at the top of the `autoReset.schedule` callback.
    6. Stars, best score, and piece progress are covered by local save. Labyrinth bests are persisted via `recordLabyrinthBest` (separate path). Daily completion is handled by Daily Focus (not this spec).

    ### On-chain Save (Full only)

    6. `submitScore` (off-chain/Peones) and `handleSaveScoreOnChain` (on-chain gas) are BOTH hidden in Lite mode (`CHESSCITO_LITE_MODE === true`).
    7. In Full, existing visibility gate is unchanged: `scorePendingNew = canSaveScore && totalStars >= 1 && localScoreNum > lastSavedScore`. No button appears when nothing new is pending.
    8. In Full, when `scorePendingNew` becomes false (either because the player saved or because progress was already at parity), the Save CTA disappears immediately — no "saved" state ghost.
    9. The "Connect to save" prompt (`starsConnectPrompt.show()` on first ★★★ disconnected) is suppressed in Lite — not applicable when on-chain save doesn't exist.

    ### Badge Claim

    10. Badge claim CTA (`claimBadge`) appears in both Lite and Full when: `badgeEarned && !hasClaimedBadge && !justClaimed[piece] && isConnected && isCorrectChain`.
    11. In Lite, badge claim is the PRIMARY on-chain action (replaces Save as the notable CTA after piece completion).
    12. When badge is claimed (`justClaimed[piece] = true`), the claim CTA disappears immediately — no ghost.

    ### Welcome Pack Claim (Lite inline CTA) — P0-4 RESOLVED

    13. In Lite, the ShopSheet is blocked (`LITE_BLOCKED_SHEETS` already includes "shop"). The Welcome Pack claim must surface inline in the Exercises screen if and only if `welcomePack.state !== "claimed"`.
    14. Once claimed (`welcomePack.state === "claimed"`), the inline claim CTA disappears — no permanent button.
    15. In Full, Welcome Pack is accessible via the ShopSheet in the dock — no inline CTA needed (behavior unchanged).
    16. **P0-4 — Render slot**: The Welcome Pack inline CTA renders in the **same layout slot as `ContextualActionSlot`** — below the board, above the training path row. No new slot, no new floating element. Priority in that slot:
        1. Badge claim path (claimBadge / connectWallet / switchNetwork) — if badge applicable.
        2. Welcome Pack claim — if no badge pending and `welcomePack.state !== "claimed"`.
        3. Nothing (quiet state).
        This maps to: render `ContextualActionSlot` when `contextAction !== null`; ELSE render Welcome Pack inline CTA when Lite and pack unclaimed; ELSE render nothing.
    17. **P0-4 — Hydration safety**: The Welcome Pack inline CTA MUST NOT render on the server (SSR). `useWelcomePackClaim` reads localStorage after mount — initial server state is indeterminate. Gate the render with a client-side hydration check (e.g. `useEffect`-driven `mounted` flag, same pattern as `useFounderStatus`). This avoids layout flash on MiniPay WebView cold load.

    ### Disconnected player (both Lite and Full)

    16. No Save CTA is shown (wallet-gated).
    17. No Claim CTA is shown (wallet-gated).
    18. Local save still fires (automatic, toast "Saved").
    19. In Full only: "Connect to save" prompt on first ★★★ (existing behavior, unchanged).
    20. In Lite: no "Connect to save" prompt — it would imply an on-chain save path that doesn't exist in Lite.

    ### getContextAction / getRewardActions (single-slot vs multi-slot) — P0-1 RESOLVED

    21. `getRewardActions(state, { liteMode })` suppresses `"submitScore"` when `liteMode=true`, leaving only `"claimBadge"` if applicable.
    22. **P0-1**: `getContextAction(state, { liteMode })` in Lite mode:
        - If `phase === "failure"`: returns `"useShield"` or `"retry"` — unchanged, not affected by liteMode.
        - If `badgeClaimable`:
        - connected + correctChain → `"claimBadge"`
        - !connected → `"connectWallet"` (**kept** — badge claim needs wallet)
        - connected + !correctChain → `"switchNetwork"` (**kept** — badge claim needs chain)
        - If `scorePendingNew` only (no `badgeClaimable`): → `null` (**suppressed** — no save in Lite)
        - If `badgeClaimable && scorePendingNew`: badge path wins, score is ignored.
        - Neither pending: `null`.
    23. **P0-1**: `starsConnectPrompt.show()` call in `exercises-screen.tsx:~1530` must be wrapped with `&& !CHESSCITO_LITE_MODE` — the prompt implies an on-chain save path that doesn't exist in Lite. Exact callsite: inside `handleMove`, after `computeStars === 3 && !isConnected` check.

    ---

    ## Diagrams

    ### User flow — connected (Lite) — P0-2/P0-3/P0-4 RESOLVED

    ```
    exercise complete (piece hits target)
        → setPhase("success") + completeExercise() [localStorage write, instant]
        → WELL DONE phase-flash renders
        → [1500ms autoReset.schedule fires]:
            if !labyrinthMode:                             ← P0-3 guard
                showToast(t("localSaved"), 1200ms)         ← P0-2 callsite
            [branch: labyrinth pending after this exercise?]
                → enter labyrinth (no toast)
            [branch: !isLastExercise]
                → advanceExercise() + resetBoard()
            [branch: isLastExercise]
                → setShowPieceComplete(true)
        → ContextualActionSlot slot:
            if badgeEarned && !hasClaimedBadge:
                if connected + correctChain → CLAIM BADGE CTA
                if !connected              → CONNECT WALLET CTA (for badge)
                if wrongChain              → SWITCH NETWORK CTA (for badge)
            else if welcomePack.state !== "claimed" && mounted:
                → CLAIM PACK CTA (Welcome Pack inline)
            else:
                → nothing (quiet)
    ```

    ### User flow — connected (Full) — P0-2/P0-3 RESOLVED

    ```
    exercise complete
        → setPhase("success") + completeExercise() [localStorage write, instant]
        → WELL DONE phase-flash renders
        → [1500ms autoReset.schedule fires]:
            if !labyrinthMode:
                showToast(t("localSaved"), 1200ms)
            [advance branch as normal]
        → ContextualActionSlot slot:
            if scorePendingNew && badgeClaimable → both CTAs side by side
            if scorePendingNew only             → SAVE SCORE CTA
            if badgeClaimable only             → CLAIM BADGE CTA
            if neither                         → nothing
    ```

    ### User flow — disconnected (Lite) — P0-1 RESOLVED

    ```
    exercise complete
        → completeExercise() [localStorage write]
        → [1500ms autoReset fires]:
            if !labyrinthMode: showToast(t("localSaved"), 1200ms)
            [advance branch]
        → ContextualActionSlot slot:
            if badgeEarned && !hasClaimedBadge → CONNECT WALLET CTA (for badge)
            else if scorePendingNew only       → null (suppressed in Lite)
            else                               → nothing
        → NO "Connect to save" prompt (starsConnectPrompt suppressed in Lite)
    ```

    ---

    ## Action audit table

    | Action | Today (Full) | Today (Lite) | Proposed (Full) | Proposed (Lite) |
    |---|---|---|---|---|
    | Local save feedback | None | None | Toast "Saved" auto | Toast "Saved" auto |
    | Save Score (off-chain) | Shows if `scorePendingNew` | Shows if `scorePendingNew` | Shows if `scorePendingNew` | **Hidden** |
    | Save Score (on-chain) | Shows if `scorePendingNew` | Shows if `scorePendingNew` | Shows if `scorePendingNew` | **Hidden** |
    | Claim Badge | Shows if `badgeEarned` | Shows if `badgeEarned` | Shows if `badgeEarned` | Shows if `badgeEarned` (primary CTA) |
    | Welcome Pack Claim | Via ShopSheet dock | Via ShopSheet (BLOCKED) | Via ShopSheet dock | **Inline CTA until claimed** |
    | Connect to save prompt | On ★★★ disconnected | On ★★★ disconnected | On ★★★ disconnected | **Hidden** |
    | Hint button | Visible | Visible | Visible | Visible (unchanged) |
    | Daily slot | Visible | Visible | Visible | Visible (unchanged) |
    | Training path | Visible | Hidden | Visible | Hidden (unchanged) |

    ---

    ## Copy

    | Surface | EN | ES |
    |---|---|---|
    | Local save toast | "Saved" | "Guardado" |
    | Badge claim CTA (Lite) | "Claim badge" | "Reclamar insignia" |
    | Welcome Pack CTA inline (Lite) | "Claim your pack" | "Reclamar tu pack" |
    | Save Score CTA (Full) | "Save score" (existing) | unchanged |

    Rules:
    - Never use "on-chain" in Lite surfaces — players don't need to know.
    - "Saved" toast = 1-2 words, no icon, no action. Appears and disappears.
    - Badge claim copy reuses existing `FOOTER_CTA_COPY.claimBadge.label`.

    ---

    ## Edge Cases

    - **Lite + wallet connected + badge earned + score pending**: score save button hidden, badge claim visible. Player can claim badge on-chain even in Lite — that is the intended design.
    - **Lite + no wallet + no claim**: only local save toast. No CTA at all. Correct.
    - **Welcome Pack already claimed (Lite)**: inline CTA never renders. No ghost button.
    - **Welcome Pack state = "claiming" (in-flight)**: inline CTA shows spinner (existing `WelcomePackTileState` handles this).
    - **Multiple exercises completed without save (Full)**: `scorePendingNew` stays true — Save CTA remains visible until user saves or resets progress.
    - **Piece switch mid-save (Full)**: `pendingSubmitRef.current` and `recordSaveFor` already handle this — behavior unchanged.
    - **Rate limit hit (Full off-chain)**: toast with countdown (existing `rate_limited` case) — no change.
    - **Badge claimed but stars regressed below threshold (impossible by design)**: no edge case — stars only increase in the progress store.
    - **Local save toast fires during phase-flash** (P0-2): toast fires inside `autoReset.schedule` callback at t=1500ms, never at `completeExercise` time — WELL DONE has its full window.
    - **Labyrinth completion also triggers autoReset** (P0-3): the `!labyrinthMode` guard prevents the toast from showing over the labyrinth completion overlay.
    - **Welcome Pack CTA hydration flash** (P0-4): gate render with `mounted` flag (`useEffect(() => setMounted(true), [])`) so SSR never renders the CTA. First client paint is blank; after hydration the state resolves from localStorage/server and renders correctly.
    - **Lite + disconnected + badge earned**: ContextualActionSlot shows `connectWallet` (for badge, not for score) — this is correct and must NOT be suppressed.
    - **Lite + disconnected + scorePendingNew only**: ContextualActionSlot returns `null` — no CTA. Correct.
    - **Lite + wrongChain + badgeEarned**: `switchNetwork` shows — preserved for badge claim path.

    ---

    ## Acceptance Criteria

    ### Save flow — core
    - [ ] In Lite, no "Save Score" CTA appears regardless of wallet state or score.
    - [ ] In Full, existing Save Score behavior is unchanged (gate: `scorePendingNew`).
    - [ ] `getRewardActions(state, { liteMode: true })` never returns `"submitScore"`.

    ### Toast timing — P0-2
    - [ ] "Saved" toast fires inside the `autoReset.schedule` callback, NOT at `completeExercise` time.
    - [ ] "Saved" toast does NOT appear simultaneously with the WELL DONE phase-flash.
    - [ ] In both Lite and Full, "Saved" toast fires after exercise completion (1 500 ms window).

    ### Labyrinth guard — P0-3
    - [ ] In labyrinth mode, no "Saved" toast fires on labyrinth completion.
    - [ ] After labyrinth completion, the labyrinth overlay is the only success UI — no toast overlay.
    - [ ] In exercise mode (`!labyrinthMode`), "Saved" toast fires normally.

    ### Lite gate — P0-1
    - [ ] In Lite + disconnected + scorePendingNew only → no CTA, no "Connect to save" prompt.
    - [ ] In Lite + disconnected + badgeClaimable → `connectWallet` CTA visible.
    - [ ] In Lite + connected + wrongChain + badgeClaimable → `switchNetwork` CTA visible.
    - [ ] In Lite + connected + correctChain + badgeClaimable + scorePendingNew → badge claim CTA wins; no save CTA.
    - [ ] `starsConnectPrompt.show()` never fires when `CHESSCITO_LITE_MODE === true`.
    - [ ] `getContextAction(state, { liteMode: true })` returns `null` when `scorePendingNew && !badgeClaimable`.
    - [ ] `getContextAction(state, { liteMode: true })` returns `"connectWallet"` when `badgeClaimable && !isConnected`.

    ### Welcome Pack inline CTA — P0-4
    - [ ] In Lite, Welcome Pack CTA renders in the `ContextualActionSlot` slot (not a new slot).
    - [ ] In Lite, Welcome Pack CTA appears when `welcomePack.state !== "claimed"` and no badge CTA is active.
    - [ ] In Lite, Welcome Pack CTA disappears after claim — no permanent button.
    - [ ] In Lite, badge claim CTA takes priority over Welcome Pack CTA in the same slot.
    - [ ] Welcome Pack inline CTA does NOT render on SSR — only after client hydration (`mounted` flag).

    ### Baseline
    - [ ] All existing tests pass (`pnpm exec tsc --noEmit` + `pnpm test` baseline of 1727+ passing).
    - [ ] In Full, Welcome Pack is unchanged — accessible via ShopSheet, no inline CTA added.

    ---

    ## MVP Scope

    1. Update `getRewardActions` + `getContextAction` in `context-action.ts` to accept `{ liteMode }` and apply P0-1 rules.
    2. In `exercises-screen.tsx`: pass `CHESSCITO_LITE_MODE` as `liteMode` to both action helpers.
    3. In `exercises-screen.tsx`: wrap `starsConnectPrompt.show()` with `&& !CHESSCITO_LITE_MODE` (callsite ~line 1530).
    4. In `exercises-screen.tsx`: add "Saved" toast as **first line** of `autoReset.schedule` callback, with `!labyrinthMode` guard (P0-2 + P0-3).
    5. In `exercises-screen.tsx`: wire Welcome Pack inline CTA below the board in the `ContextualActionSlot` slot when `CHESSCITO_LITE_MODE && contextAction === null && welcomePack.state !== "claimed" && mounted` (P0-4).
    6. Add `mounted` state to guard Welcome Pack CTA against SSR hydration mismatch.

    ## Out of Scope / Future

    - Dock redesign or tab reduction.
    - Removing Badges/Trophies/Leaders from the dock.
    - "Pieces" dock nav behavior change.
    - P1.5 calendar real with `completedDates[]`.
    - VR baseline refresh for Exercises Lite.
    - Cross-device progress sync.
    - On-chain leaderboard for Lite.

    ---

    ## Open Questions

    - Q1: Should the Welcome Pack inline CTA in Lite be a full `ActionPin` or a simpler button? (Suggest: reuse existing `WelcomePackTile` component if it can be extracted from `ShopSheet`.)
    - Q2: Should the "Saved" toast be suppressed if the player already saw it in the same session for the same exercise? (Suggest: no suppression — every completion is a new save.)
    - Q3: In Lite, should badge claim still show the price ribbon / wallet-connect requirement, or should there be a softer "level up" CTA that only surfaces the wallet prompt in-flow? (Suggest: keep existing flow — badge claim is high-signal, explicit is correct.)

    ---

    ## Probable Files to Touch

    | File | Change |
    |---|---|
    | `src/lib/game/context-action.ts` | Add `liteMode` option to `getRewardActions` + `getContextAction`; implement P0-1 rules |
    | `src/lib/game/context-action.ts` tests | New test cases: liteMode=true × (scorePendingOnly, badgeOnly, both, disconnected, wrongChain) |
    | `src/components/exercises/exercises-screen.tsx` | (1) Pass `liteMode`; (2) Suppress `starsConnectPrompt`; (3) "Saved" toast in `autoReset.schedule` w/ `!labyrinthMode` guard; (4) Welcome Pack inline CTA + `mounted` guard |
    | `src/components/exercises/contextual-action-slot.tsx` | Possibly: pass-through for WP CTA in the same slot — or handled inline in exercises-screen |
    | `apps/web/messages/en.json` + `es.json` | Add `FOOTER_CTA_COPY.localSaved: "Saved"` / `"Guardado"` (audit first; key may exist) |

    ---

    ## Resolved P0 Findings

    | Finding | Resolution |
    |---|---|
    | P0-1: Lite gate leaks in `connectWallet` | Precise decision table in Behavior §22: `connectWallet`/`switchNetwork` kept for badge path; suppressed only when `scorePendingOnly && !badgeClaimable` in Lite. New ACs cover all 4 states. |
    | P0-2: Toast timing race with WELL DONE | Toast fires as first line of `autoReset.schedule` callback (t=1500ms), NOT at `completeExercise`. Behavior §4 and §5 updated with exact callsite. |
    | P0-3: Labyrinth path break | `!labyrinthMode` guard added (Behavior §5). Labyrinth completion has its own overlay; toast is suppressed. New ACs confirm. |
    | P0-4: Welcome Pack CTA location undefined | Renders in `ContextualActionSlot` slot. Priority order defined: badge path > WP claim > nothing. SSR hydration guard via `mounted` flag. Behavior §16–17 added. |

    ---

    ## Remaining Risks (post-P0)

    - **P1-A**: Copy "Saved" must be visually minimal (no icon, no color) to avoid implying on-chain persistence to Full players who may confuse it with score submission confirmation.
    - **P1-B**: Welcome Pack `WelcomePackTileState` in-flight state (`"claiming"`) should render a spinner in the inline slot — confirm the existing tile component can be reused or the slot needs a minimal inline spinner.
    - **P1-C**: In Full, `isSavedAtParity` (local = last-saved on-chain) means "Saved" toast fires but no Save CTA exists. Acceptable — the toast is local truth, not on-chain status.

    ---

    ## Known Issue / Follow-up: Exercise Path Sequencing

    **Observed behavior**: After completing an exercise, auto-advance moves to the next exercise, skipping labyrinths even when they appear interleaved in the training path UI.

    **Expected**: Auto-advance respects the path visual order: Exercise → Labyrinth (if next and unlocked) → Exercise → Labyrinth, etc.

    **Current code**: `autoReset.schedule` calls `nextPendingLabyrinthAfterExercise(trainingPathRef.current, completedExerciseId)` which already attempts labyrinth injection, but the behavior observed suggests the path may not be hydrated correctly at fire time, or the interleaving logic has gaps.

    **Classification**: Out of scope for Save Flow Simplification. Do not fix here.

    **Constraint**: When touching `autoReset.schedule` to add the "Saved" toast (P0-2), do NOT alter the existing labyrinth-injection branch or advance logic. Toast call goes BEFORE the branch — no changes to the branch itself.

    **Follow-up task**: `Exercise Path Sequencing` — make auto-advance respect the full interleaved path (exercises + unlocked labyrinths in order). DoD:
    - Auto-advance enters next unlocked labyrinth when it follows the completed exercise in path order.
    - Locked labyrinths show requirement state; are not silently skipped.
    - Manual exercise drawer selection still works.
    - No regression to exercise completion flow.
    - No regression to labyrinth completion overlay.
