# Chesscito M1 — Monetization Telemetry Events

**Date:** 2026-06-02
**Cluster:** M1 monetization funnel commits (commits 1–7 of the M1 plan).
**Author:** Clausita (audited from the actual repo state, not memory).
**Sink:** `@/lib/telemetry` `track()` (existing logger; M1 does not introduce a new analytics provider).

This document is the **canonical contract** for every `monetization.*` event shipped during the M1 funnel cluster. M2 backend work (when `analytics_events` lands in Supabase) MUST consume this contract verbatim — payload schemas, dedupe gates, and context vocabularies are stable.

## 1. Audit method

Generated from `grep -nE 'track\(\s*[\"\\']monetization\\.' apps/web/src` (audited 2026-06-02 against commit `bfc6ec4f`). Every callsite below is traceable to a file:line. If a future commit adds a new `monetization.*` event without updating this file, the contract is broken — re-audit and update.

## 2. Inventory — 16 events

### 2.1 Endgame popup events (loss / resign / draw / stalemate)

#### `monetization.coach_review_offered`

| Field | Value |
|---|---|
| Fires from | `apps/web/src/components/arena/arena-end-state.tsx:205` |
| Trigger | useEffect on mount when `!isPlayerWin && isCoachPrimaryVariant && endgameContext != null` |
| Payload | `{ context: "endgame_loss" \| "endgame_resign" \| "endgame_draw" }` |
| Dedupe gate | useEffect deps `[text, isPlayerWin, isCoachPrimaryVariant, endgameContext]` — re-fires only if any changes |
| Context values | `endgame_loss` (checkmate, player lost), `endgame_resign` (resigned), `endgame_draw` (draw or stalemate) |

#### `monetization.coach_review_tap`

| Field | Value |
|---|---|
| Fires from | 3 callsites |
| Callsite 1 | `apps/web/src/components/arena/arena-end-state.tsx:447` — endgame loss/resign/draw Coach Review CTA |
| Callsite 2 | `apps/web/src/components/arena/victory-celebration.tsx:144` — endgame win pre-mint Coach Review (secondary tile) |
| Callsite 3 | `apps/web/src/components/arena/victory-claim-success.tsx:115` — endgame win post-mint Coach Review (secondary tile) |
| Payload | `{ context: "endgame_loss" \| "endgame_resign" \| "endgame_draw" \| "endgame_win", source?: "endgame" \| "save_success" }` |
| Source values | `source` is `"endgame"` from victory-celebration (pre-mint) and `"save_success"` from victory-claim-success (post-mint). Loss/resign/draw don't carry a source (single call path). |
| Dedupe gate | Synchronous click handler, no de-dupe — one tap = one event |

#### `monetization.play_again_tap`

| Field | Value |
|---|---|
| Fires from | `apps/web/src/components/arena/arena-end-state.tsx:522` |
| Trigger | Synchronous click on the secondary Play Again button when `isCoachPrimaryVariant && endgameContext != null` |
| Payload | `{ context: "endgame_loss" \| "endgame_resign" \| "endgame_draw" }` |
| Dedupe gate | None — one tap = one event |
| Notes | Endgame WIN does NOT emit `play_again_tap`. Win uses a separate tertiary cream button without monetization namespace (legacy `modal_open` covers the surface). |

### 2.2 Coach paywall events

#### `monetization.coach_paywall_view`

| Field | Value |
|---|---|
| Fires from | `apps/web/src/components/coach/coach-paywall.tsx:76` |
| Trigger | useEffect on mount transition `open=false → open=true` (only when `context != null`) |
| Payload | `{ context: CoachPaywallContext }` |
| Context values | `endgame_loss \| endgame_resign \| endgame_win \| endgame_draw` |
| Dedupe gate | useEffect deps `[open, context]` — re-fires per open transition |
| Notes | When `context === undefined` (dev fixture, legacy callers) the event is skipped entirely. |

#### `monetization.coach_paywall_preview_view`

| Field | Value |
|---|---|
| Fires from | `apps/web/src/components/coach/coach-paywall.tsx:77` |
| Trigger | Same useEffect as `coach_paywall_view`. Mounts in lock-step with the sample preview block. |
| Payload | `{ context: CoachPaywallContext }` |
| Dedupe gate | Identical to `coach_paywall_view` (same useEffect) |
| Notes | Separated from `coach_paywall_view` to allow downstream A/B testing of the preview block without touching the parent view event. |

#### `monetization.coach_paywall_dismiss`

| Field | Value |
|---|---|
| Fires from | `apps/web/src/components/coach/coach-paywall.tsx:82` |
| Trigger | `emitDismiss(reason)` — invoked from `handleLater()`, `handleSeePro()`, and the Sheet `onOpenChange(false)` fallback |
| Payload | `{ context: CoachPaywallContext, reason: "explicit" \| "backdrop" }` |
| Reason values | `explicit` (user tapped Later or PRO CTA — paywall dismisses as part of the action), `backdrop` (swipe close or X button) |
| Dedupe gate | `explicitDismissRef` ensures backdrop-close path does NOT double-fire after Later/PRO tap (the explicit emit fires first; onOpenChange skips the backdrop branch) |
| Notes | When `context === undefined`, the dismiss event is skipped silently. |

#### `monetization.coach_paywall_convert`

| Field | Value |
|---|---|
| Fires from | 2 callsites |
| Callsite 1 | `apps/web/src/components/coach/coach-paywall.tsx:89` — pack tile tap (5 or 20) |
| Callsite 2 | `apps/web/src/components/coach/coach-paywall.tsx:100` — PRO CTA tap |
| Payload | `{ context: CoachPaywallContext, tier: "pack_5" \| "pack_20" \| "pro" }` |
| Tier values | `pack_5` (5-credit pack tile), `pack_20` (20-credit pack tile), `pro` (PRO CTA below tiles) |
| Dedupe gate | None on the click — but PRO CTA path is wrapped in `if (buying) return` so a mid-tx tap doesn't fire twice. Pack taps don't pre-check since `useShopSheetState` handles concurrent purchase guarding downstream. |

### 2.3 Victory Save events

#### `monetization.save_victory_tap`

| Field | Value |
|---|---|
| Fires from | `apps/web/src/components/arena/victory-celebration.tsx:153` |
| Trigger | Synchronous click on the Save Victory treasure button (pre-mint) |
| Payload | `{ context: "endgame_win" }` |
| Dedupe gate | None — one tap = one event. The button is disabled by `gameRecordPersisted` upstream, so a mid-persist tap can't fire. |

#### `monetization.save_victory_success`

| Field | Value |
|---|---|
| Fires from | `apps/web/src/components/arena/victory-claim-success.tsx:80` |
| Trigger | useEffect on mount of `VictoryClaimSuccess` (claimPhase === "success" branch) |
| Payload | `{ context: "endgame_win" }` |
| Dedupe gate | useEffect deps `[difficulty, moves]` — fires once per mount (a new game produces new moves/difficulty, allowing the event to re-fire for the next victory) |
| Notes | This is the M1 SUCCESS signal for the funnel. M2 may reconcile this against on-chain tx receipts; for M1 it's an in-memory mount signal. |

### 2.4 PRO surface events

#### `monetization.pro_sheet_view`

| Field | Value |
|---|---|
| Fires from | `apps/web/src/components/pro/pro-sheet.tsx:163` |
| Trigger | useEffect on `open=false → open=true` transition, gated by `viewedRef` (one-per-open) |
| Payload | `{ active: boolean }` |
| Dedupe gate | `viewedRef.current` set to true after first emit; reset to false when `open=false` so the next open re-emits |
| Notes | Parallel to legacy `pro_card_viewed { surface: "sheet" }` which fires from the same useEffect. Both events coexist. |

#### `monetization.pro_chip_view`

| Field | Value |
|---|---|
| Fires from | 2 callsites (only one runs in production) |
| Callsite 1 (PROD) | `apps/web/src/components/hub/hub-scaffold-client.tsx:316` — fires in the existing `pro_training_card_viewed` useEffect, one-per-mount gated by `proTrainingCardViewedRef` |
| Callsite 2 (DEV) | `apps/web/src/components/pro/pro-chip.tsx:56` — fires on ProChip mount, gated by `viewedRef`. ProChip is NOT mounted in production (the Hub uses PremiumSlot); this callsite covers the dev fixture and any future swap. |
| Payload | `{ active: boolean, daysRemaining: number \| null }` |
| Dedupe gate | Per-callsite ref (hub-scaffold's mount-once useEffect / ProChip's viewedRef) |

#### `monetization.pro_chip_tap`

| Field | Value |
|---|---|
| Fires from | 2 callsites (only one runs in production) |
| Callsite 1 (PROD) | `apps/web/src/components/hub/hub-scaffold-client.tsx:400` — Hub PremiumSlot tap via `onProTap` |
| Callsite 2 (DEV) | `apps/web/src/components/pro/pro-chip.tsx:68` — ProChip click handler. Dev fixture only. |
| Payload | `{ active: boolean, daysRemaining: number \| null }` |
| Dedupe gate | None — one tap = one event |

#### `monetization.pro_expiring_view`

| Field | Value |
|---|---|
| Fires from | 2 callsites (try/catch branches of the same flow) |
| Callsite 1 | `apps/web/src/components/hub/hub-scaffold-client.tsx:330` — happy path, sessionStorage was readable and value was new |
| Callsite 2 | `apps/web/src/components/hub/hub-scaffold-client.tsx:337` — fail-open path, sessionStorage threw (private-mode iframe). Ships the event anyway so signal isn't lost. |
| Payload | `{ daysRemaining: number }` |
| Trigger | useEffect fires when `pro.active && pro.daysRemaining <= 7 && address && proStatus?.expiresAt` |
| Dedupe gate | sessionStorage key `chesscito:pro-expiring-chip-shown` with value `wallet:expiresAt`. The event fires at most once per session per (wallet, expiresAt) tuple. A mid-session renewal changes expiresAt → key value changes → next eligible mount re-fires. |
| Notes | The fail-open branch is intentional: telemetry signal trumps dedupe in private-mode contexts where sessionStorage throws on read or write. |

#### `monetization.pro_expired_view`

| Field | Value |
|---|---|
| Fires from | `apps/web/src/components/profile/profile-sheet.tsx:93` |
| Trigger | useEffect fires when `open && proRowState.kind === "expired"` and `expiredViewedRef.current === false` |
| Payload | `{}` (empty — the state itself is the signal) |
| Dedupe gate | `expiredViewedRef.current` set to true after first emit; reset to false on sheet close so the next open re-emits |
| Notes | Account row only renders in `expired` state when the user previously held PRO (status carries non-null `expiresAt`). Free users who never bought PRO never trigger this event. |

#### `monetization.pro_renew_tap`

| Field | Value |
|---|---|
| Fires from | `apps/web/src/components/profile/profile-sheet.tsx:102` |
| Trigger | `handleProRenewTap` click on the Account PRO row Renew button |
| Payload | `{ context: "account_row" \| "expiring_chip" \| "expired_row" }` |
| Context values | `account_row` (active, > 7 days), `expiring_chip` (active, ≤ 7 days), `expired_row` (expired) |
| Dedupe gate | None — one tap = one event |
| Notes | The tap closes ProfileSheet first (`onOpenChange(false)`) then opens the local ProSheet via `proSheet.openSheet()`. No Sheet stacking. |

### 2.5 Shop events

#### `monetization.shop_item_view`

| Field | Value |
|---|---|
| Fires from | `apps/web/src/components/exercises/shop-sheet.tsx:171` |
| Trigger | useEffect on mount of `ShopItemCard`, gated by `viewedRef` |
| Payload | `{ item_id: number, position: number, tier: "pro" \| "coach" \| "shield" \| "founder" }` |
| item_id | `Number(item.itemId)` (bigint narrowed to number for JSON serialization) |
| position | Zero-based render index within the Shop display order. Hero lane = 0, 1. Mini lane = 2, 3 (after the optional Welcome Pack tile which does NOT emit). |
| Tier values | Derived from `copyKeyForItem` via `tierForCopyKey`: `pro` → `pro`, `coachPack5/coachPack20` → `coach`, `retryShield` → `shield`, `founderBadge` → `founder` (type completeness only — Founder is hidden from the Shop in M1, never emits). |
| Dedupe gate | `viewedRef.current` set to true after first emit. Re-renders driven by purchase state don't re-emit. |
| Notes | Welcome Pack tile is a distinct component (`WelcomePackTile`, not `ShopItemCard`) and does NOT emit `shop_item_view`. If Welcome Pack telemetry is needed, it lands in a separate commit. |

## 3. Cross-cutting matrix — events × surfaces

| Surface | Events emitted |
|---|---|
| Endgame loss/resign popup (`arena-end-state.tsx` loss branch) | `coach_review_offered`, `coach_review_tap`, `play_again_tap` |
| Endgame draw/stalemate popup (same file, draw branch) | `coach_review_offered`, `coach_review_tap`, `play_again_tap` |
| Endgame win celebration (`victory-celebration.tsx`) | `save_victory_tap`, `coach_review_tap (source=endgame)` |
| Endgame win post-mint (`victory-claim-success.tsx`) | `save_victory_success`, `coach_review_tap (source=save_success)` |
| Coach paywall sheet (`coach-paywall.tsx`) | `coach_paywall_view`, `coach_paywall_preview_view`, `coach_paywall_dismiss`, `coach_paywall_convert` |
| PRO sheet (`pro-sheet.tsx`) | `pro_sheet_view` |
| Hub PremiumSlot via `hub-scaffold-client.tsx` | `pro_chip_view`, `pro_chip_tap`, `pro_expiring_view` |
| Account PRO row (`profile-sheet.tsx`) | `pro_expired_view`, `pro_renew_tap` |
| Shop tiles (`shop-sheet.tsx`) | `shop_item_view` |
| ProChip dev fixture only | `pro_chip_view`, `pro_chip_tap` (parallel to prod hub-scaffold callsites) |

## 4. Context / source / tier / reason vocabularies

| Field | Allowed values |
|---|---|
| `context` (endgame surfaces) | `endgame_loss`, `endgame_resign`, `endgame_draw`, `endgame_win` |
| `context` (PRO renew) | `account_row`, `expiring_chip`, `expired_row` |
| `source` (coach_review_tap) | `endgame` (pre-mint celebration), `save_success` (post-mint claim success). Loss/resign/draw don't carry source. |
| `tier` (paywall convert) | `pack_5`, `pack_20`, `pro` |
| `tier` (shop_item_view) | `pro`, `coach`, `shield`, `founder` (founder type-only, never emitted in M1) |
| `reason` (paywall dismiss) | `explicit`, `backdrop` |

Any new value added in a future commit MUST be documented here.

## 5. Dedupe gates summary

| Pattern | Used by |
|---|---|
| `useEffect` once-per-open `ref` reset on close | `coach_paywall_view`, `coach_paywall_preview_view`, `pro_sheet_view`, `pro_expired_view` |
| `useEffect` once-per-mount `viewedRef` (no reset) | `pro_chip_view` (ProChip), `shop_item_view` |
| `useEffect` once-per-mount with deps that change per game | `save_victory_success` (deps: difficulty, moves) |
| `useEffect` with structural-change deps | `coach_review_offered` (re-fires on status/context change), `pro_chip_view` (hub-scaffold, gated by `proTrainingCardViewedRef`) |
| sessionStorage cross-render gate | `pro_expiring_view` (`chesscito:pro-expiring-chip-shown` = `wallet:expiresAt`) |
| Click-only, no de-dupe | `coach_review_tap`, `play_again_tap`, `save_victory_tap`, `coach_paywall_convert`, `pro_chip_tap`, `pro_renew_tap` |
| `explicitDismissRef` to prevent double-fire | `coach_paywall_dismiss` (explicit Later/PRO tap blocks the backdrop branch) |

## 6. Legacy events preserved (not replaced)

M1 introduces `monetization.*` events ALONGSIDE legacy telemetry. No legacy event was removed or repurposed — existing dashboards continue working. The intentional coexistence:

| Monetization event | Legacy event that coexists | Why both |
|---|---|---|
| `monetization.pro_chip_view` | `pro_card_viewed { surface: "chip" \| "sheet" }`, `pro_training_card_viewed` | Legacy dashboards consume the existing events; M1 funnel rolls up under the new namespace |
| `monetization.pro_chip_tap` | `pro_cta_clicked { source: ... }`, `hub_pro_chip_tap`, `hub_pro_tile_tap` | Same — legacy dashboards intact |
| `monetization.coach_review_tap` | `coach_victory_analyze_tap { position, too_short }` | Coach existing telemetry kept untouched |
| `monetization.pro_renew_tap` | `pro_extend_tap { source }`, `pro_cta_clicked { source: "sheet_renew" }`, `pro_active_cta_tap` | Multiple legacy paths for renew preserved |
| `monetization.coach_paywall_*` | None directly equivalent — paywall is a new commercial surface | N/A |
| `monetization.save_victory_*` | `modal_open { id: "victory-celebration" \| "victory-claim-success" }` | Modal-open is generic; save_victory_* is funnel-specific |
| `monetization.shop_item_view` | `shop_viewed`, `shop_item_tap`, `shop_purchase_start/success/failed` | Shop legacy events untouched (purchase flow uncovered by Commit 7) |
| Other endgame events | `modal_open { id: "arena-loss" }` | Legacy modal_open continues |

### 6.1 Coach existing telemetry (separate namespace)

The `coach.*` namespace from `analyze-telemetry.ts` (6 events: `coach.analyze.request`, `coach.analyze.idempotent_hit`, `coach.analyze.failed`, `coach.viewer.viewed`, `coach.ask_coach.tap`, `coach.mint_receipt.write`) is preserved as a parallel observability surface. M1 does not modify or replace this namespace.

## 7. Intentionally NOT implemented in M1

### 7.1 `monetization.pro_renew_success`

**Status:** Deferred to M2.

**Why:** Wiring `pro_renew_success` would require touching `useShopSheetState`, `/api/verify-pro`, or the purchase-flow callbacks to know when a renewal transaction confirms. M1 explicitly avoided modifying the purchase flow to keep the cluster scoped to UI + funnel telemetry. The reconciler / post-tx verification cluster (M2) is the right place to add this event since that work already involves purchase-flow internals.

**M2 entry point:** when M2 introduces the post-tx reconciler (audit §10 P1 deuda — "Sin reconciliador de tx pagada que falla en /api/verify-pro"), emit `monetization.pro_renew_success { context, tx_hash }` after the verify-pro response confirms `active: true` with the updated `expiresAt`.

### 7.2 Welcome Pack telemetry

**Status:** Out of M1 scope.

**Why:** Welcome Pack tile (`WelcomePackTile`) is a distinct component from `ShopItemCard`. Emitting `monetization.welcome_pack_view` / `welcome_pack_claim_tap` requires touching `WelcomePackTile`'s mount logic + claim handlers. Welcome Pack as a server-side bundle is also a deferred item (M2/M3 per inventory doc §F).

### 7.3 Founder Badge events

**Status:** Not applicable in M1.

**Why:** Founder Badge is hidden from the Shop display (Commit 7, D-M1.2 Opción A). The `tier: "founder"` type value exists for type completeness only — no callsite emits with `tier: founder` since the tile never renders.

### 7.4 Granular tap events for Welcome Pack / Founder inventory rows

**Status:** Out of M1 scope.

**Why:** Account inventory rows for Welcome Pack / Founder (if they exist) consume `useFounderStatus` / `useWelcomePackClaim` upstream. Adding monetization telemetry there would require touching surfaces that are outside the M1 funnel boundaries.

## 8. Sink + persistence

M1 uses the existing `@/lib/telemetry` `track()` sink. Events fire to the same in-memory / console logger that consumed legacy events pre-M1. No new analytics provider was introduced.

**M2 backend deuda (per inventory doc §D4):** persist `monetization.*` events (and existing legacy events) into Supabase `analytics_events` table. The persistence work is a separate cluster from M1 funnel UI/copy. Once the table lands, this contract becomes the authoritative schema reference for the writer.

**Schema guarantees for M2 backend ingestion:**
- Event names are stable strings (`monetization.<surface>_<verb>`).
- Payload keys are stable (see §2 per-event tables).
- Context/source/tier/reason vocabularies are stable (see §4).
- Numeric fields (`daysRemaining`, `position`, `item_id`) are JSON-safe (`number`, possibly `null` for daysRemaining).

## 9. Verification commands

To re-audit the inventory against the current repo state:

```sh
# All monetization.* events:
rg -n 'track\(\s*"monetization\.' apps/web/src

# All legacy events still alive (verify §6 hasn't drifted):
rg -n 'track\("(pro_|hub_pro|coach_victory|modal_open|shop_)' apps/web/src

# Coach existing namespace:
rg -n 'track\("coach\.' apps/web/src
```

If a future commit adds a new `monetization.*` callsite, the audit will surface it; update §2 + §3 + §4 accordingly.

## 10. References

- M1 plan: `docs/plans/chesscito-monetization-m1-commit-plan-2026-06-01.md`
- M1 direction: `docs/product/chesscito-monetization-direction-2026-06-01.md`
- M1 funnel map: `docs/product/chesscito-monetization-funnel-map-2026-06-01.md`
- M1 inventory + deuda técnica: `docs/product/chesscito-current-monetization-inventory-2026-06-01.md`
- Commercial copy rules: `docs/product/chesscito-commercial-copy-rules-2026-06-01.md`
- Strategic audit base: `docs/monetization/2026-06-01-strategic-audit.md`
- Coach existing telemetry: `apps/web/src/lib/analytics/analyze-telemetry.ts`
