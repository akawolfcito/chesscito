# Flexible Peones Top-up — Implementation Report

**Date**: 2026-08-21 (deliverable named for the brief, 2026-08-20)
**Scope**: Flexible top-up ONLY. No Mini-game paywall, no Mini-game content, no
PRO change, no P2P, no push, no deploy.
**Rails**: legacy only. **The treasury canary was not touched.**
**Database**: unchanged — no migration, no production write, no payment, no
on-chain transaction.

Built on the read-only production proof in
`docs/audits/2026-08-20-peones-flexible-topup-canary-proof.md` (CASE B).

---

## 1 · The constraint that shaped the design

Production pins the canary **three times**, and the third one is the one that
decides the architecture:

```sql
treasury_payment_intents_sku_check   CHECK ((sku = 'peones_pack_50'::text))
consume_get_peones_treasury_payment  →  if v_intent.sku <> 'peones_pack_50'
                                           then raise exception 'wrong_sku'
-- and, in the same function's ledger insert:
lower(p_wallet), 'earn', 50, 'pack_purchase', 'peones_pack_50',
```

That last line **hardcodes the reward**. A canary widened by constraint alone
would take $1.00 and credit 50 Peones. So flexible top-up ships on the **legacy
rail**, whose consume function is fully parameterised
(`p_sku text`, `p_peones integer`) and needs nothing new.

---

## 2 · What changed

### One authority for what is buyable — `lib/payments/rail-config.ts`

```ts
export const PEONES_UNIT_PRICE_USD6 = 10_000n;  // $0.01 per Peon
export const PEONES_MIN_AMOUNT = 5;
export const PEONES_MAX_AMOUNT = 100;
export const PEONES_AMOUNT_STEP = 5;
export const PEONES_DEFAULT_AMOUNT = 25;

export const SUPPORTED_PEONES_AMOUNTS = [5, 10, …, 100] as const;
export type PeonesAmount = (typeof SUPPORTED_PEONES_AMOUNTS)[number];
export type PeonesPackSku = `peones_pack_${PeonesAmount}`;

export const PEONES_PACKS = Object.fromEntries(
  SUPPORTED_PEONES_AMOUNTS.map((amount) => [ getPeonesPackSku(amount), {
    sku: getPeonesPackSku(amount),
    priceUsd6: BigInt(amount) * PEONES_UNIT_PRICE_USD6,
    peonesReward: amount,
    source: PACK_PURCHASE_SOURCE,
  }]),
) as Record<PeonesPackSku, PeonesPack>;
```

The amount tuple is written out as a literal because `as const` is what produces
the per-amount SKU union — a computed range would collapse to `number` and take
the type safety with it. **PAY-3 asserts the tuple against the range the four
constants describe**, so the literal and the constants cannot drift apart
silently.

`peones_pack_50` is **reproduced, not replaced**: `50n × 10_000n = 500_000n`.
PAY-2 asserts the whole object deep-equals its previous shape.

New helpers: `getPeonesPackSku(amount)`, `isSupportedPeonesAmount(n)` (a type
guard — rejects off-step values like 37, not just out-of-range ones), and
`clampPeonesAmount(n)` (snaps arbitrary input onto the ladder; NaN/±Infinity
fall back to the default).

### One fence onto the canary — `lib/payments/get-peones-canary.ts`

```ts
export function isCanaryEligibleSku(sku: unknown): sku is typeof GET_PEONES_CANARY_SKU
```

Takes `unknown`, because both call sites guard untrusted input. Now used by:

- `app/api/payment-intents/get-peones/route.ts:122` — replaces an inline
  `sku !== GET_PEONES_CANARY_SKU`. A flexible SKU is rejected **at intent
  creation**, so the failure mode is "no intent", never "paid, not credited".
- `lib/payments/use-payment-rail.ts:129` — `canaryRequested` now reads
  `isGetPeonesCanaryClientRequested() && isCanaryEligibleSku(sku)`, so a flexible
  SKU never even asks for an intent and falls through to `/api/verify-payment`.

**Guarding the grantor, not the callers**: one predicate, two call sites, and a
test that fails if the route stops calling it.

### The sheet — `components/payments/get-peones-sheet.tsx`

The hardcoded `const SKU = "peones_pack_50"` is gone. The sheet now holds an
amount and derives everything from it:

```
[ − ]   $0.25   [ + ]        ← price pill sits BETWEEN the controls
```

- default 25, min 5, max 100, step 5
- new optional prop `initialAmount`, run through `clampPeonesAmount`
- controls labelled `Decrease Peones` / `Increase Peones` (ES: `Menos Peones` /
  `Más Peones`) — named for what they change, not for the glyph
- **locked while a transfer is in flight** (`preparing`, `awaiting_signature`,
  `pending_tx`, `verifying`). The signed transfer commits to a SKU; letting the
  amount move after the wallet prompt would desync display from money.

### Server: nothing needed

`/api/verify-payment` already derived economics from the SKU
(`const peonesCredited = pack.peonesReward` → `p_peones`). The only change is
its stale header comment, which claimed the rail served `peones_pack_50`.

---

## 3 · Tests

**Written before the implementation and proved RED first**: the CANARY file
failed 4 / passed 5 against the pre-change tree (the predicate did not exist and
there were no flexible SKUs to guard).

| file | cases | covers |
|---|---|---|
| `lib/payments/__tests__/canary-sku-invariants.test.ts` | 28 | CANARY-1…4 |
| `lib/payments/__tests__/flexible-topup-safety.test.ts` | 98 | PAY-1…10 |
| `components/payments/__tests__/get-peones-sheet.test.tsx` | 23 (8 new) | stepper UI |

**CANARY-1/2** — the SKU and its pack are frozen at `peones_pack_50` /
`500_000n` / `50`, matching what production hardcodes.
**CANARY-3** — every flexible SKU is refused by `isCanaryEligibleSku`; arbitrary
strings too; the intent route must call the predicate and must never persist
`body.sku`; the canary verifier must not import the flexible helpers.
**CANARY-4** — exactly one SKU out of the whole catalogue is canary-eligible.

**PAY-1** price ≡ reward × $0.01, no free or zero-price pack · **PAY-2** the
50-pack deep-equals its old shape · **PAY-3** the ladder equals min…max by step
· **PAY-4** the default and both bounds are buyable · **PAY-5** SKU and reward
cannot disagree · **PAY-6** every pack credits through `pack_purchase` ·
**PAY-7** clamping never yields an unbuyable amount (fuzzed, incl. NaN/±Inf/
fractions) · **PAY-8** off-step and out-of-range amounts are refused ·
**PAY-9** the credit is server-decided from the SKU, never read off the body ·
**PAY-10** the transfer moves exactly the pack price, and price is strictly
monotonic in reward.

### Three existing assertions were updated, deliberately

`get-peones-sheet.test.tsx` pinned the old fixed pack: `"50 Peones"`,
`"Pay $0.50"`, and `sku: "peones_pack_50"` passed to `usePaymentRail`. They now
assert the default amount (25 / $0.25 / `peones_pack_25`). **These were not
failing tests worked around — they encoded the behaviour the brief replaced.**

---

## 4 · Telemetry — nothing new was added

There is no client-side purchase telemetry today (`lib/peones/telemetry.ts`
covers earned / spent / cap / balance-viewed, not purchases), and the brief said
reuse what exists. **Flexible top-up needs no new event, because the SKU carries
the amount**:

- `peones_ledger` stores `source = 'pack_purchase'` and `reference = p_sku`, so
  amount distribution is `select reference, count(*), sum(amount) … group by
  reference` — zero instrumentation;
- `/api/verify-payment` already logs `sku` on every branch.

PAY-9 asserts `p_sku: sku` at the call site so that queryability cannot be
silently removed.

---

## 5 · Verification

| check | result |
|---|---|
| `pnpm exec tsc --noEmit` | **clean** |
| full Vitest suite | **707 files · 8884 passed · 1 todo · exit 0** (154 s) |
| targeted: canary + safety + sheet | 28 + 98 + 23 = **149 passed** |
| DB / migrations / `*.sql` diff | **empty** (`git status --porcelain` over those paths returned nothing) |
| VR (`--project=minipay --update-snapshots=none`) | ⚠️ **NOT RUN — blocked, see below** |

The file count moved **705 → 707**, exactly the two files added, which is the
signal that no worker silently dropped out.

### ⚠️ VR could not be run — disk floor, not a regression

`scripts/preflight-disk.ts` refuses to start Playwright below **10 GB free**.
The machine had **8.5 GB**; dropping `apps/web/.next` (1.6 GB, regenerable)
brought it to exactly **10.00 GB**, which still rounds under the floor.

The space is not the repo's: **`~/Library/Caches/Google` is 15 GB** and
`~/Library/Application Support/Google/Chrome` is 17 GB — the same Chrome disk
pressure recorded before. The preflight's own message lists that cache as safe
to clear, but it is the founder's browser and clearing it was not done
unprompted.

**This is a known-low-risk gap, not an unknown one**: the Get Peones sheet is
**not photographed by any VR case** — `visual-regression.spec.ts` has no
`get-peones` fixture, and grep for `peones` there returns only the score-saved
pill (vr13) and the hub chips (vr17/vr18), none of which this change touches.
No baseline was updated, and none should need to be.

---

## VERDICT

**FLEXIBLE TOP-UP IMPLEMENTED — LEGACY RAIL ONLY, CANARY UNTOUCHED, NO DB
CHANGE.** Type-checked, 8884 tests green, canary invariants encoded and proved
red-first. **One item outstanding: the VR run, blocked by a machine disk floor
rather than by this change, on a surface the VR suite does not photograph.**
