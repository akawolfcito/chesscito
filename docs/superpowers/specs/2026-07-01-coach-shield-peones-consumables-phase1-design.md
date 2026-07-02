# Coach + Shield Peones consolidation — Phase 1 close (2026-07-01)

Status: **approved, patched post-red-team, ready for implementation plan**.
Red-team review: `2026-07-01-coach-shield-peones-consumables-phase1-redteam.md`
(3 P0s found, all folded into Scope 2b below; verified against `main` @
`101988ee`).

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

**Must verify, not just leave alone:** `shop-catalog.ts` documents the
CoachPaywall's "out of credits" CTA as routing to the Shop's coach-pack
tiles. Confirm where that CTA points post-deletion and repoint it to
PRO/Peones if it currently dead-ends on the removed tiles.

**Result:** Coach analysis has exactly 2 payment paths — PRO (bypass) or 1
Peón/use — plus the untouched free-credit onboarding grant.

## Scope 2 — Shield: bug fix + Peones fallback + retire purchase path

### 2a. Fix the legacy local-only consume path

`apps/web/src/components/exercises/exercises-screen.tsx`'s
`consumeOneShield()` / `handleUseShield()` (around line 1721, gated on
legacy `shieldCount` state, currently synchronous and unguarded) currently
decrements only `apps/web/src/lib/shop/shield-storage.ts`'s local cache and
never calls the server. Reroute it to call `POST /api/shields/spend` the
same way `apps/web/src/lib/exercises/use-fail-rescue.ts`'s `onUseShield`
already does — but this is not a one-line call-target swap: `onUseShield`
is async, carries an `isSpending` re-entrancy guard, and splits into a
3-way outcome (`onRescued`/`onSkipped`/`onServerError`). The fix must carry
the same guard and outcome handling, or the surface regresses on
double-tap. `handleUseShield` also currently early-returns before any
network call when local `shieldCount <= 0` — that early return must instead
fall through to the Peones fallback path (2b) at 0 balance, the same way
the rescue modal does, or this surface never reaches the new fallback at
all. This must land before/with the Peones fallback below, otherwise the
fallback only works in the rescue-modal surface and silently does nothing
in the other. Once rerouted, `consumeOneShield()` likely has no remaining
caller — remove it or justify keeping it.

Also in scope here (not previously enumerated): `exercises-screen.tsx`
carries its own **second** Shop-purchase handler
(`handleConfirmPurchase`, `txSource "shop_retry_shield"`) that separately
enqueues a pending tx and POSTs `/api/credit-shield` — a duplicate of the
path in `use-shop-sheet-state.ts`. Scope 2c's retirement (and Scope 1's
Coach retirement) must delete both call sites, plus the hardcoded
`SHIELD_ITEM_ID`/coach-itemId entries in `shop-sheet.tsx`'s mini-lane
(`miniOrder`), or the deleted `/api/credit-shield` /
`/api/coach/verify-purchase` endpoints get hit post-deploy from this
second path and 404 into an un-drained queue entry.

### 2b. Peones-spend fallback for Shield

Mirrors the existing Coach pattern (`lib/peones/coach-spend-fallback.ts` +
`verifyPeonesCoachPayment` in `analyze/route.ts`) where it's safe to, but
**does not** mirror it blindly — red-team review found Coach's
verify-only-existence check relies on the analysis being a naturally
idempotent, cached artifact. A shield rescue is not: it's a fresh gameplay
grant every time, so "row exists in the ledger" alone is replayable (pay
once, capture the key, replay the request N times, get N free rescues).
Shield needs an explicit consumption guard Coach doesn't.

**Commit 0 of this scope (must land first, blocks everything else below):**
- Forward-only migration adding `"shield"` to
  `peones_ledger_source_check`, following the pattern in
  `20260611010000_peones_labyrinth_completion_source.sql`.
- Add `"shield"` to `PeonesLedgerSource` in
  `apps/web/src/lib/peones/types.ts`.
- Extend `apps/web/src/lib/peones/__tests__/schema-sync.test.ts`'s
  merged-migration list to match.
- Without this triplet the feature is DOA in prod (RPC insert throws
  `check_violation`) while every mocked unit test still passes — this is
  not optional cleanup, it's the thing that makes the feature exist at all.

**`sourceId` identity (pinned, not deferred):** use the existing
`attemptSeq` counter already threaded through
`apps/web/src/components/exercises/exercises-screen.tsx` (e.g. passed to
`PeonesHintButton`) for exactly this same-attempt-vs-fresh-attempt
distinction. Key shape: `spend:shield:{wallet}:{attemptSeq}`. A retried tap
within the same attempt reuses the same key (→ `duplicate=true`, no
double charge); a genuinely new rescue attempt advances `attemptSeq` (→
fresh key, real debit). Do not invent a timestamp- or exercise-id-based
scheme — both leak value in opposite directions (double-charge vs.
free-rescue), and `attemptSeq` already solves this exact shape elsewhere
in the same file.

- Add `"shield"` to `PEONES_SPEND_TARGETS` in
  `apps/web/src/lib/peones/spend-service.ts`, cost **2 Peones**
  (provisional — see "explicitly out of scope" above), idempotency prefix
  `spend:shield:` (key shape `spend:shield:{wallet}:{attemptSeq}` per above).
- New `apps/web/src/lib/peones/shield-spend-fallback.ts` — client
  orchestrator `attemptShieldSpendWithPeones()`, same shape as
  `attemptCoachSpendWithPeones()`.
- New `peonesIdempotencyKey` verification branch in
  `apps/web/src/app/api/shields/spend/route.ts`. Branch order: if
  `peonesIdempotencyKey` is present, take the verify-only path (do not
  attempt the Lua counter decrement first — at 0 balance it would 409
  before the key is ever checked); else, the existing counter path.
  Verification against `peones_ledger` (wallet/event_type=spend/
  source=shield/source_id=attemptSeq) must fail closed — any error or
  timeout denies the rescue, never grants one. **Additionally**, on a
  valid, not-yet-consumed key, set an atomic
  `SET shield:peones-consumed:{idempotencyKey} 1 NX EX <ttl>` guard
  (mirrors the `shieldProcessedTx` SETNX pattern in `credit-shield`)
  before granting the rescue; if the guard's `NX` fails (key already
  marked consumed), reject — this is what closes the replay hole above.
- Wire into `use-fail-rescue.ts`: when `shieldsCount === 0`, offer "pay 2
  Peones to save your combo" instead of only "retry and lose it." The
  reroute in 2a below must reach this fallback too, not just
  `use-fail-rescue.ts` — see 2a note on `handleUseShield`'s early return.

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
  - `schema-sync.test.ts` — update to include `"shield"` in the merged
    migration source list (must fail red until the migration lands).
  - `spend-service.test.ts` — "shield" target cost/idempotency-prefix.
  - `shield-spend-fallback.test.ts` — mirrors
    `coach-spend-fallback` test shape.
  - `shields/spend/route.test.ts` — new `peonesIdempotencyKey` branch:
    valid unconsumed key at 0 balance allows spend; **same key replayed
    a second time is rejected** (closes the P0-2 replay hole); missing/
    mismatched key at 0 balance fails closed (409); ledger lookup
    error/timeout fails closed (never grants).
  - `exercises-screen.test.tsx` (or wherever `handleUseShield` is
    covered) — asserts it now calls `/api/shields/spend` with the same
    guard/outcome-split as `onUseShield`, not a local-only decrement; and
    that at 0 balance it falls through to the Peones fallback rather than
    early-returning.
  - Visual regression: refresh the `hub-shop-sheet-open` baseline in this
    PR (tile grid changes once coach-pack + shield tiles are removed) —
    per `[[feedback_vr_baseline_discipline]]`, not a follow-up.

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
