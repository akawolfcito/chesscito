# Red Team — `useShopSheetState` port to scaffold

**Date**: 2026-05-08
**Target plan**: extract shop sheet orchestration from `<PlayHubRoot>` (1612 LOC) into `useShopSheetState()` hook + wire into `<HubScaffoldClient>`, killing the last `?legacy=1&action=shop` round-trip.
**Reviewer mode**: adversarial — assume the plan is wrong until proven otherwise.

---

## P0 — Must address before shipping

### P0-1. Orphan `<SheetTrigger>` already mounted in scaffold (BadgeSheet) — same trap waits for ShopSheet
**Evidence**: `badge-sheet.tsx:227-247` renders `<SheetTrigger asChild>` wrapping a `<button>` with `badge-menu.png`. Radix renders trigger children unconditionally. Scaffold mounts `<BadgeSheet {...sheetProps} />` at `hub-scaffold-client.tsx:291` — that orphan button is in the DOM right now, *currently shipped*. Same pattern repeats with `shop-menu.png` if we copy the strategy 1:1.
**Risk**: visible orphan icon outside the dock, `aria-label="Shop"` polluting accessibility tree, possible tap target eating clicks.
**Fix**: split the sheet component into `<XSheet>` (controlled, no trigger) + `<XSheetTrigger>` (the icon button) — OR pass `trigger?: ReactNode` prop and skip the `<SheetTrigger>` wrapper entirely when not provided. Apply retroactively to BadgeSheet too.
**Verification gap**: I cannot confirm the orphan is visible without `pnpm dev` + DOM inspection. Owner must verify before/after.

### P0-2. `chesscito:shields` localStorage write doesn't refresh the scaffold's chip
**Evidence**: scaffold reads shields once on mount via `loadShieldCount()` (`hub-scaffold-client.tsx:67`). Hook writes `localStorage.setItem("chesscito:shields", ...)` after receipt confirms (`play-hub-root.tsx:578`). No `storage` event fires in the same tab. Result: user buys a Retry Shield, sees sheet close, chip still shows old count until full reload.
**Risk**: silent UX regression — purchase appears to do nothing, opens support burden ("did my shields show up?").
**Fix**: hook must expose `shieldCount` (or a `shieldsBumpedAt` timestamp) so scaffold can subscribe; OR fire a custom event `window.dispatchEvent(new Event("chesscito:shields-changed"))` and have scaffold listen. Pick one and stick with it.

### P0-3. Shop success has zero UI feedback in scaffold (no `<ResultOverlay>`)
**Evidence**: legacy fires `setResultOverlay({ variant: "shop", txHash })` after `buyItem`. Plan defers ResultOverlay (parity with badges port). For badges we shipped an inline success banner as compensation. Plan as written ships **nothing** for shop.
**Risk**: user pays $0.025 / $0.10, sheet closes, no confirmation. Worse than badges (badges had inline banner). For a real-money flow this is unacceptable.
**Fix**: add an inline banner inside ShopSheet (analog to BadgeSheet success banner from `b31c067`), OR keep the sheet open in a `phase="success"` state with a tx-hash chip + "Done" button before closing. Cannot ship without one of these.

---

## P1 — Should address before shipping

### P1-1. `closeSheet` mid-tx guard missing for confirm sheet
**Evidence**: PRO sheet (`use-pro-sheet-state.ts:125`) blocks close while `purchaseState !== "idle"`. Shop's `<PurchaseConfirmSheet>` (`play-hub-root.tsx:1383`) does the same with `purchasePhase`. Plan must replicate — if dropped, user can dismiss the sheet mid-approve, the buy still fires async, and state updates land on an unmounted component.
**Fix**: include the guard in `confirmSheetProps.onOpenChange`.

### P1-2. State updates after unmount during approve→buy window
**Evidence**: `handleConfirmPurchase` does `await waitForReceiptWithTimeout(approveHash)` which can take 5-30s on Celo. If user navigates away (back button) the hook unmounts but the in-flight promise still calls `setPurchasePhase("buying")` etc. → React warning, possible memory leak.
**Risk**: legacy has the same bug, but porting is a chance to fix it cheaply.
**Fix**: track `isMountedRef` or use `AbortController` and gate setState calls. Optional cleanup, not blocking.

### P1-3. `selectPaymentToken(price)` returns `null` when balances haven't loaded yet
**Evidence**: `play-hub-root.tsx:514` — `if (!tokenBalances) return null`. User taps a card before the `useReadContracts` query settles → `paymentToken` set to null → confirm sheet shows "no funds" even with funds.
**Risk**: false-negative purchase block on slow networks / first interaction.
**Fix**: gate the card CTA `disabled` on a `balancesReady` flag from the hook, OR delay the user's tap → confirm transition until balances resolve.

### P1-4. `isCorrectChain` early-return is silent
**Evidence**: `handleConfirmPurchase:1001` — `if (!selectedItem || !address || !shopAddress || !isCorrectChain) return;` — no error set. If user is connected on wrong chain and clicks confirm, button does nothing.
**Risk**: existing UX gap; surface as part of the port instead of perpetuating it.
**Fix**: when `!isCorrectChain`, set `errorMessage` to "Wrong network" + render a "Switch network" CTA (PRO sheet already does this).

### P1-5. `pendingShieldCredit` is lost across hook unmount
**Evidence**: state lives in the hook. Buy tx fires, `pendingShieldCredit=true`, hook unmounts (user navigates away), receipt confirms later — useEffect never runs, shields never credited. Localstorage receipt watching dies with the hook.
**Risk**: paid for shields, never received them. Existing legacy bug; porting reproduces it.
**Mitigation**: not a regression. Track as a P2 follow-up — proper fix is server-side credit on receipt verification, not client-side polling.

### P1-6. `displayShopCatalog` `isReady` gate is a UX trade — not a clear win
**Evidence**: my prior suggestion to gate on `isReady` to kill the CELO-button flash inside MiniPay.
**Risk**: outside MiniPay, `isReady=false` for one tick means the catalog renders **without** the CELO button on first paint, then it appears. That's the opposite of the MiniPay flash but visible to ~99% of users (everyone outside MiniPay).
**Fix**: keep behavior identical to legacy (no `isReady` gate) — strictly port, don't reshape. Revisit as a separate UX ticket if needed.

---

## P2 — Worth noting, not blocking

### P2-1. Telemetry parity
- `track("shop_buy_tx", { stage, source, item_id, error_kind? })` — must preserve every emission point and field shape exactly. Dashboards depend on `source: "shop_retry_shield" | "shop_founder_badge"`. Verify with a grep in `lib/telemetry/*` or whatever consumer config exists.
- No equivalent of `hub_view` — scaffold already fires that. Don't duplicate.

### P2-2. Test surface beyond the proposed 7-9 cases
Cases the plan glosses over:
- mid-purchase close blocked while `purchasePhase !== "idle"`
- allowance-skip path (allowance >= total → skip approve)
- error fanout: cancel / timeout / generic / each maps to correct `errorKind`
- pendingShield gating: `isShopConfirmed && pendingShieldCredit` clamps to MAX_SHIELDS
- CELO sibling visibility branch (MiniPay vs not, sibling configured vs not)
- balances-not-loaded → `paymentToken=null` semantics

Plan upgrade: bump test count to ~12, write the surface explicitly.

### P2-3. Direct-URL bookmarks `/hub?legacy=1&action=shop`
After we kill `legacyHubFor("shop")`, that URL still works because `<PlayHubRoot>` is still mounted via `?legacy=1`. That's fine — handoff explicitly defers PlayHubRoot deletion. No action.

### P2-4. Scaffold doesn't have a "shop" entry equivalent to dock icon
Currently shields chip is the only entry. If we want the trigger button to live somewhere else (the legacy persistent dock had a dedicated shop icon), discuss before porting. Plan doesn't introduce a new entry — `onShieldsTap → openSheet` is the only one.

---

## Summary — what changes in the plan

| Item | Decision |
|------|----------|
| **P0-1** orphan trigger | Refactor sheet API: separate `<ShopSheet>` (controlled) from `<ShopSheetTrigger>` — apply same fix to BadgeSheet |
| **P0-2** shield count refresh | Hook returns `shieldCount` + scaffold subscribes (or custom event) |
| **P0-3** zero UI feedback on success | Inline success banner inside ShopSheet (mirror BadgeSheet pattern from `b31c067`) |
| **P1-1** mid-tx close guard | Replicate from PRO hook, no excuse to skip |
| **P1-2** unmount setState | `isMountedRef` guard — fix in port, not later |
| **P1-3** balances-not-loaded | Gate CTA `disabled` on `balancesReady` |
| **P1-4** wrong-chain silent | Surface "Switch network" path |
| **P1-5** lost shield credit | Document as known issue, NOT fixed in this port |
| **P1-6** `isReady` gate | DROP from plan — keep parity |
| **P2-1** telemetry parity | Verify before commit |
| **P2-2** tests | Bump to ~12, list explicit cases |

## Updated ship criteria

- All P0 closed (no orphan trigger, shields chip refreshes, success banner present)
- P1-1, P1-2, P1-3, P1-4 implemented (mid-tx guard, unmount safety, balances gate, wrong-chain surface)
- `pnpm test` ≥1018 green (1006 + 12 new)
- `tsc --noEmit` clean
- Manual smoke in dev server: tap shields → ShopSheet opens, tap a card → ConfirmSheet, complete a (testnet) purchase → success banner shows + shields chip increments without reload
- BadgeSheet retroactively patched for orphan trigger (P0-1) — single PR or a follow-up before merge

## Recommendation

**Do not proceed with the plan as written.** Three P0s are blockers and one of them (orphan trigger) implicates already-shipped code. Re-scope: (1) refactor sheet API to separate trigger, (2) bump scaffold to subscribe to shield changes, (3) ship inline success banner. Then port. Estimated cost upgrade: ~1.5h on top of the 3-4h baseline.
