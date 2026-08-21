# Peones Flexible Top-up — Treasury Canary Constraint Proof

**Date**: 2026-08-20
**Method**: READ-ONLY against **live production**, via
`scripts/ops/read-only-query.ts` — the session runs under
`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` (the *server* refuses a
write, not our intentions), each statement passes `assertReadOnlySql`, and the
`postgres:16-alpine` client runs `--rm` so no container and no anonymous volume
survives. Output is redacted by default; nothing below carries a wallet, a hash,
an address or a credential.

**Nothing was mutated. No migration. No code change. No payment. No transaction.**

Unblocks: `docs/specs/2026-08-20-minigames-content-pool-and-flexible-topup.md`,
which could not establish this from the working tree —
`private/backups/` is off-limits by policy and there is no migrations ledger.

---

## 1 · Does `public.treasury_payment_intents` exist?

**YES**, and it is a real table (`relkind = 'r'`). The canary family:

| relation | kind |
|---|---|
| `treasury_payment_intents` | table |
| `treasury_payment_consumptions` | table |
| `treasury_payment_intent_resolutions` | table |
| `peones_ledger` | table |
| `peones_balances` | view |

---

## 2 · CHECK constraints — the SKU one, verbatim

`treasury_payment_intents` carries **13** CHECK constraints. The decisive one:

```sql
treasury_payment_intents_sku_check
CHECK ((sku = 'peones_pack_50'::text))
```

Scanning **every** CHECK in `public` whose text mentions `peones_pack` returns
**exactly one row** — the constraint above. There is no second copy elsewhere.

⚠️ **`treasury_payment_consumptions` has NO sku CHECK.** Its only CHECKs are
`amount_paid > 0`, `log_index >= 0`, and regex guards on `tx_hash` / `wallet`.
Both `sku` and `product` are free `text NOT NULL`. **The restriction lives on the
INTENT, not on the consumption.**

Other `sku`-bearing tables (`lite_season_passes`, `pro_subscriptions`) carry no
peones-pack constraint and are out of scope.

---

## 3 · Is there a constraint equivalent to `sku = 'peones_pack_50'`?

**PROVEN YES** — it is not "equivalent to", it is *literally* that predicate, on
`public.treasury_payment_intents`.

---

## 4 · The canary consumption function

```
consume_get_peones_treasury_payment(
  p_intent_id uuid, p_chain_id bigint, p_tx_hash text, p_log_index integer,
  p_wallet text, p_token_address text, p_treasury_address text,
  p_amount_paid numeric, p_tx_mined_at timestamptz,
  p_attestation_hash text, p_day_utc date, p_metadata jsonb)
```

⛔ **It takes NO `p_sku` and NO `p_peones`.** It is driven entirely by the
intent row it loads by id — which is exactly why the CHECK on that table is the
binding constraint.

---

## 5 · Explicit SKU guard inside the function body?

**YES — three layers, not one.** Matching lines only:

```
14 | if not found then raise exception 'intent_not_found'; end if;
15 | if v_intent.sku <> 'peones_pack_50' then raise exception 'wrong_sku'; end if;
…
57 | lower(p_wallet), 'earn', 50, 'pack_purchase', 'peones_pack_50',
```

Line 15 is the guard the brief asked about, verbatim.

⛔ **Line 57 is the finding that matters most, and it was not on the list.**
The reward is **hardcoded `50`** and the ledger source id is **hardcoded
`'peones_pack_50'`** — neither is read from the intent. So widening the CHECK and
the guard would still leave a canary that credits exactly 50 Peones for any SKU.
**Any canary widening is a function-body change, not just a constraint change.**

---

## 6 · The legacy consumption function

```
consume_legacy_get_peones_payment(
  p_chain_id bigint, p_tx_hash text, p_log_index integer, p_wallet text,
  p_sku text, p_token_address text, p_treasury_address text,
  p_amount_paid numeric, p_peones integer, p_idempotency_key text,
  p_attestation_hash text, p_day_utc date, p_metadata jsonb)
```

**It accepts `p_sku text` and `p_peones integer`, with NO fixed-SKU constraint.**
Proven two ways:

1. the `peones_pack` body scan returns **only** the canary function — the legacy
   function does not contain the literal at all;
2. its body parameterises both:

```
41 | lower(p_wallet), 'earn', p_peones, 'pack_purchase', p_sku,
```

It credits the **passed** amount under the **passed** SKU. Its only `raise`s are
replay/idempotency guards (`payment_replay`, `entitlement_incomplete`) plus a
mismatch check `v_consumption.sku <> p_sku`, which *strengthens* idempotency
rather than restricting which SKU may be used.

**Intent creation** (`create_get_peones_intent`, `guard_get_peones_intent_insert`)
treats sku only as a lock/uniqueness key (`and sku = p_sku`,
`existing.sku = new.sku`) and raises only `active_get_peones_intent_exists`. It
adds no SKU whitelist of its own — the table CHECK is the whitelist.

---

## 7 · Observed volume — aggregated counts only

| source | group | n |
|---|---|---|
| `treasury_payment_intents` | `peones_pack_50` | **24** |
| `treasury_payment_consumptions` | `get_peones` / `peones_pack_50` | **20** |
| `treasury_payment_consumptions` | `lite_season_pass` / `lite_season_pass_21` | 15 |
| `treasury_payment_consumptions` | `chesscito_pro` / `chesscito_pro_30` | 8 |
| `peones_ledger` | `source = 'pack_purchase'` | **22 events · 1 100 Peones** |

**Exactly one SKU has ever existed on the canary.** 24 intents, 20 consumed — the
4-row gap is consistent with cancelled/expired/failed intents, which the
lifecycle statuses provide for.

⚠️ **22 ledger `pack_purchase` events vs 20 canary consumptions.** 1 100 = 22 × 50,
so both extra credits are also 50-Peones packs. The likeliest reading is that
they came through the legacy rail (which writes the same ledger source), but
**this audit did not join the two tables to prove it** and does not claim it.
Flagged, not concluded.

⛔ **The canary is alive.** 20 real consumptions is not a dormant path.

---

## 8 · Can a flexible SKU reach the canary?

**NO — and it fails CLOSED, before money moves.**

The rail is chosen client-side by the presence of an intent id
(`lib/payments/use-payment-rail.ts:158-161`):

```ts
intentId ? "/api/verify-payment/get-peones-canary"   // canary
         : "/api/verify-payment"                      // legacy
```

An intent id exists only if `/api/payment-intents/get-peones` created one, and
the only SKU the client ever sends is the hardcoded
`GET_PEONES_CANARY_SKU = "peones_pack_50"`
(`lib/payments/get-peones-canary.ts:5`).

And if code ever drifted, the database refuses first: a flexible SKU would be
rejected by `treasury_payment_intents_sku_check` **at intent creation** — a
check violation *before* any transfer is requested. The failure mode is "no
intent", never "payment taken, credit refused".

---

## DELIVERABLE

**LIVE TABLE:**
`public.treasury_payment_intents` exists (table), with `treasury_payment_consumptions`, `treasury_payment_intent_resolutions`, `peones_ledger`, `peones_balances`.

**LIVE SKU CONSTRAINT:**
`treasury_payment_intents_sku_check CHECK ((sku = 'peones_pack_50'::text))` — the only `peones_pack` CHECK in `public`. `treasury_payment_consumptions.sku` is unconstrained free text.

**LIVE CANARY FUNCTION:**
`consume_get_peones_treasury_payment(p_intent_id uuid, …)` — no `p_sku`, no `p_peones`; entirely intent-driven.

**FUNCTION SKU GUARD:**
YES — `if v_intent.sku <> 'peones_pack_50' then raise exception 'wrong_sku'; end if;` (line 15). **Plus a hardcoded `50` / `'peones_pack_50'` in the ledger insert (line 57), which the brief did not anticipate: the reward is not derived from the intent.**

**LEGACY FUNCTION:**
`consume_legacy_get_peones_payment(…, p_sku text, …, p_peones integer, …)` — fully parameterised, no fixed-SKU guard, credits `p_peones` under `p_sku`.

**CANARY OBSERVED SKUS:**
`peones_pack_50` only — 24 intents, 20 consumptions. No other SKU has ever appeared.

**FLEXIBLE SKUS CAN REACH CANARY:**
**NO** — client routes to the canary only with an intent id, the only SKU it ever sends is the hardcoded `peones_pack_50`, and the table CHECK rejects anything else at intent creation, before a transfer.

**DB MIGRATION REQUIRED:**
**NO** — for flexible top-up on the legacy rail.
(If the canary were ever widened, it would need a constraint change **and** a function-body change for the hardcoded 50. Out of scope.)

**SAFE IMPLEMENTATION PATH:**
**CASE B.** Flexible top-up ships on the **legacy rail only** (`/api/verify-payment` → `consume_legacy_get_peones_payment`), which already accepts an arbitrary SKU and an arbitrary positive Peones amount. The canary stays byte-identical on `peones_pack_50`.

Invariants to encode before implementing:
1. `PEONES_PACKS` remains the single authority; UI amount, price, SKU, request amount and credited Peones all derive from it — the client may not carry a reward independent of the SKU.
2. **A flexible SKU must never be handed to intent creation.** Assert it: `GET_PEONES_CANARY_SKU` stays `peones_pack_50`, and a test must fail if the canary rail is invoked with any other SKU.
3. `peones_pack_50` keeps its exact current shape (500 000 USD6 / 50 Peones) so the live canary is untouched — the generated 5…100 table must reproduce, not replace, that row.
4. Idempotency is unchanged: the legacy replay guard keys on `(chain_id, tx_hash, log_index)` and additionally refuses a SKU mismatch on replay.

---

## VERDICT

**READY TO IMPLEMENT FLEXIBLE TOP-UP** — on the legacy rail only, under CASE B,
with the four invariants above encoded as tests. No DB migration. The treasury
canary is provably unreachable by a flexible SKU and stays untouched.

⚠️ Two things the next implementer must not lose:
- the canary's reward is **hardcoded in the DB function**, so "just widen the
  CHECK" would silently credit 50 for every amount;
- the canary is **live** (20 real consumptions), so it is not a path anyone may
  treat as dead.
