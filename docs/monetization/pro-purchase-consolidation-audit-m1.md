# Chesscito M1 — PRO Purchase Consolidation Audit + Deferred Decision

**Date:** 2026-06-02
**Author:** Clausita (audited from the actual repo state on commit `cc7879f7`).
**Status:** **Decision taken in M1 — Option 3 (defer + document)**. No code touched in M1 Commit 9.

This document closes M1 by recording the audit of the **deuda P0** ("Lógica duplicada de compra PRO") identified in `docs/monetization/2026-06-01-strategic-audit.md §2` and re-listed in `docs/product/chesscito-current-monetization-inventory-2026-06-01.md §H` as the first P0 item. The audit was triggered by Commit 9 of the M1 plan, but the migration was deferred after a pre-edit exploration revealed that the work is **structural refactor**, not drop-in replacement.

## 1. Current findings (audited from repo)

### 1.1 `apps/web/src/components/exercises/exercises-screen.tsx` — two parallel flows live in this file

**Flow A — PRO sheet purchase (own implementation):**

- Lines 1640-1688: `handlePurchasePro` wraps the shared helper `executeProPurchase` from `apps/web/src/lib/pro/purchase.ts`.
- Lines 706-712: own state machine — `proPurchaseState: "idle" | "purchasing" | "verifying"`, `proPurchaseError: string | null`, `verifyFailedTxHash: string | null`, `isRetryingVerify: boolean`.
- Lines 1690-1728: own `handleRetryVerify` with its own POST to `/api/verify-pro` for the retry-after-failure case.
- Lines 2236-2248: own `<ProSheet>` mount that consumes the local state machine directly (not via `useProSheetState`).
- Telemetry emitted inline: `pro_purchase_started`, `pro_purchase_confirmed`, `pro_purchase_failed`, `pro_verify_retry_failed`.

**Flow B — Shop sheet purchase (own implementation):**

- Lines 1730-1864: `handleConfirmPurchase` — generic Shop confirm handler. Inside this, lines 1841-1864 are a PRO-specific branch that fires a **second** POST to `/api/verify-pro` when `selectedItem.itemId === PRO_ITEM_ID`. Fire-and-forget activation hook.
- This is the literal "duplicate verify-pro POST" the audit flagged.

### 1.2 `apps/web/src/lib/shop/use-shop-sheet-state.ts` — modern Shop sheet hook

- Line 528-538: when `selectedItem.itemId === PRO_ITEM_ID`, the hook performs the canonical PRO activation: `await fetch("/api/verify-pro", ...)` inline (NOT fire-and-forget) followed by state update.
- Used by `hub-scaffold-client.tsx` to render the Shop sheet on the modern Hub surface.
- Owns its own ProSheet sheetProps (via composition with `useProSheetState`).
- Cannot be invoked from exercises-screen.tsx today — exercises-screen.tsx has its own custom rendering that does not consume this hook.

### 1.3 `apps/web/src/lib/pro/use-pro-sheet-state.ts` — modern PRO sheet hook

- Line 192: wraps `executeProPurchase` with its own state machine (parallel to exercises-screen.tsx but separate code).
- Used by `hub-scaffold-client.tsx` for the Hub PremiumSlot tap → ProSheet flow.
- Used by `profile/profile-sheet.tsx` (Commit 6) for the Account PRO row renew flow.

### 1.4 `apps/web/src/lib/pro/purchase.ts` — shared helper, NOT duplicated

- `executeProPurchase` is consumed by both exercises-screen.tsx:1646 AND use-pro-sheet-state.ts:192.
- The helper itself is shared, so the on-chain TX sequence (approve → buy → wait receipt → verify-pro) is implemented once.
- The duplication lives in the **state machines that wrap the helper**, not in the helper itself.

### 1.5 Real duplication scope

The **actual duplicate** the audit identified is:

1. The `/api/verify-pro` POST inside `handleConfirmPurchase` (exercises-screen.tsx:1850), fire-and-forget, racing whatever `useShopSheetState` would have done on the modern path.
2. The full state machine in exercises-screen.tsx that mirrors the modern hooks (`useShopSheetState` + `useProSheetState`).

Removing just the fire-and-forget POST (#1) without refactoring the surrounding state (#2) would break PRO activation when a user buys PRO from the Shop sheet rendered by exercises-screen.tsx (since exercises-screen does not call `useShopSheetState`).

## 2. Why M1 defers the consolidation

The migration **cannot ship safely in a single M1 commit** for these reasons:

1. **Structural, not drop-in.** Removing the duplicate POST means migrating exercises-screen.tsx to consume `useShopSheetState` + `useProSheetState`. That is a refactor of ~150-250 LOC across an intertwined component (Shop ResultOverlay, ProSheet rendering, ShareModal, BadgeSheet, TrophiesSheet all share local state machinery in exercises-screen).
2. **No integration test harness.** The M1 audit (§G1) explicitly notes "Sin test de integración del flow completo (compra on-chain → verify → estado activo). Solo tests unitarios." Without integration tests, regression in the PRO purchase path could ship to production silently.
3. **Revenue path sensitivity.** PRO purchase is the M1 recurrence motor. MiniPay smoke is a manual check today; without VR + integration tests, a subtle regression (e.g., `pro_purchase_confirmed` telemetry shape drift) would not be caught before users hit it.
4. **Telemetry parity uncertainty.** `useProSheetState` may or may not emit the exact payload shape of `pro_purchase_started` / `pro_purchase_confirmed` / `pro_purchase_failed` / `pro_verify_retry_failed` that exercises-screen.tsx currently emits inline. Verifying parity requires reading both implementations side by side — not a 30-minute task.
5. **MiniPay impact unknown.** /exercises is reachable on MiniPay and is part of the legacy entry flow. A broken Shop or PRO purchase there silently breaks revenue without a clear regression signal.

Conclusion: the migration is the right thing to do, but the **cost of getting it wrong** in a single commit without harness exceeds the cost of leaving the duplication for a dedicated cluster.

## 3. Options evaluated

| Option | What it does | Risk | Decision |
|---|---|---|---|
| **1 — Full migration** | Migrate exercises-screen.tsx to consume `useShopSheetState` + `useProSheetState`. Remove all local PRO state machines and the duplicate verify-pro POST. | High. ~150-250 LOC change in a 2000+ LOC critical file. Telemetry parity must be hand-verified. MiniPay regression is silent without integration tests / VR. | NOT taken in M1. |
| **2 — Surgical redirect** | Remove the duplicate verify-pro POST (exercises-screen.tsx:1841-1864). Redirect Shop sheet PRO tile taps in /exercises to open the ProSheet instead of confirming a purchase inline. | Medium. Changes Shop behavior in /exercises (PRO can no longer be bought from there directly). Hybrid flow inconsistency between Hub Shop and exercises Shop. | NOT taken in M1. |
| **3 — Defer + document** | Close M1 with the duplication intact. Document the deuda + post-M1 plan + acceptance criteria. Open a dedicated chore for the migration when integration test harness lands. | Low. No code touched. Funnel ships fully functional. Server-side `coach:pro:processed-tx:{txHash}` idempotency guard already prevents double-charge so the duplication is purely client-side maintenance burden, not a customer-facing bug. | **TAKEN in M1.** |

## 4. Recommended plan post-M1

This work belongs to a dedicated cluster (post-M1, before or alongside M2 backend). Recommended steps in order:

1. **Build integration test harness for PRO purchase.** Mock harness covers: wagmi `writeContractAsync`, `waitForReceipt`, fetch `/api/verify-pro`, ProSheet sheetProps wiring. Test cases:
   - happy path (sign → tx → verify → state active);
   - verify-failed retry (idempotency check, no double-charge);
   - tx cancelled (no verify POST);
   - tx timeout (verify-failed surface);
   - mid-flight purchase guard (no double tap).
2. **Verify telemetry parity** between exercises-screen.tsx inline events and the modern hook events. If the hooks don't emit identical payloads, the hooks must be extended FIRST so the migration preserves dashboards.
3. **Migrate Shop sheet in exercises-screen.tsx to `useShopSheetState`.** Replace `handleConfirmPurchase`, `selectedItem` state, `purchasePhase`, `paymentToken`, `confirmOpen`, `storeOpen` — all the Shop state — with the hook's `sheetProps` + `confirmProps`. Preserves ResultOverlay handling by adapting it to the hook's success/error surface.
4. **Migrate PRO sheet in exercises-screen.tsx to `useProSheetState`.** Replace `handlePurchasePro`, `proPurchaseState`, `proPurchaseError`, `verifyFailedTxHash`, `isRetryingVerify`, `handleRetryVerify`, `proSheetOpen` — all the PRO state — with the hook. ProSheet mount drops to `<ProSheet {...proSheet.sheetProps} />`.
5. **Remove the duplicate `/api/verify-pro` POST** (exercises-screen.tsx:1841-1864). After steps 3-4, the Shop purchase will route through `useShopSheetState` which already handles verify-pro, so the inline POST becomes dead code naturally.
6. **Add `monetization.pro_renew_success`** when the post-migration flow exposes a clean success callback. The audit doc `telemetry-events-m1.md §7.1` documented this as deferred to M2 precisely because tracking success required touching the purchase flow — the migration is the entry point.
7. **Manual MiniPay smoke** before merge: buy PRO from Hub Shop, buy PRO from /exercises Shop (if surface kept), buy PRO from ProSheet direct, test retry-verify on a forced failure.
8. **VR refresh** for any surface that changed visually.

## 5. Acceptance criteria (future)

The follow-up cluster is considered done when:

- [ ] Single client-side callsite for `POST /api/verify-pro` (verifiable via `rg -n "fetch.*verify-pro" apps/web/src` returns one match).
- [ ] No double POST per purchase (network tab inspection on MiniPay smoke).
- [ ] PRO purchase from Hub Shop sheet works (sign → tx → verify → active).
- [ ] PRO purchase from /exercises (if surface kept) works OR documents the redirect to ProSheet.
- [ ] PRO purchase from ProSheet direct works on both Hub and /exercises.
- [ ] Legacy telemetry preserved: `pro_purchase_started`, `pro_purchase_confirmed`, `pro_purchase_failed`, `pro_verify_retry_failed`, `pro_card_viewed`, `pro_cta_clicked`, `pro_extend_tap`, `pro_active_cta_tap`, `hub_pro_chip_tap`, `hub_pro_tile_tap`, `pro_training_card_viewed`, `pro_training_card_cta_tap`.
- [ ] M1 monetization telemetry preserved: `monetization.pro_sheet_view`, `monetization.pro_chip_view`, `monetization.pro_chip_tap`, `monetization.pro_expiring_view`, `monetization.pro_expired_view`, `monetization.pro_renew_tap`.
- [ ] New event `monetization.pro_renew_success { context, tx_hash }` fires after verify-pro confirms `active: true`.
- [ ] `pnpm type-check`, `pnpm test`, and MiniPay smoke all pass.
- [ ] Integration test harness committed alongside the migration (no migration without harness).

## 6. Cross-references

- Inventory doc updated with deferred status: `docs/product/chesscito-current-monetization-inventory-2026-06-01.md` §H (P0 — note added).
- Commit plan updated with deferred status: `docs/plans/chesscito-monetization-m1-commit-plan-2026-06-01.md` Commit 9 section (note added).
- Telemetry contract: `docs/monetization/telemetry-events-m1.md` §7.1 (`pro_renew_success` deferred to M2, no change needed — the M2 entry point for this event is precisely this migration cluster).
- Strategic audit base: `docs/monetization/2026-06-01-strategic-audit.md` §2 (original deuda P0 description).
- Helper module that stays shared (no migration needed): `apps/web/src/lib/pro/purchase.ts`.
- Modern hooks consumed in Hub today: `apps/web/src/lib/shop/use-shop-sheet-state.ts`, `apps/web/src/lib/pro/use-pro-sheet-state.ts`.
- Component holding the duplication: `apps/web/src/components/exercises/exercises-screen.tsx`.
