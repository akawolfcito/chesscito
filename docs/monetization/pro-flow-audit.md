# Chesscito PRO Flow Audit

Date: 2026-05-12

Scope: Phase 0 only. This document audits the current repo and maps the implementation path for the new transversal Chesscito PRO monetization flow. No UI or product logic is implemented here.

Product thesis:

> Free lets you play. PRO helps you understand.

## Executive Map

Chesscito already has most of the purchase and status plumbing needed for a PRO training layer:

- PRO purchase SKU: `PRO_ITEM_ID = 6n`, price `$1.99`, duration 30 days in [shop-catalog.ts](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/lib/contracts/shop-catalog.ts).
- PRO status: [use-pro-status.ts](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/lib/pro/use-pro-status.ts), [is-active.ts](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/lib/pro/is-active.ts), `/api/pro/status`.
- PRO purchase sheet: [pro-sheet.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/pro/pro-sheet.tsx), [use-pro-sheet-state.ts](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/lib/pro/use-pro-sheet-state.ts).
- Coach credit bypass for PRO: [paywall-gate.ts](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/lib/coach/paywall-gate.ts) and `/api/coach/analyze`.
- Coach result/history UI: [coach-panel.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/coach/coach-panel.tsx), [coach-history.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/coach/coach-history.tsx), [coach/history/page.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/app/coach/history/page.tsx).
- Hub PRO affordances already exist in V1 and V2: [hub-scaffold-client.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/hub/hub-scaffold-client.tsx), [hub-scaffold-v2-client.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/hub/hub-scaffold-v2-client.tsx), [premium-slot.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/pro-mission/premium-slot.tsx), [training-pass-band.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/hub/training-pass-band.tsx).
- Telemetry pipe exists through [telemetry.ts](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/lib/telemetry.ts) and `/api/telemetry`.

The main gap is product framing and consistent surface placement. Current PRO is discovered mostly from Hub chips, the ProSheet, and post-game Coach. Practice and Labyrinths have no Coach preview. Arena setup has Coach hint only during active game HUD, not while choosing match settings. Shop is still item-first instead of intent-first. Retry Shield copy is still named "Retry Shield".

## Current Surfaces

| Area | Files | Current behavior | Proposed change | Risks |
| --- | --- | --- | --- | --- |
| Hub V1 | `components/hub/hub-scaffold-client.tsx`, `components/hub/hub-scaffold.tsx`, `components/pro-mission/premium-slot.tsx` | Top HUD has PRO chip and Coach chip. Premium slot opens ProSheet. Coach chip routes to `/coach/history`. | Add a compact Coach PRO card that frames PRO as training insight, not generic upgrade. Keep wallet optional. CTA: preview journal / open plan depending status. | V1 and V2 hub can diverge; keep copy shared and event names consistent. |
| Hub V2 | `components/hub/hub-scaffold-v2-client.tsx`, `components/hub/training-pass-band.tsx` | Coach topbar opens ProSheet. Training band has inactive perks but uses placeholder PRO active state tied to `atmosphere`, not real `useProStatus`. | Wire V2 to real PRO status before adding new monetization placements. Add same Coach PRO card or adapt TrainingPassBand to include Coach preview. | Current V2 placeholder data may make metrics misleading if used for monetization tests. |
| PRO Sheet | `components/pro/pro-sheet.tsx`, `lib/pro/use-pro-sheet-state.ts`, `lib/content/editorial.ts` | Active perks are Coach-heavy, roadmap follows. Purchase flow handles MiniPay stablecoin payment and verify retry. | Reframe copy around "understand your games", "training journal", "Coach layer across practice + Arena". Keep purchase mechanics unchanged. | `ExercisesScreen` has a legacy duplicate PRO purchase flow; centralization should happen before broad copy additions. |
| Arena setup | `app/arena/page.tsx`, `components/arena/arena-select-scaffold.tsx`, `components/arena/arena-entry-panel.tsx` | Selector has soft-gate and prize pool. Coach hint exists only in active Arena HUD via `ARENA_COPY.coachHudHint`. | Add compact PRO hint in setup: "Coach will review this match after checkmate" with inactive preview and active confirmation. | Selector is dense at 390px; hint must be small and below existing choice controls or inside footer area. |
| Arena endgame | `components/arena/arena-end-state.tsx`, `victory-celebration.tsx`, `victory-claim-success.tsx`, `victory-claim-error.tsx` | Ask Coach CTA appears after win/loss if handler exists. No preview of what Coach will say before tapping. | Add endgame Coach preview card before/near Ask Coach: one free insight preview plus PRO full analysis path. | Avoid competing with `Save Victory` and `Play Again`. Endgame already has several monetization CTAs. |
| Coach paywall | `components/coach/coach-paywall.tsx`, `components/coach/coach-fallback.tsx`, `app/arena/page.tsx` | Free quick review exists; full analysis requires credits unless PRO active. Credit packs use item IDs 3/4. | Treat credit packs as secondary "try without PRO"; primary upsell should be PRO training layer. | Do not change coach pack item IDs. Server still supports credits; UI should not orphan existing users. |
| Coach history | `app/coach/history/page.tsx`, `components/coach/coach-history.tsx`, `components/coach/coach-history-delete-panel.tsx` | User-facing copy says "Your Sessions" / "Past Sessions". PRO history delete and persistence are implemented. | Rename to "Training Journal". Prepare sections for Arena, Practice, Labyrinths, patterns, saved analyses. | API currently stores only Arena analyses. UI sections must not imply non-existent stored Practice/Labyrinth analyses until implemented. |
| Practice Pieces | `components/exercises/exercises-screen.tsx`, `mission-panel-candy.tsx`, `result-overlay.tsx`, `piece-complete` prompt | Practice teaches piece movement. Completion prompt has a link-like Coach hint to Arena. No inline Coach tips. | Add compact Coach tip/previews after key milestones: first failure, piece complete, badge earned. Free: generic learning tip. PRO: personalized note / journal prompt. | `ExercisesScreen` is large and has legacy PRO purchase duplication. Prefer extracting a small presentational component first. |
| Labyrinths | `components/exercises/exercises-screen.tsx`, `components/exercises/labyrinth-complete-overlay.tsx`, `lib/game/labyrinth-progress.ts` | Labyrinths are unlocked after piece mastery; completion stores best moves locally. | Add Coach preview after completion: "Coach noticed path efficiency" plus PRO journal CTA. | No server-side analysis for labyrinths yet; copy must be framed as a preview, not generated AI. |
| Streak Shield | `lib/content/editorial.ts`, `components/exercises/contextual-action-slot.tsx`, `lib/game/context-action.ts`, `lib/shop/shield-storage.ts`, `lib/shop/use-shield-sync.ts`, `components/exercises/shop-sheet.tsx` | User-facing label says "Retry Shield"; used after failures and sold in Shop itemId 2. | Rename user-facing copy to "Streak Shield"; add contextual failure prompt that explains it protects rhythm/streak. Keep contract item ID 2. | Storage keys and contract constants use "shield"; do not rename storage/contract internals in this pass. |
| Shop | `components/exercises/shop-sheet.tsx`, `lib/shop/use-shop-sheet-state.ts`, `lib/contracts/shop-catalog.ts`, `lib/content/editorial.ts` | Shop is flat catalog: Founder Badge, Retry Shield, hidden CELO sibling. PRO intentionally not in `SHOP_ITEMS`. | Reorganize by intent: "Understand my games" (PRO / Coach credits), "Keep practicing" (Streak Shield), "Support Chesscito" (Founder Badge). | Shop purchase hook only reads `SHOP_ITEMS`; PRO uses separate hook. Intent UI must route to separate purchase handlers safely. |
| Telemetry | `lib/telemetry.ts`, `app/api/telemetry/route.ts`, many call sites | Existing events cover hub view/taps, PRO sheet view/CTA/purchase, shop buy, Coach buy, Arena start/end. | Add events for every new monetization touchpoint: impressions, preview expands, CTA taps, status active/inactive, surface IDs. | Dev telemetry disabled by default unless `NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY=1`; tests should mock `track()`. |

## Central Copy Inventory

Primary source: [editorial.ts](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/lib/content/editorial.ts).

Existing objects to extend:

- `PRO_COPY`: main plan sheet, active perks, roadmap, errors.
- `COACH_COPY`: Coach analysis, paywall, history, welcome, feature banner.
- `ARENA_COPY`: arena setup, soft gate, Coach HUD hint.
- `PIECE_COMPLETE_COPY`: piece completion and current Arena Coach hint.
- `LABYRINTH_COPY`: labyrinth mode and completion copy.
- `SHIELD_COPY`, `SHOP_ITEM_COPY.retryShield`, `FOOTER_CTA_COPY.useShield`: user-facing Shield rename points.
- `SHOP_SHEET_COPY`: shop title, section descriptions, status labels.
- `HUB_V2_TRAINING_COPY`, `HUD_COPY`: Hub affordance labels.

Recommended new copy groups:

- `PRO_TRAINING_COPY` or nested `PRO_COPY.trainingLayer`: cross-surface thesis, previews, active/inactive microcopy.
- `COACH_PREVIEW_COPY`: generic non-AI previews for practice/labyrinth/endgame before full analysis.
- `TRAINING_JOURNAL_COPY`: replacement for "Your Sessions" plus empty states/section titles.
- `SHOP_INTENT_COPY`: intent section headers and CTAs.
- `STREAK_SHIELD_COPY`: renamed shield labels and failure prompt.

Keep all user-facing English copy in `editorial.ts`. Do not add strings directly in components except aria labels that are genuinely structural and unlikely to change.

## Access and Gating

Current gates:

- Client Coach paywall: `shouldShowPaywall({ proActive, credits })`.
- Server Coach bypass: `/api/coach/analyze` calls `isProActive(wallet)`, bypasses credits and persists history for PRO.
- PRO status read: `useProStatus(address)` fetches `/api/pro/status`.
- ProSheet purchase: `useProSheetState()` handles connect/switch/purchase/verify.
- Legacy exercises PRO purchase: `ExercisesScreen` duplicates parts of the PRO purchase state and `handleProPurchase`.

Recommended centralized helper:

- Add `lib/pro/access.ts` or `lib/pro/training-access.ts`.
- Export pure helpers:
  - `getProTrainingState({ proStatus, isConnected })`
  - `canUseFullCoach({ proActive, credits })`
  - `resolveProCta({ isConnected, proActive, surface })`
  - `resolveCoachPreviewTier({ proActive, hasCredits })`
- Keep server authority in `isProActive()` and `/api/coach/analyze`; client helpers are for UI only.

Risk: do not make wallet connection mandatory at app start. New gates should render preview states for anonymous users and open connect only when the user taps a purchase or account-specific journal action.

## Telemetry Plan

Existing events:

- Hub: `hub_view`, `hub_pro_chip_tap`, `hub_coach_chip_tap`, `hub_premium_slot_tap`, `hub_play_tap`, `hub_reward_tile_tap`, V2 training band tap.
- PRO: `pro_card_viewed`, `pro_cta_clicked`, `pro_purchase_started`, `pro_purchase_confirmed`, `pro_purchase_failed`, `pro_verify_retry_failed`.
- Arena: `arena_select_view`, `arena_start_tap`, `arena_game_start`, `arena_game_end`, difficulty/color taps.
- Coach/shop: `coach_buy_tx`, `shop_buy_tx`.

Recommended new events:

| Event | Props |
| --- | --- |
| `pro_training_card_viewed` | `surface`, `pro_active`, `wallet_connected` |
| `pro_training_card_cta_tap` | `surface`, `cta`, `pro_active`, `wallet_connected` |
| `coach_preview_viewed` | `surface`, `context`, `pro_active`, `wallet_connected` |
| `coach_preview_cta_tap` | `surface`, `cta`, `pro_active`, `wallet_connected` |
| `training_journal_viewed` | `source`, `pro_active`, `wallet_connected`, `entry_count` when available |
| `training_journal_entry_tap` | `kind`, `result`, `difficulty` if present |
| `streak_shield_prompt_viewed` | `surface`, `shield_count`, `failure_context` |
| `streak_shield_prompt_cta_tap` | `cta`, `shield_count` |
| `shop_intent_section_viewed` | `intent`, `item_count` |
| `shop_intent_cta_tap` | `intent`, `item_id` or `product`, `configured`, `enabled` |

Rules:

- Do not send wallet addresses, tx hashes, move lists, or raw analysis text.
- Use coarse context props only.
- Keep event names under 64 chars and props under `/api/telemetry` sanitizer limits.

## Recommended Edit Order

1. **Copy and naming foundation**
   - Extend `editorial.ts` with cross-surface PRO/Coach/Training Journal/Streak Shield copy.
   - Rename user-facing Retry Shield strings only.
   - Add tests for copy where existing tests assert labels.

2. **Access helper extraction**
   - Add `lib/pro/training-access.ts` with pure helpers.
   - Move duplicated UI decisions out of components gradually.
   - Add unit tests before wiring UI.

3. **Hub card**
   - Start in Hub V1 default: `HubScaffoldClient` + `HubScaffold`.
   - Add a compact presentational `CoachProCard` or extend PremiumSlot only if it stays compact.
   - Mirror in V2 only after V2 reads real PRO status.

4. **Arena setup hint**
   - Add prop to `ArenaSelectScaffold` and legacy `ArenaEntryPanel` if both remain supported.
   - Wire `proActiveCached` and `isConnected` from `app/arena/page.tsx`.
   - Track impression and CTA.

5. **Endgame Coach Preview**
   - Add a small preview component used by `ArenaEndState` win/loss paths.
   - Preserve hierarchy: Save Victory / Play Again remain primary depending context.

6. **Practice and Labyrinth previews**
   - Add presentational `CoachPreviewCard`.
   - Use in `PieceCompletePrompt`, `LabyrinthCompleteOverlay`, and first-failure prompt.
   - Keep preview generic until real analysis exists.

7. **Streak Shield rename and failure prompt**
   - Rename copy in `SHIELD_COPY`, `SHOP_ITEM_COPY.retryShield`, `FOOTER_CTA_COPY`.
   - Consider leaving internal names and telemetry source names unchanged initially, or alias new telemetry while keeping item ID 2.

8. **Shop by intent**
   - Add intent grouping in `ShopSheet` without changing `SHOP_ITEMS`.
   - Add a PRO intent row that delegates to `useProSheetState` rather than forcing PRO into `SHOP_ITEMS`.
   - Keep Founder Badge and Streak Shield purchases on existing hook.

9. **Training Journal rename**
   - Rename `COACH_COPY.yourSessions` and `pastSessions`.
   - Update `/coach/history` metadata/headers/empty states.
   - Prepare section UI only after data model decision.

10. **Telemetry hardening**
    - Add tracking to each new touchpoint.
    - Add unit tests with mocked `track()` where surfaces already have tests.

## Phase-Specific Risks

- **Large legacy component risk:** `ExercisesScreen` owns practice, labyrinth, shop, PRO purchase, sheets, result overlays, and account state. Avoid broad edits there. Prefer small presentational components and one insertion point per PR.
- **Duplicate PRO purchase logic:** Hub uses `useProSheetState`; legacy ExercisesScreen still has local `handleProPurchase`. Centralization should happen before or during monetization expansion to avoid divergent bugs.
- **V1/V2 Hub divergence:** V2 has placeholder mastery and atmosphere-based PRO active state. Do not use V2 as the canonical monetization implementation until it reads real status.
- **Coach data truthfulness:** Stored Coach history is Arena-only today. Practice/Labyrinth previews should not claim personalized history until backend storage exists.
- **MiniPay density:** Every new monetization surface must be one compact card or inline band. Avoid nested cards and long explanatory blocks.
- **Contract immutability:** Do not change item IDs. `SHIELD_ITEM_ID=2`, Coach packs `3/4`, PRO `6`.
- **Telemetry privacy:** Never include wallet, tx hash, move list, analysis text, or PII.

## Phase 0 Outcome

The safest path is not a single paywall redesign. It is a copy-first, helper-first sequence that turns existing PRO purchase/status and Coach analysis into a visible training layer across the app.

First implementation PR should be copy + pure access helpers + tests. The first UI PR should target Hub only, because Hub is the earliest value-discovery surface and already owns ProSheet, Coach navigation, and telemetry.
