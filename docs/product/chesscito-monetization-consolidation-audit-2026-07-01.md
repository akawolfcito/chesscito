# Chesscito monetization consolidation — audit + proposal (2026-07-01)

Status: **proposal, not started**. Triggered by operator flagging that Shop's
pricing was set ad hoc ("yo creo que vale", not derived from any coherent
model) and that the payment surface overall feels tangled — different
products use TX-approve, Peones spend, PRO subscription, and Season Pass
with no unifying logic. This doc is the requested audit first, proposal
second.

## The plan already exists — Training Economy Alpha, 2026-06-05

Found `docs/product/chesscito-training-economy-alpha-decisions-2026-06-05.md`.
It already states the exact principle the operator is now re-deriving from
scratch:

> **"TX visible solo cuando hay persistencia pública on-chain. Todo lo
> consumible se paga con Peones off-chain."**

Sprint 4 ("Compendio TX") specifically decided: Coach analysis 1 Peón/use,
labyrinth hint 1 Peón, retry-without-losing-streak 2 Peones, save 1 Peón —
all with a PRO bypass (always free for PRO). Badge claim and VictoryNFT
explicitly **stay** as visible on-chain TX — not everything moves to Peones,
only things with no on-chain persistence requirement. Founder Badge
reactivation was explicitly **out of scope** for this alpha (deferred to
"Milestone B, sprint 6"), with a decided price of **$9.99 USD lifetime** —
not the $0.10 (stablecoin) / ~$1.00 (CELO) actually live on `ShopUpgradeable`
today, which was apparently set separately and never reconciled with this
decision.

**Execution status, checked in code just now:** Sprint 4 was only *partially*
shipped. Coach analysis (`/api/coach/analyze/route.ts`) does have the Peones
path (`peonesIdempotencyKey`, "Sprint 4 commit F"), verified against the real
`peones_ledger` — but the **old Shop-TX credit-pack path (itemId 3/4,
`REDIS_KEYS.credits`) was never retired**. Today a Coach analysis can be paid
three different ways at once: PRO (bypass), 1 Peón (Sprint 4), or a
previously-purchased Shop credit pack (legacy). This is precisely the
"enredado" the operator flagged — not a new problem, a half-finished
migration.

No evidence found (grep of hint/retry/save routes) that the rest of Sprint
4 (hint, retry, save) shipped at all — Coach is the only piece that got the
Peones-spend treatment. Not independently re-verified route-by-route beyond
Coach; flagging as unconfirmed rather than asserting it's fully absent.

## Full current catalog (as it actually exists today, not as previously assumed)

| Item | itemId | Price | Mechanism | Grant path |
| --- | --- | --- | --- | --- |
| Chesscito PRO (30-day) | 6 | $1.99 | Shop approve+buyItem | `verify-pro`: decodes `ItemPurchased`, Redis extend-or-set |
| Founder Badge (stablecoin) | 1 | $0.10 | Shop approve+buyItem | `founder-status`: **on-chain log scan only, no off-chain record** |
| Founder Badge (CELO) | 5 | $1.00 nominal (~1 CELO after normalization) | Shop approve+buyItem, native CELO | same as itemId 1 |
| Retry Shield (3 uses) | 2 | $0.025 | Shop approve+buyItem | `credit-shield`: decodes `ItemPurchased`, credits localStorage |
| Coach Pack (5 credits) | 3 | $0.05 | Shop approve+buyItem | `/api/coach/verify-purchase`: decodes `ItemPurchased`, Redis credit |
| Coach Pack (20 credits) | 4 | $0.10 | Shop approve+buyItem | same mechanism as itemId 3 |
| Get Peones pack | n/a (rail) | $0.50 → 50 Peones | Single-tx transfer (no approve) | `verify-payment` → Supabase RPC, ledger credit |
| Lite Season Pass (21-day) | n/a (rail) | $1.99 → 21-day pass + 3 Shields | Single-tx transfer (no approve) | `verify-payment` → Supabase RPC |

**Correction to something said earlier this session:** Coach analysis is
*not* purely PRO-gated. There are also pay-per-use Coach credit packs
(itemIds 3/4) sold through Shop — PRO (unlimited) and packs (metered) are
two different ways to pay for the same feature. Missed this the first time;
worth having right before any consolidation decision.

**Pricing coherence problem, as flagged by the operator:** there is no
visible USD-per-value logic tying these together — Shield ($0.025/3 uses ≈
$0.0083/use) and Coach packs ($0.01–0.05/credit) sit at different implied
unit economics with no stated reasoning, Founder ($0.10 stablecoin vs. ~$1
nominal in CELO) has an internal inconsistency of its own, and PRO/Season
Pass (~$2/month-ish) aren't obviously calibrated against the smaller items.
None of this is wrong, exactly — it's just never been derived from a single
model, which is the operator's core complaint.

## Grant-mechanism risk map (for any consolidation decision)

Ranked by how tightly welded each item is to the `ItemPurchased` event
specifically (not a generic Transfer), i.e. how much new plumbing a
no-approve migration needs:

1. **Founder (itemId 1 + 5) — hardest, and lowest priority.** Zero off-chain
   record exists; status is derived live from on-chain log scans. Per
   operator 2026-07-01: this was "an accessory, an early idea to have *some*
   campaign before Season Pass existed" — no strong strategy behind it today.
   Matches the 2026-06-05 decision doc, which already put Founder reactivation
   out of scope for this whole alpha. **Recommendation: park in backlog, do
   not migrate.** The live $0.10/$1.00 on-chain pricing doesn't match the
   decided $9.99 lifetime price anyway — if it's ever revived, price it
   correctly then, not now.
2. **PRO (itemId 6) — moderate, and worth doing.** Grant logic is already
   off-chain (Redis `PRO_EXTEND_LUA`), nearly identical in shape to Season
   Pass's Redis-based entitlement. The only change needed is swapping "decode
   `ItemPurchased`" for "decode `Transfer` to `ChesscitoTreasury`" as the
   trigger — the actual crediting call can be reused close to as-is.
3. **Coach packs (itemId 3/4) — arguably not a migration at all, a retirement.**
   The Peones-per-analysis path already exists and works (Sprint 4). The
   real fix is deleting the redundant Shop-TX credit-pack path, not porting
   it to the no-approve rail — keeping it would preserve, not fix, the
   "3 ways to pay for one thing" problem.
4. **Shield (itemId 2) — same shape as Coach**, but the Peones-spend
   equivalent (Sprint 4's "retry sin perder racha: 2 Peones") does not appear
   to have shipped (not found in a grep of retry-related routes — unconfirmed,
   not exhaustively checked). Finishing that Sprint 4 item, then retiring the
   Shop-TX path the same way as Coach, is likely the real fix here too.

## Operator's consolidation direction (2026-07-01) — matches the existing plan

Explicit framing given: the "recharge a balance, then spend it on things"
model used by social apps (top up once, spend on flowers/gifts/etc.) is
closer to what Chesscito should converge on than the current mix of
approve-based Shop items, a single fixed-size Peones pack, and a separate
PRO subscription. **This is not a new direction — it is Sprint 4's
principle, unfinished.** Concretely raised:

- Fold **PRO subscription** into the same unified rail as Season Pass — same
  mechanism (single-tx transfer + server-verified entitlement), just a
  different SKU.
- **Get Peones packs should not be stuck at one size ($0.50 → 50).** Multiple
  denominations, same rail, same mechanism — this is *already* how the rail
  is built (`PEONES_PACKS: Record<PeonesPackSku, PeonesPack>`), it just only
  has one entry today. Adding more is additive, not architectural.
- **Founder**: deprioritize per above.
- Open question, not yet decided: whether Shield and Coach packs eventually
  become "spend accumulated Peones" instead of separate real-money purchases
  — i.e. Peones becomes the *only* in-game spend currency, and real money
  only ever buys Peones (of various sizes) + subscriptions (PRO, Season
  Pass). This would be the cleanest version of the "top up, then spend"
  model, but is a bigger product decision than this doc should make
  unilaterally — flagged for explicit operator decision below.

## Configurable pricing — feasibility (operator asked directly)

Today, every price is a hardcoded TypeScript constant (`priceUsd6` in
`rail-config.ts` / `shop-catalog.ts`) or an on-chain contract value
(`ShopUpgradeable.items[id].priceUsd6`, settable only via an owner
transaction). Changing a price today means either a code deploy (rail
prices) or a Safe transaction (Shop prices) — not something a non-engineer
could do, and not fast.

**This is directly solvable, and cheaply, by reusing infrastructure that
already exists and is already proven in production**: the `db-content`
system ([[db-content-resume-2026-06-17]], `lib/content/*`) already
implements exactly this shape — a code-level baseline merged with a
Supabase-editable overlay, live in production without a redeploy, currently
used for exercises/training-path/labyrinth content. Applying the same
pattern to pricing (`rail-config.ts`'s `PEONES_PACKS`/`SEASON_PASSES`, and
eventually a Shop-catalog equivalent) is architecturally a close cousin, not
a new invention:

- Baseline: today's hardcoded prices, unchanged, as the fallback/default.
- Overlay: a Supabase table (e.g. `payment_sku_overrides`) keyed by `sku`,
  holding `price_usd6`, `enabled`, maybe `label`/`reward` fields per SKU.
- Server-side price resolution reads baseline ⊕ overlay, same merge pattern
  already in `merged-catalog.ts`.
- **Risk to manage, unlike editorial content**: a price change here moves
  real money. Recommend the overlay table gets the same rigor as the
  canary's tables — RLS deny-all for `anon`/`authenticated`, writes only via
  `service_role` (i.e. an admin tool/script, not a public API), and every
  change logged (who, when, old value, new value) given it's financial
  config, not copy.
- Feasible without disturbing anything already shipped (Get Peones canary,
  Season Pass, the treasury unification work) — this is a read-path change
  (how a price is looked up), not a write-path change (how a payment is
  verified/credited). Can be done independently, in parallel, at low risk.

## What this doc is NOT deciding

- Whether Shield/Coach packs migrate to "spend Peones" vs. stay real-money
  Shop purchases — flagged above as an open product decision.
- Exact new Peones pack denominations/pricing — needs the "coherent list"
  the operator asked for, which requires their input on target price points,
  not something to reverse-engineer from the existing ad hoc numbers.
- Whether to actually build the configurable-pricing overlay now or later —
  feasibility confirmed above, sequencing is still an open decision.
