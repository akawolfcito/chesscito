# CELO MiniPay Runtime Audit — Closing P1-6

**Date:** 2026-06-03
**Mode:** read-only audit + 1 strengthening test (Option B per agreed plan).
**Scope:** confirm that CELO is never exposed as a payment option when `isMiniPay === true`, across all consumer surfaces.
**Outcome:** **closed by audit, no code change required.** One test added in `use-pro-sheet-state.test.tsx` to convert the implicit invariant ("PRO never settles in CELO") into an explicit tripwire.

---

## TL;DR

All three payment surfaces (Shop founder badge, PRO subscription, Coach credits) correctly hide CELO from MiniPay users. The Shop case is explicitly gated by `!isMiniPay && celoSibling != null` (and tested both directions). PRO is stricter: it never accepts CELO regardless of runtime, by passing `ACCEPTED_TOKENS` directly (not `BALANCE_READ_TOKENS`) to the selection helper and slicing the balances array to exclude the CELO tail.

The audit found **zero gaps**. The single test added is a strengthening tripwire: it proves the PRO selection invariant explicitly so a future change that widens PRO to CELO would fail CI.

P1-6 (CELO oculto en runtime MiniPay) is **closed**.

---

## 1. Consumers of CELO

Five payment-relevant consumers; three non-payment touchpoints.

### 1.1 Payment surfaces

| # | Consumer | File | Surface |
|---|---|---|---|
| 1 | Hub Shop sheet (canonical) | `apps/web/src/lib/shop/use-shop-sheet-state.ts` | `<ShopSheet>` from any dock |
| 2 | Hub Shop sheet (legacy mirror) | `apps/web/src/components/exercises/exercises-screen.tsx` | Same shop UI rendered from `<ExercisesScreen>` legacy path |
| 3 | PRO subscription | `apps/web/src/lib/pro/use-pro-sheet-state.ts` | `<ProSheet>` |
| — | UI render of `celoSibling` button | `apps/web/src/components/exercises/shop-sheet.tsx:243-247` | Transitive — button only renders if hook sets `celoSibling` |

### 1.2 Non-payment touchpoints

| # | Consumer | File | Why CELO appears |
|---|---|---|---|
| 4 | Server: founder badge ownership lookup | `apps/web/src/app/api/founder-status/route.ts:124` | Read-only API; reads ownership of both stablecoin (`itemId=1`) and CELO (`itemId=5`) founder routes. Doesn't expose CELO as a payment option to the user. |
| 5 | Static catalog declaration | `apps/web/src/lib/contracts/shop-catalog.ts:27,89` | `FOUNDER_BADGE_CELO_ITEM_ID = 5n` plus an entry in `SHOP_ITEMS`. Comment at line 26: *"CELO button stays hidden — same safe-default as itemId 2"*. Catalog is the data; filtering is consumer responsibility. |
| 6 | Token constant + warning comment | `apps/web/src/lib/contracts/tokens.ts:13` | Comment: *"MiniPay never offers CELO — its product spec is stablecoin-only."* Plus `CELO_TOKEN` and `CELO_ADDRESS_LOWER` exports. |

---

## 2. Gate inventory

### 2.1 Hub Shop (#1) — `lib/shop/use-shop-sheet-state.ts:282-296`

```ts
const celoSibling = shopCatalog.find(
  (item) => item.itemId === FOUNDER_BADGE_CELO_ITEM_ID && item.configured && item.enabled,
);
const showCeloOnFounder = !isMiniPay && celoSibling != null;
return shopCatalog
  .filter((item) => item.itemId !== FOUNDER_BADGE_CELO_ITEM_ID)
  .map((item) =>
    item.itemId === FOUNDER_BADGE_ITEM_ID && showCeloOnFounder
      ? { ...item, celoSibling: { itemId: FOUNDER_BADGE_CELO_ITEM_ID } }
      : item,
  );
```

- **Guard:** `!isMiniPay && celoSibling != null`. ✅
- **Effect:** inside MiniPay, the Founder Badge card is rendered without a `celoSibling`, so the "Buy with CELO" button never mounts. The standalone CELO catalog entry (itemId 5n) is also filtered out from the visible list.

### 2.2 Exercises legacy mirror (#2) — `components/exercises/exercises-screen.tsx:996-1007`

Identical logic to #1 (same files were extracted together; the component still carries the legacy copy alongside the extracted hook). Same guard. Same effect.

### 2.3 PRO subscription (#3) — `lib/pro/use-pro-sheet-state.ts:138-162`

```ts
// Token balances drive `selectPaymentToken` — same shape ExercisesScreen
// uses. CELO sits at the tail purely to share the read; PRO never
// settles in CELO, only stablecoins.
const BALANCE_READ_TOKENS = useMemo(() => [...ACCEPTED_TOKENS, CELO_TOKEN], []);
const { data: tokenBalances } = useReadContracts({
  contracts: BALANCE_READ_TOKENS.map((t) => ({ ... })),
  ...
});

const selectPaymentToken = useCallback(
  (priceUsd6: bigint) =>
    selectMaxBalanceToken(
      ACCEPTED_TOKENS,                                    // <-- stablecoins only
      tokenBalances?.slice(0, ACCEPTED_TOKENS.length),    // <-- drop CELO tail
      priceUsd6,
    ),
  [tokenBalances],
);
```

- **Guard:** stricter than #1/#2. CELO **never** offered, regardless of `isMiniPay`.
- **Effect:** even with 1000 CELO balance and 0 stablecoins, `selectPaymentToken(PRO_PRICE_USD6)` returns `null` → `handlePurchase` exits early with `track("pro_purchase_failed", { kind: "no-token" })`.
- **Intent doc:** the inline comment at lines 138-140 makes the invariant explicit in code; the test now (this audit) asserts it.

### 2.4 UI render (`shop-sheet.tsx:243-247`)

Renders `item.celoSibling` as a button. The button exists in the DOM only if the hook set `celoSibling`. The hook is gated. No independent path can set `celoSibling`.

### 2.5 Server API (`founder-status/route.ts:124`)

```ts
itemId: [FOUNDER_BADGE_ITEM_ID, FOUNDER_BADGE_CELO_ITEM_ID]
```

Read-only ownership check. Returns whether the user owns the badge regardless of which route they took to buy it. Does not surface CELO as a payment option to any client.

### 2.6 Catalog + token constants

`shop-catalog.ts` and `tokens.ts` are static data + library exports. The MiniPay invariant is the consumer's responsibility; both files document the expectation in comments.

---

## 3. Test coverage

### 3.1 Existing tests (before this audit)

| File | Lines | Coverage |
|---|---|---|
| `lib/shop/__tests__/use-shop-sheet-state.test.tsx` | 500-528 (2 cases) | ✅ "hides the CELO sibling button inside MiniPay" + "surfaces CELO sibling on Founder Badge outside MiniPay" + verifies the standalone CELO entry is filtered out of the visible list. |
| `lib/contracts/__tests__/shop-catalog.test.ts` | 34, 54 | ✅ `FOUNDER_BADGE_CELO_ITEM_ID === 5n` and present in `SHOP_ITEMS` with the founder copy key. |
| `lib/contracts/__tests__/tokens.test.ts` | 21 | ✅ `CELO_ADDRESS_LOWER` is not in `STABLECOIN_ADDRESSES_LOWER`. |
| `lib/pro/__tests__/use-pro-sheet-state.test.tsx` | 110 (comment) | ⚠️ Comment only: *"CELO sibling — never used by PRO but read in the same batch"*. The fixture happens to set CELO balance to 0, so the invariant is implicit, not asserted. |

### 3.2 Test added by this audit (PRO invariant tripwire)

A new case in `lib/pro/__tests__/use-pro-sheet-state.test.tsx` titled `"P1-6 invariant: never settles in CELO even when CELO is the only token with balance"`. It sets balances such that USDC, USDT, USDM are all 0 and CELO is huge (1000 CELO at 18 decimals), triggers `sheetProps.onPurchase()`, and asserts:

- `track("pro_purchase_failed", { kind: "no-token" })` fires.
- `pro_purchase_started` does NOT fire.
- `executeProPurchaseMock` is not called.

If a future commit widens PRO to include CELO (e.g. by removing the `slice(0, ACCEPTED_TOKENS.length)` or swapping `ACCEPTED_TOKENS` → `BALANCE_READ_TOKENS` in the call), the assertions fail and the change is blocked at CI.

### 3.3 Exercises-screen legacy mirror — left untested

The legacy mirror at `exercises-screen.tsx:999` shares identical logic with the extracted Hub Shop hook. Testing it would require mounting the 2000-line `<ExercisesScreen>` with mocked dependencies. The shared logic is validated by the extracted hook's tests; a refactor that consolidates both call sites onto the extracted hook is the structurally correct fix and is outside this audit's scope.

---

## 4. Why no code patch

| Question | Answer |
|---|---|
| Does any payment surface expose CELO inside MiniPay today? | No. |
| Is the Shop guard explicit in code? | Yes — `!isMiniPay && celoSibling != null`. |
| Is the PRO guard explicit in code? | Yes — `ACCEPTED_TOKENS` only + `slice(0, ACCEPTED_TOKENS.length)`. Stricter than Shop; doesn't depend on `isMiniPay`. |
| Is the Coach credits flow affected? | No — `useCoachCreditsPurchase` uses `ACCEPTED_TOKENS` directly with no CELO sibling concept. |
| Is the Victory mint flow affected? | No — same shape as Coach: `ACCEPTED_TOKENS` only. |
| Is the catalog declaration safe? | Yes — CELO entry is data; filtering is the consumer's job and is done correctly. |

No code patch warranted. The test added is strengthening, not a fix.

---

## 5. Audit trail for MiniPay submission

If a MiniPay reviewer asks "how do you ensure CELO is never offered as a payment option inside MiniPay?" the answer is:

> CELO is filtered at every payment-selection call site. The Hub Shop hook (`useShopSheetState`) gates the CELO sibling button on `!isMiniPay && celoSibling != null` and the invariant is tested both directions (`use-shop-sheet-state.test.tsx:500-528`). The PRO subscription hook (`useProSheetState`) is stricter still: it always passes `ACCEPTED_TOKENS` (which excludes CELO) to `selectMaxBalanceToken`, and the balances array is sliced to drop the CELO tail before the selection helper sees it; this invariant is asserted by `use-pro-sheet-state.test.tsx`'s P1-6 case added in this commit. The Coach credits hook and the Victory mint hook only iterate over `ACCEPTED_TOKENS` and never touch CELO at all.

Audit reference: `docs/reviews/2026-06-03-celo-minipay-runtime-audit.md`.

---

## 6. Closure

| Item | Status |
|---|---|
| P1-6 (CELO oculto en runtime MiniPay) | **CLOSED** |
| Optional follow-up: consolidate `exercises-screen.tsx` legacy mirror onto `useShopSheetState` (DRY) | Open, separate refactor |
| Optional follow-up: identical PRO test wrapped as cross-cutting invariant suite | Skipped — single per-hook test is sufficient |

---

## Appendix — Search commands

```bash
# Consumers
grep -rn -E "(CELO_TOKEN|CELO_ADDRESS_LOWER|FOUNDER_BADGE_CELO_ITEM_ID)" \
  apps/web/src --include="*.ts" --include="*.tsx"

# Guard pattern
grep -rn -E "(showCeloOnFounder|!isMiniPay.*celo|celo.*!isMiniPay)" \
  apps/web/src --include="*.ts" --include="*.tsx"

# Catalog consumers
grep -rn -E "(SHOP_ITEMS|shopCatalog)" \
  apps/web/src --include="*.ts" --include="*.tsx"

# Tests around CELO + isMiniPay
grep -rn "showCeloOnFounder\|FOUNDER_BADGE_CELO_ITEM_ID" \
  apps/web/src --include="*.test.ts" --include="*.test.tsx"
```

All commands re-runnable from repo root.
