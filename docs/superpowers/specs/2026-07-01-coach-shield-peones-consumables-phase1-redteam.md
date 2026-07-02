# Red Team Review — Coach + Shield Peones consolidation, Phase 1 close

**Date**: 2026-07-01
**Reviewer mindset**: hostile QA + senior engineer (independent subagent, no shared context with the spec author)
**Spec under review**: `2026-07-01-coach-shield-peones-consumables-phase1-design.md`
**Code checked at**: `main` @ `101988ee`
**Cross-check status**: the 3 P0 findings below were independently re-verified
against the live repo (not taken on faith from the subagent) — confirmed
accurate: `peones_ledger_source_check` does not list `"shield"`
(`supabase/migrations/20260611010000_peones_labyrinth_completion_source.sql:24-38`),
`attemptSeq` exists exactly as claimed
(`components/exercises/exercises-screen.tsx:983,1038,2558`), and
`/api/shields/spend/route.ts` is confirmed to be a pure atomic
GET+DECRBY counter with **no idempotency-key concept at all** today.

## What the spec got right (verified, not manufactured)

- **Same Redis counter.** Season Pass (`verify-payment/route.ts:262`) and
  the Shop-TX shield credit (`credit-shield/route.ts:180`) both write
  `coach:shields:credited:<wallet>`. "Keep Season Pass, retire only the
  Shop purchase" is sound at the counter level.
- **Pending-tx queue is purchase-only.** `SHIELDS_PENDING_TX_KEY` is
  touched exclusively by the Shop-TX purchase flow. Season Pass /
  welcome-pack never touch it. "Delete only the queue half" is a clean cut.
- **Coach "leave untouched" is safe.** No orphan reader of
  `coach:credits:<wallet>` beyond the files the spec already lists.
  `verifyPeonesCoachPayment` is genuinely fail-closed.

## P0 — Must fix before implementation

### [P0-1] No SQL migration for the new `"shield"` ledger source — feature is DOA, mocked tests won't catch it

`peones_ledger.source` has a CHECK constraint whose allow-list (`daily_tactic`,
`coach`, `hint`, `retry`, `save_game`, etc. —
`20260611010000_peones_labyrinth_completion_source.sql:24-38`) does not
include `"shield"`. `PeonesLedgerSource` in `lib/peones/types.ts:56` doesn't
either, and `PeonesSpendTarget` derives from it — adding `"shield"` to
`PEONES_SPEND_TARGETS` without the type is a `tsc` error, and
`schema-sync.test.ts` will fail the moment the enum diverges from the
migration list.

**Failure scenario:** implementer ships per the spec's file list (only
`spend-service.ts` named), mocked tests pass (they never hit real
Supabase), prod RPC insert throws `check_violation` → 500 → the Peones
rescue silently never works. Fails closed, but the deliverable is dead with
nothing flagging it.

**Fix, folded into spec:** add as an explicit first commit of Scope 2b —
(1) forward-only migration adding `"shield"` to
`peones_ledger_source_check`, following the `20260611010000` pattern; (2)
add `"shield"` to `PeonesLedgerSource`; (3) extend `schema-sync.test.ts`'s
merged-migration list.

### [P0-2] "Mirror Coach" is replayable for Shield — one payment buys unlimited rescues

`verifyPeonesCoachPayment` only checks that a ledger row *exists*. That's
safe for Coach because the deliverable (a cached analysis) is itself
idempotent — replaying `analyze` with the same key returns the same
cached artifact, nothing new is granted. **A shield rescue has no cached
artifact** — every rescue is a fresh gameplay grant. Confirmed:
`/api/shields/spend/route.ts` has zero idempotency-key handling today.

**Failure scenario:** user at 0 shields pays 2 Peones once, then replays
the same `peonesIdempotencyKey` against `/api/shields/spend` N times. Ledger
verification passes every time (the row exists), nothing marks the key
consumed → N free rescues for one payment.

**Fix, folded into spec:** the new branch needs a one-row-one-grant guard —
atomic `SET shield:peones-consumed:{idempotencyKey} 1 NX EX <ttl>`
(mirrors the `shieldProcessedTx` SETNX pattern already in
`credit-shield`); reject if the key already exists. This is a Shield-only
requirement — Coach doesn't need it because its artifact is naturally
idempotent.

### [P0-3] `sourceId` identity was punted to the impl plan — it's the actual money-correctness decision

The original spec deferred picking a concrete `sourceId` (Coach's
`gameId` equivalent). Two naive choices both leak value:
- Stable per-exercise id → two genuine rescues on the same exercise in one
  session collapse onto one key → 2nd rescue is free (compounds P0-2).
- Id + raw timestamp → a network retry of the *same* rescue intent
  generates a new key → double-charged for one rescue.

**Fix, folded into spec:** use the existing `attemptSeq` counter (already
threaded through `exercises-screen.tsx` for exactly this
same-attempt-vs-fresh-attempt distinction, e.g. at `PeonesHintButton`'s
`attemptSeq` prop, line 2558) as the `sourceId`. Key shape:
`spend:shield:{wallet}:{attemptSeq}`. Same attempt retried → same key →
`duplicate=true`, no double charge. Fresh attempt → fresh key → real debit.
This is not a new mechanism — it's reusing a building block that already
exists for the identical problem shape.

## P1 — Should address, folded into the same patch

- **[exercises-screen.tsx has its own duplicate shop-purchase path]**
  Scope 2c/1 name only `use-shop-sheet-state.ts`, but
  `exercises-screen.tsx` carries a second `handleConfirmPurchase` with a
  live shield branch (`txSource "shop_retry_shield"`, `enqueuePendingTx` +
  `fetch("/api/credit-shield")`) and `shop-sheet.tsx`'s mini-lane
  hardcodes `[3n, SHIELD_ITEM_ID]`. Both retirement scopes (Coach and
  Shield) must extend to this second path or it 404s post-deploy with an
  orphaned queue entry.
- **[fail-closed contract for the new branch isn't pinned]** Must state
  explicitly: ledger error/timeout → deny; branch order is
  "`peonesIdempotencyKey` present → verify-only path; else → counter
  path" (not counter-first); missing/mismatched key at 0 balance → 409.
- **[Coach paywall CTA likely dead-ends]** `shop-catalog.ts:78-79`
  documents the paywall's "out of credits" CTA routes to the Shop coach
  tiles being deleted. Must verify/repoint to PRO/Peones.
- **[VR baseline]** `hub-shop-sheet-open` screenshots the tile grid;
  removing coach-pack + shield tiles guarantees a baseline diff — refresh
  in the same PR per `[[feedback_vr_baseline_discipline]]`.
- **[2a is not a one-line reroute]** `useFailRescue.onUseShield` is async,
  has an `isSpending` guard, and a 3-way outcome split. `handleUseShield`
  is sync, unguarded. The bug fix must carry the anti-double-tap guard,
  not just swap the call target.

## P2 — Noted, not blocking

- On-chain items 2/3/4 stay configured on `ShopUpgradeable` unless
  explicitly disabled — a stale cached frontend could still submit a tx
  for a deleted-from-UI item. Low impact under prelaunch/founder-only
  mode; note as a deploy-time consideration, not a blocker.
- `consumeOneShield()` in `shield-storage.ts` likely becomes dead code
  once 2a reroutes through the server — remove or justify keeping.
- PR-B ordering (bugfix → fallback → retirement) has no exploit window
  provided the P0-2 consumption guard lands together with 2b.

## Verdict

**NOT READY as originally written — 3 P0s, all independently verified
against live code.** All three are tightly coupled (idempotency-key
semantics) and resolved together: migration+type+test triplet, SETNX
consumption guard, `attemptSeq`-derived `sourceId`. Folded into the design
doc directly (this is pre-implementation, so patched in place rather than
tracked as a v1→v2 diff). P1s folded into the same patch. Proceed to
`/tdd` after the design doc reflects these fixes.
