# UI Floating Actions — Functional Audit (2026-05-01)

> **Why this exists**: the visual audit (`docs/reviews/ui-systems-audit-2026-05-01.md`) classified three "floating buttons" around the board as candidates for deletion, assuming they were ornamental or duplicated dock destinations. Manual user validation revealed at least one of them (the trophy floating button) opens a **completely different surface** — a Mini-Arena endgame challenge (K+R vs K), not the dock Trophies destination. Before any deletion, this audit reads source code as ground truth and re-classifies each element by **what it actually does**, not what it looks like.
>
> **Source of truth**: `apps/web/src/components/play-hub/play-hub-root.tsx:1119–1183` is where every element on the play-hub is wired. This audit was built by reading that file plus each handler's implementation.

---

## Method

For each element:

1. Locate the rendering component.
2. Read the click handler and any `open*` state.
3. Identify the surface it opens (route / Type-A/B/C/D / state mutation).
4. Identify gating: when does it appear, when does it hide?
5. Classify functionally.
6. Recommend a zone slot.

No component was deleted, hidden, or moved as part of this audit.

---

## Findings — element by element

### 1. Trophy floating button (bottom-right of board)

| Field | Value |
|---|---|
| Component | `apps/web/src/components/mini-arena/mini-arena-bridge-slot.tsx` |
| Test ID | `data-testid="mini-arena-bridge"` |
| Wiring | `play-hub-root.tsx:1163–1169` — passed as `actionRowRight` slot to `MissionPanelCandy`, in `compact` mode |
| Visual | h-12 w-12 round button, `candy-frame candy-frame-amber`, `<CandyIcon name="trophy">` |
| Click action | `setOpen(true)` → opens `<MiniArenaSheet>` (Type-B sheet, `h-[100dvh]`, `data-testid="mini-arena-sheet"`) |
| Surface opened | **Mini Arena: K+R vs K** — a chess endgame puzzle (FEN `4k3/8/8/8/8/8/8/R3K3 w - - 0 1`, par 16 half-moves, AI level 0). Player must deliver checkmate. Includes board, status line, retry button. |
| Gating | `unlocked={selectedPiece === "rook" && totalStars >= 12}` — only renders when the player has ≥12 stars on the rook. Returns `null` otherwise (silent gating). |
| Classification | **Special / Mastery Challenge** — pedagogical bridge between Play Hub exercises (single piece, no opponent) and full Arena (32 pieces vs AI). It is NOT navigation, NOT a duplicate of dock Trophies, NOT a reward claim, NOT monetization. |
| Recommended zone | **Z2 contextual header — "challenges row"** (alongside Daily Tactic). Rebrand label so it reads as a challenge unlock, not a trophy. Candidate copy: "Mastery: K+R vs K" or "Bridge: K+R vs K". The trophy icon is fine (signals "advanced") but the user-facing label must clarify it's a playable challenge, not a navigation shortcut. |
| Urgent fix | **Do NOT delete.** The original `Phase 1 commit #1` ("remove trophy floating button") is **invalid** — it would remove a gated mastery feature that exists for a reason. |

---

### 2. Whistle button (bottom-left of board) — actually `DailyTacticSlot`

| Field | Value |
|---|---|
| Component | `apps/web/src/components/daily/daily-tactic-slot.tsx` (smart container) → `daily-tactic-card.tsx` (compact button) → `daily-tactic-sheet.tsx` (Type-B sheet) |
| Test ID | `data-testid="daily-tactic-card"`, `data-state="completed" | "pending"` |
| Wiring | `play-hub-root.tsx:1162` — passed as `actionRowLeft` slot to `MissionPanelCandy`, in `compact` mode |
| Visual | h-12 w-12 round button, `candy-frame candy-frame-amber`, `<CandyIcon name="coach">` (pending) or `<CandyIcon name="check">` (completed). Streak badge top-right corner when `streak > 0`. |
| Click action | `setOpen(true)` → opens `<DailyTacticSheet>` with today's puzzle (FEN-driven, single-move solution check). On solve: fires `onSolve()` → records completion + bumps streak in localStorage. Auto-closes 1.8s after solve. |
| Surface opened | **Daily Tactic** — chess puzzle of the day (mate in 1 / tactical motif). Streak tracking. Once solved, button disables until next UTC day rollover. |
| Gating | Always renders. State-aware: `pending` (interactive) vs `completed` (disabled, shows green check). Streak badge appears once `streak > 0`. |
| Classification | **Recurring engagement / habit loop** — daily puzzle with streak mechanic. NOT a hint, NOT a tutorial, NOT navigation. |
| Recommended zone | **Z2 contextual header — "challenges row"** alongside Mini Arena bridge. The two together form a "today's challenges" sub-row: Daily Tactic (recurring, always present) + Mini Arena (gated mastery). Rebrand the icon — `coach` reads as "whistle" to users, which is misleading; consider a `puzzle` or `lightbulb-day` candy sprite. |
| Urgent fix | **Do NOT delete.** This is a streak-driven retention feature — deleting it loses the entire daily-engagement loop. Phase 1 plan to "convert whistle to Hint" was based on a misread icon and would destroy the daily-tactic feature. |

---

### 3. Blue-star button (bottom-center of board) — actually `ContextualActionSlot`

| Field | Value |
|---|---|
| Component | `apps/web/src/components/play-hub/contextual-action-slot.tsx` |
| Wiring | `play-hub-root.tsx:1170–1183` — passed as `contextualAction` slot to `MissionPanelCandy`, in `compact` mode |
| Visual | h-11 w-11 round pin. Icon + gradient depend on **current action state** (state machine in `lib/game/context-action.ts`). |
| Possible actions | `submitScore` (icon `star`, brand cyan/teal gradient — **THIS is the "blue star"**), `useShield` (shield icon, reward gradient), `claimBadge` (trophy icon, candy-frame-gold), `retry` (refresh icon, muted), `connectWallet` (wallet icon, brand gradient), `switchNetwork` (refresh icon, reward gradient) |
| Click action | Wired to specific handler per action: `onSubmitScore` (signs + writes to `Scoreboard` contract), `onUseShield` (consumes shield, resets board), `onClaimBadge` (signs + mints badge NFT), `onRetry` (board reset), `onConnectWallet` (Rainbow modal), `onSwitchNetwork` (wagmi switchChain). |
| Surface opened | Each action triggers a different flow: tx sign/write, modal open, or in-place state mutation. None is purely navigational. |
| Gating | `getContextAction()` state machine — exactly one action exposed at a time, picked by phase / shield count / score-pending / badge-claimable / wallet state. Returns `null` (component returns `null`) when no contextual action applies. |
| Classification | **Primary CTA — state-driven progressive surface.** Critical conversion: this is the on-chain submit, the badge claim, the wallet gate. NOT ambiguous, NOT decorative. Currently icon-only (`compact`), which is the source of user confusion. |
| Recommended zone | **Z4 contextual action rail — primary slot.** It is already in the right zone conceptually; the issue is the icon-only treatment. **Critical fix**: in compact mode, add a label below or beside the pin so the user knows "submit score" vs "claim badge" vs "use shield" without guessing. Or auto-promote to the full-width treatment (already supported via `compact={false}`) when the action is present + is the primary screen action. |
| Urgent fix | **Do NOT delete.** This is the on-chain conversion CTA. The "blue star" is `submitScore` — the moment a player ships their score to the leaderboard. Removing this kills the leaderboard feature entirely. |

---

### 4. PRO chip (top-right of play-hub)

| Field | Value |
|---|---|
| Component | `apps/web/src/components/pro/pro-chip.tsx` |
| Wiring | `play-hub-root.tsx:1120–1126` — `<div absolute right-2 top-... z-30>` direct child of `<main>`, NOT inside `MissionPanelCandy` |
| Visual | h-7 (28px) pill, 64–120px wide. Inactive: amber→orange gradient + ✦ + "PRO" label. Active: violet→purple gradient + ★ + "PRO • Nd". Loading: pulsing white skeleton. |
| Click action | `setProSheetOpen(true)` → opens `<ProSheet>` (PRO subscription purchase or status detail). Tracks `pro_cta_clicked` and `pro_card_viewed` (once per mount). |
| Surface opened | `<ProSheet>` — Type-B destination sheet. Shows price, days granted, purchase button when inactive; expiration / renew when active. |
| Gating | Always rendered (hides only via splash + briefing flow indirectly). Shimmers while `isLoading`. State drives gradient: inactive (gold) vs active (violet). |
| Classification | **Monetization / status indicator** — the chip is dual-purpose: it's the conversion entry point when inactive, and a status display when active. Always visible. |
| Recommended zone | **Split into two roles, two zones**: (a) **Active state → Z1 status bar** as a small gold ring or "PRO" suffix on the level chip — passive, identity-level, never competing. (b) **Inactive state → Z4 promo card** as a contextual one-time offer, gated to first 7 days OR shown after key moments (first piece complete, first score submit). NOT permanent in the header. |
| Urgent fix | The original recommendation to "remove from header" was correct in **direction** but needs more nuance: don't kill the chip cold, **split the role** so PRO-active users keep the status indicator and PRO-inactive users see promo only at the right moments, not on every play-hub render. |

---

### 5. Dock — Badges item

| Field | Value |
|---|---|
| Wiring | `play-hub-root.tsx:1187–1198` — `<BadgeSheet>` passed as `badgeControl` to `<PersistentDock>` |
| Visual | Dock left position, candy banner sprite, label `DOCK_LABELS.badge` ("Badges") |
| Click action | Opens `<BadgeSheet>` (Type-B, `h-[100dvh]`) |
| Surface opened | **Badges sheet** — grid of all 6 piece badges, claim CTAs per-card, soulbound state, navigation hint to `/trophies`. NOT the same as Trophies (which is a separate dock destination). |
| Classification | **Persistent navigation — destination sheet** |
| Recommended zone | Z5 dock — keep as-is. |
| Note | Critical distinction vs Trophies: Badges = the soulbound NFT collection per-piece; Trophies = the cosmetic / achievement collection. Different surfaces, different mental models. **Both are valid dock items.** |

---

### 6. Dock — Trophies item

| Field | Value |
|---|---|
| Wiring | `play-hub-root.tsx:1231–1236` — `<TrophiesSheet>` passed as `trophiesControl` to `<PersistentDock>` |
| Visual | Dock right position (after Arena center), candy banner sprite, label `DOCK_LABELS.trophies` |
| Click action | Opens `<TrophiesSheet>` (Type-B sheet) |
| Surface opened | **Trophies sheet** — Hall of Fame, Achievements grid, MyVictories list. Cosmetic / vanity collection. Linked from Badges sheet via `onNavigateToTrophies`. |
| Classification | **Persistent navigation — destination sheet** |
| Recommended zone | Z5 dock — keep as-is. |
| Note | **NOT duplicated by the trophy floating button** — totally different surfaces. The original audit conflated visual similarity (both have trophy icons) with functional similarity (they are not). |

---

### 7. Dock — Arena (center) item

| Field | Value |
|---|---|
| Wiring | `play-hub-root.tsx:1216–1230` — `<ArenaEntrySheet>` passed as `arenaControl` to `<PersistentDock>`. Trigger has `aria-label="Free Play"` (legacy label) but `DOCK_LABELS.arena` is now "Arena". |
| Visual | Dock center position, raised slightly, candy banner `btn-battle.png`, label "Arena" |
| Click action | Opens `<ArenaEntrySheet>` (difficulty selector + soft-gate for warm-up) — does NOT directly route to `/arena`. The sheet contains its own "Enter Arena" CTA that routes. |
| Surface opened | **ArenaEntrySheet** — Type-B sheet, the soft-gate flagged in `visual-qa-2026-04-30` Issue 3 (6 decision blocks). Difficulty cards, color toggle, prize pool banner, warm-up gate, primary CTA "Enter Arena". |
| Classification | **Persistent navigation — primary game mode entry** |
| Recommended zone | Z5 dock — keep as-is. The sheet's IA still needs the simplification flagged in `visual-qa-2026-04-30` (collapse warm-up gate, pre-select Easy, smaller prize banner). That's a Z5-internal concern, not a zone-map concern. |
| Note | Aria-label `"Free Play"` is stale (memory says label was renamed to "Arena" because "Free Play" implied a paid counterpart). The aria-label should be updated to "Arena" for consistency. |

---

### 8. Dock — Shop item

| Field | Value |
|---|---|
| Wiring | `play-hub-root.tsx:1199–1212` — `<ShopSheet>` passed as `shopControl` to `<PersistentDock>` |
| Visual | Dock second position, candy banner sprite, label `DOCK_LABELS.shop` ("Shop") |
| Click action | Opens `<ShopSheet>` (Type-B) |
| Surface opened | **Shop sheet** — grid of purchasable items: Founder Badge ($0.10), Retry Shield ($0.025), PRO ($1.99 / 30d). Selecting an item closes Shop and opens `<PurchaseConfirmSheet>` (Type-C quick picker). |
| Classification | **Persistent navigation — monetization destination** |
| Recommended zone | Z5 dock — keep as-is. |
| Note | The PRO chip in the header could route here instead of opening `<ProSheet>` separately — that would consolidate monetization in a single destination. Worth considering as part of the PRO architecture rework (Phase 5 of the original plan). |

---

## Summary — corrections to the original zone-map decision record

The original `Phase 1` commit list (`docs/reviews/ui-zone-map-decision-record-2026-05-01.md` §7) needs the following corrections **before any commit ships**:

| Original commit | Was | Correction |
|---|---|---|
| #1 — `chore(ui): remove trophy floating button` | Delete it | **CANCEL.** Trophy floating button = MiniArenaBridgeSlot (K+R vs K mastery challenge). Reclassify as Z2 challenges-row entry. New commit: `feat(ui): unify Daily Tactic + Mini Arena bridge in Z2 challenges row` (Phase 2 — needs zone primitives first). |
| #2 — `feat(ui): hint button in Z4 secondary, replaces whistle` | Whistle → Hint | **CANCEL.** "Whistle" = DailyTacticSlot (daily puzzle + streak). It is NOT a hint. New commit: `chore(ui): rename whistle assumption — DailyTacticSlot remains in Z2 challenges row` (no code change; documentation correction in DESIGN_SYSTEM.md). |
| #3 — `chore(ui): remove blue-star button (purpose pending)` | Delete it | **CANCEL.** "Blue star" = `submitScore` action of `ContextualActionSlot`. Critical on-chain CTA. Already in the right zone (Z4). New commit (Phase 1 quick win): `feat(ui): add label to compact ContextualActionSlot pin so submit/claim/shield are unambiguous`. |
| #4 — `refactor(ui): unify piece selector + objective in Z2 row` | Keep as-is | OK — still valid. |
| #5 — `feat(pro): remove PRO chip from header, add temporary Z4 promo card` | Replace cold | **REVISE.** Split: keep PRO chip's *active state* as Z1 status indicator; remove the *inactive state* from header and replace with Z4 promo card on play-hub (first-7-days gate). Same end goal, two-track migration. |
| #6 — `fix(ui): guard mission-briefing modal against open sheets` | Keep as-is | OK — still valid (already shipped per `play-hub-root.tsx:1318`, but verify the guard covers `proSheetOpen` too — the existing code does ✓). |
| #7 — `feat(arena): pre-select Easy difficulty on soft-gate` | Keep as-is | OK — still valid. |
| #8 — `fix(ui): collapse contextual-action-slot to null when empty` | Keep as-is | OK — already correct in `contextual-action-slot.tsx:85` (`if (!action) return null`). Verify the parent (`MissionPanelCandy`) doesn't reserve space when null. May be a no-op. |
| #9 — `docs(ui): document z-index ladder at top of globals.css` | Keep as-is | OK — still valid. |
| #10 — `docs(design-system): add 12 system rules + zone map link` | Keep as-is | OK — still valid. Add reference to THIS audit doc as well. |

---

## Updated Phase 1 commit list (corrected)

1. **`docs(reviews): add functional audit + correct decision record`** — commit this audit doc + apply the corrections in §7 of `ui-zone-map-decision-record-2026-05-01.md`.
2. **`feat(ui): label ContextualActionSlot pin in compact mode`** — add a small text label below the pin (or auto-promote to full width when present) so `submitScore` / `claimBadge` / `useShield` are no longer guessing games.
3. **`fix(ui): aria-label for dock arena trigger`** — update `aria-label="Free Play"` → `"Arena"` to match `DOCK_LABELS.arena`.
4. **`feat(arena): pre-select Easy difficulty on soft-gate`** (was #7) — unchanged.
5. **`fix(ui): verify mission-briefing guard covers proSheetOpen`** (was #6) — verify, no-op or one-line fix.
6. **`docs(ui): document z-index ladder at top of globals.css`** (was #9) — unchanged.
7. **`docs(design-system): add 12 system rules + link to audit + functional audit`** (was #10) — extended to reference both audit docs.

Note: commits #1, #2, #3 from the original plan are now **CANCELLED**. Reclassification work (Daily Tactic + Mini Arena unification, PRO chip split) is **promoted to Phase 2** because it requires the zone primitive components (`<ContextualHeader />`, `<ContextualActionRail />`) to land first.

---

## Open question (pending product decision)

The **icon set for these features** confuses users:
- Daily Tactic uses `coach` candy icon (looks like a whistle).
- Mini Arena bridge uses `trophy` candy icon (looks like dock Trophies).
- Submit-score uses `star` candy icon with cyan gradient (reads as "achievement reward" instead of "submit transaction").

**Recommendation**: queue three new candy sprites for the next asset round:
- `puzzle-day-ch.png` for Daily Tactic
- `mastery-ch.png` (sword + crown, or similar gated-progress signal) for Mini Arena bridge
- `submit-ch.png` (paper airplane or upload arrow) for `submitScore` action

This is a separate spec — not in scope for Phase 1.

---

## Acceptance verification

- [x] Each floating button traced to its component file + handler.
- [x] Each one classified by what it actually does, not how it looks.
- [x] Trophy floating button confirmed as MiniArenaBridgeSlot opening K+R vs K — NOT a duplicate of dock.
- [x] Decision record corrections drafted (this section).
- [ ] Playwright spec covering trophy floating vs dock trophies behavior — **next task** (`apps/web/e2e/floating-actions-vs-dock.spec.ts`).
- [ ] Decision record patched with the corrections above — **next task**.

— Sally
