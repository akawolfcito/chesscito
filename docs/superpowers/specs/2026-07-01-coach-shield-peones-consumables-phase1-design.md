# Coach + Shield Peones consolidation — Phase 1 close (2026-07-01)

Status: **approved, ready for implementation plan**.

## Context

This closes the remaining scope of Phase 1 from
`docs/product/chesscito-monetization-consolidation-audit-2026-07-01.md`.
PRO was already migrated to the no-approve rail (PR #160, #161, both merged
2026-07-01 — see `docs/handoffs/2026-07-01-treasury-canary-and-pro-rail-handoff.md`).
Remaining: Coach packs (itemId 3/4) and Retry Shield (itemId 2), both
identified by the audit as **retirements**, not migrations — the
Peones-spend alternative already exists for Coach (Sprint 4) and gets built
here for Shield.

Operator resumed this work with "continuemos" per
`project_monetization_consolidation` memory. This session's brainstorm
surfaced two things not in the original audit:

1. Shield protects the **`/exercises` combo/streak counter**
   (`lib/exercises/use-streak.ts`, `chesscito:streak` in localStorage,
   UI-labeled "COMBO" since commit `40b84411`), not any daily-ritual/habit
   streak. Confirmed by code trace: `use-fail-rescue.ts` never imports
   `lib/daily/progress.ts` or `lib/daily/passport.ts`.
2. A second, legacy shield-consumption path exists in
   `exercises-screen.tsx` (`consumeOneShield()`/`handleUseShield()`) that
   decrements localStorage only and never calls `/api/shields/spend` — it
   silently bypasses the server-authoritative spend endpoint that
   `use-fail-rescue.ts` correctly uses. This must be fixed in this same
   cluster or the new Peones fallback would only work in one of two UI
   surfaces that consume shields.

## Explicitly out of scope (parked, not decided against — just not now)

Surfaced during brainstorming, each is its own future initiative:

- **Ritual/daily-challenge shield as a separate pool.** Product intent is
  that Season-Pass-granted shields were meant to protect a daily-challenge
  streak, distinct from the `/exercises` combo. Today there is **no
  rescue/spend mechanic wired to the daily ritual streak at all** — nothing
  consumes a shield there yet. Splitting the single Redis counter
  (`coach:shields:credited:<wallet>`) into two pools is a real feature build
  (a rescue UI on `/challenge/daily` doesn't exist), not a retirement or a
  small addition — needs its own brainstorm once that surface exists.
- **Tiered consumable-currency system.** Long-term vision: Peones as base
  currency, spent to acquire named "premium" currencies (alfil/torre/dama/
  caballo/rey), which in turn buy Shop items/skins directly — same shape as
  social-app gifting economies (recharge → currency → item). This is a full
  new product surface (new catalog, new currencies, new balance model), not
  something to fold into this cluster.
- **Season Pass repricing** ($1.99 → $0.99) and **PRO-includes-Season-Pass
  bundling** (PRO subscribers get the 21-day challenge at $0 because PRO
  already implies Season Pass). Pricing/business-model change, unrelated to
  the payment-rail plumbing in this cluster.
- **Pricing coherence pass.** The 2 Peones cost for Shield below is
  **provisional** — carried over from the 2026-06-05 Sprint 4 decision
  purely to unblock this cluster. Operator has flagged Coach's 1
  Peón/analysis is already suspect (an LLM analysis costs more to produce
  than a Shield use, yet is priced lower) and wants a real economic model
  pass across all consumables before trusting any of these numbers long
  term. Operator has not built a game economy before and wants guidance —
  may bring in BMAD's Sally (UX) or another BMAD agent if a solid pricing
  table can't be proposed directly. Do not treat 2 Peones as final in any
  future work that touches this.

**Confirmed future sequencing** (operator, 2026-07-01): this cluster
(Coach + Shield) → Shop consolidation → remaining contract surfaces (save
score, mint, claim) → revisit the parked items above at a calmer pace.

## Scope 1 — Coach packs (itemId 3/4): retire the purchase path only

Retire the Shop-approve-TX purchase path. Leave the free onboarding-credit
system (3 free lifetime credits) completely untouched — it's a freebie
grant, not a "way to pay," so it isn't part of the "3 ways to pay for one
thing" problem the audit identified.

**Delete:**
- `apps/web/src/app/api/coach/verify-purchase/route.ts` + its test.
- `COACH_PACK_ITEMS` and the itemId 3/4 catalog entries in
  `apps/web/src/lib/contracts/shop-catalog.ts` (+ test updates).
- Coach-pack purchase wiring in
  `apps/web/src/lib/shop/use-shop-sheet-state.ts` (the branch that awaits a
  receipt for itemId 3/4 then POSTs `verify-purchase`) (+ test updates).
- Coach tiles in `apps/web/src/components/exercises/shop-sheet.tsx`
  (hero-lane hardcoded `itemId 4`, mini-lane `itemId 3`) (+ test updates).
- `coachPack`/`coachPack5`/`coachPack20` copy in
  `apps/web/src/lib/content/editorial.ts` and the mirrored entries in
  `apps/web/src/lib/content/messages/es.ts`.
- The dev fixture reference in `apps/web/src/app/dev/exercises-popups/fixture.tsx`.

**Leave untouched:**
- `apps/web/src/app/api/coach/credits/route.ts` (free-seed + balance read).
- Credit-check/decrement logic inside
  `apps/web/src/app/api/coach/analyze/route.ts` (lines ~222-247, ~358).
- `apps/web/src/lib/coach/use-coach-credits.ts`,
  `apps/web/src/lib/coach/paywall-gate.ts`.
- The existing Peones-spend path for Coach (`verifyPeonesCoachPayment` in
  `analyze/route.ts`, `lib/peones/coach-spend-fallback.ts`) — this is the
  reference pattern Shield's new fallback mirrors below.

**Result:** Coach analysis has exactly 2 payment paths — PRO (bypass) or 1
Peón/use — plus the untouched free-credit onboarding grant.

## Scope 2 — Shield: bug fix + Peones fallback + retire purchase path

### 2a. Fix the legacy local-only consume path

`apps/web/src/components/exercises/exercises-screen.tsx`'s
`consumeOneShield()` / `handleUseShield()` (around line 1721, gated on
legacy `shieldCount` state) currently decrements only
`apps/web/src/lib/shop/shield-storage.ts`'s local cache and never calls the
server. Reroute it to call `POST /api/shields/spend` the same way
`apps/web/src/lib/exercises/use-fail-rescue.ts`'s `onUseShield` already
does, so there is exactly one real spend path regardless of which UI
surface triggers it. This must land before/with the Peones fallback below,
otherwise the fallback only works in the rescue-modal surface and silently
does nothing in the other.

### 2b. Peones-spend fallback for Shield

Mirrors the existing Coach pattern (`lib/peones/coach-spend-fallback.ts` +
`verifyPeonesCoachPayment` in `analyze/route.ts`) as closely as possible —
no new abstraction invented, since `lib/peones/spend-service.ts` is already
the shared generalization point (`PEONES_SPEND_TARGETS`,
`SPEND_COST_BY_TARGET`, `SPEND_IDEMPOTENCY_PREFIX_BY_TARGET`).

- Add `"shield"` to `PEONES_SPEND_TARGETS` in
  `apps/web/src/lib/peones/spend-service.ts`, cost **2 Peones**
  (provisional — see "explicitly out of scope" above), idempotency prefix
  `spend:shield:` (key shape `spend:shield:{wallet}:{sourceId}`, matching
  Coach's `spend:coach:{wallet}:{gameId}`). Coach's `gameId` is a real
  per-analysis identifier; Shield has no equivalent today (a rescue can
  happen on any exercise/puzzle attempt). The implementation plan must pick
  a concrete `sourceId` — e.g. the active exercise/puzzle id plus a
  timestamp or attempt counter — that is unique enough per rescue to keep
  the idempotency guarantee meaningful without being so unique that a
  genuine retry (network blip, double-tap) double-charges.
- New `apps/web/src/lib/peones/shield-spend-fallback.ts` — client
  orchestrator `attemptShieldSpendWithPeones()`, same shape as
  `attemptCoachSpendWithPeones()`.
- New `peonesIdempotencyKey` verification branch in
  `apps/web/src/app/api/shields/spend/route.ts`, mirroring
  `verifyPeonesCoachPayment()` — fail-closed, verifies against
  `peones_ledger` (wallet/event_type=spend/source=shield/source_id=gameId)
  before allowing the rescue when the server-side shield counter is 0.
- Wire into `use-fail-rescue.ts`: when `shieldsCount === 0`, offer "pay 2
  Peones to save your combo" instead of only "retry and lose it."

### 2c. Retire the Shop-approve-TX purchase path (itemId 2)

Same treatment as Coach — delete the purchase mechanism, not port it.

**Delete:**
- `apps/web/src/app/api/credit-shield/route.ts` + its test.
- The itemId 2 tile in `apps/web/src/components/exercises/shop-sheet.tsx`
  (mini-lane entry) (+ test updates).
- Shield purchase wiring in `use-shop-sheet-state.ts`
  (`creditShieldServerSide`, the pending-tx-queue enqueue on itemId 2
  purchase) (+ test updates).
- Pending-tx queue mechanics in `apps/web/src/lib/shop/shield-storage.ts`
  (`SHIELDS_PENDING_TX_KEY` and its drain logic in
  `apps/web/src/lib/shop/use-shield-sync.ts`) — **only** the
  purchase-queue-draining half; the display-cache half
  (`SHIELDS_CREDITED_CACHE_KEY`/`SHIELDS_CONSUMED_KEY`, `GET
  /api/shields/me` hydration) stays, since Season Pass and the free
  welcome-pack grant still need it.
- `retryShield` copy in `editorial.ts` (Shop-purchase-specific string only;
  fail-rescue modal copy and welcome-pack "3 free Shields" copy stay).

**Leave untouched:**
- Season Pass shield grant in `apps/web/src/app/api/verify-payment/route.ts`
  (lines ~254-283) — writes to the same `shieldsCredited` Redis counter,
  unaffected by retiring the standalone Shop purchase.
- The free welcome-pack shield grant.
- `apps/web/src/app/api/shields/me/route.ts` (balance read).

**Result:** Shields can no longer be bought standalone with crypto. They
come from Season Pass, the welcome-pack freebie, or — once out — 2 Peones
per rescue.

## Testing (TDD)

- Delete: `verify-purchase/__tests__/route.test.ts`,
  `credit-shield/__tests__/route.test.ts`.
- Update: `shop-catalog.test.ts`, `use-shop-sheet-state.test.tsx`,
  `shop-sheet.test.tsx`, `account-coach-row.test.tsx` (remove
  retired-path assertions).
- New, written first (red → green):
  - `spend-service.test.ts` — "shield" target cost/idempotency-prefix.
  - `shield-spend-fallback.test.ts` — mirrors
    `coach-spend-fallback` test shape.
  - `shields/spend/route.test.ts` — new `peonesIdempotencyKey` branch
    (valid ledger match allows spend at 0 balance; mismatched/missing
    key fails closed).
  - `exercises-screen.test.tsx` (or wherever `handleUseShield` is
    covered) — asserts it now calls `/api/shields/spend`, not a local-only
    decrement.

## Sequencing

Two separate PRs, atomic commits within each, per project convention:

- **PR-A — Coach pack retirement.** Smaller, no new feature, pure deletion
  + test updates.
- **PR-B — Shield.** Bug fix (2a) lands first as its own commit, then the
  Peones fallback (2b), then the retirement (2c) — in that order, since
  each depends on the previous being correct (retiring the purchase path
  before the fallback exists would leave Shield unpurchaseable and
  unspendable-via-Peones for however long the PR takes).

## What "done" looks like

- Coach: 2 payment paths (PRO, Peones), free-credit onboarding untouched,
  zero remaining references to the itemId 3/4 Shop-TX path.
- Shield: 1 real spend path (`/api/shields/spend`) from both UI surfaces,
  2 Peones fallback works when balance is 0, Season Pass + welcome-pack
  grants unaffected, zero remaining references to the itemId 2 Shop-TX
  purchase path.
- Full test suite green, `tsc --noEmit` clean.
- Not verified on real chain in this cluster (same constraint as the PRO
  work — no funded wallet in the coding sandbox); needs a real MiniPay pass
  before trusting in Prod, same as flagged for PRO.
