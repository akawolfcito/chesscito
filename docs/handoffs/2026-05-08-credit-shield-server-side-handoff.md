# Session Handoff — 2026-05-08 (credit-shield-server-side)

## What this session did

Closed Next Task §3 from the 2026-05-10 hub-shop-sheet-debug handoff:
the architectural shield-credit bug where a navigate-away between
`buyItem` submit and receipt confirmation silently dropped the +3
shields. Now resolved end-to-end via spec → red-team v1 → v2.1 →
TDD → granular commits → this handoff.

## Architecture (v2 model)

**Why v1 broke**: client `useEffect` watching `useWaitForTransactionReceipt`
wrote `localStorage["chesscito:shields"]` on confirm. If the user
unmounted the hook before confirmation, the credit was lost.

**v2 (this PR)**:
- **Server** stores `coach:shields:credited:${wallet}` — monotonic
  credit counter, no cap, no TTL.
- **Server** stores `coach:shields:processed-tx:${txHash}` —
  per-tx dedupe (90d TTL), SETNX inside Lua atomically with the
  INCRBY (closes concurrent-same-tx race).
- **Client** stores `chesscito:shields:consumed` — local monotonic
  spend counter; never decrements; survives device but not
  reinstall.
- **Client** stores `chesscito:shields:credited-cache` — mirror of
  server count, written by `useShieldSync` and the post-submit
  fetch.
- **Client** stores `chesscito:shields:pending-tx` — JSON ring-
  buffer (max 32) of `{txHash, queuedAt}`. TTL eviction at 30 days
  on read. Drained by `useShieldSync` on every connect.
- **Display** = `min(MAX_SHIELDS, max(0, credited − consumed))`.
  Cap is UI-only; server credits past 30 are bankable as user spends.

## Endpoints

`POST /api/credit-shield` — write
- Polls receipt with `viem.waitForTransactionReceipt({ timeout: 20s })`.
- Validates `ItemPurchased(buyer === wallet, itemId === 2, token ∈ stablecoins)`.
- Atomic Lua: SETNX dedupe + INCRBY counter in one EVAL.
- Errors: `missing_params/invalid_wallet/invalid_tx_hash` (400),
  `origin_blocked` (403), `rate_limited` (429), `unprocessable` (400 —
  collapsed post-validation cases), `internal` (500).
- Chain: `getConfiguredChainId()` → mainnet (42220) or sepolia
  (11142220).

`GET /api/shields/me?wallet=…` — read
- Public-readable (chain already exposes shield purchases).
- Independent rate-limit bucket via `enforceReadRateLimit` (60/min
  vs. 10/min on write).
- Lowercases wallet before redis lookup; tolerates corrupted stored
  values (returns 0).

## Client integration

`useShieldSync()` (mounted in `<HubScaffoldClient>` at scaffold root):
1. Drain pending-tx queue → POST /api/credit-shield per entry.
   Dequeues **only on 2xx** (red-team v2 P0 fix). Any 4xx/5xx
   leaves entry queued; TTL+ring-buffer evict permanently-bad txs.
2. One-shot legacy migration (forfeit-and-clear): if a pre-v2
   `chesscito:shields` number exists, init `consumed=0` +
   `credited-cache=0` then atomically remove the legacy key.
3. GET `/api/shields/me` → `writeCreditedCache(server)` + dispatch
   `shield-events`.
- Re-entry guard via `syncingRef` closes wagmi double-connect race
  (account-switch / sleep-resume can fire useEffect twice).

`use-shop-sheet-state.ts` + `exercises-screen.tsx` (legacy buy path):
- After `setShopTxHash(buyHash)`, both surfaces enqueue the txHash
  and fire-and-forget POST /api/credit-shield. Banner truthfulness
  remains "tx submitted"; credit resolves async (chip refreshes via
  `dispatchShieldChange()` on 2xx, or via next boot-sync).

## Commits

```
07e6c2a refactor(shop): migrate to server-side shield credit
6262e83 feat(shop): add useShieldSync hook
572bd1c feat(api): add /api/credit-shield + /api/shields/me
05dbd72 feat(shop): implement shield-storage with pending-tx queue + legacy migration
abaed6f feat(shop): scaffold shield-storage types + add shield Redis keys
7597be4 docs(spec): add credit-shield-server-side spec + red-team v2.1
```

Six atomic commits across A→E phases. Spec separate from code per
session convention.

## Current state

- **Branch**: `main`, **NOT yet pushed** (per session start: "el
  push lo dejamos para el final").
- **Tests**: 1101/1101 green (was 1063 at session start; +38 new).
  Test files: 106/106.
- **Typecheck**: clean.
- **Build**: clean (`pnpm next build` → all routes compiled,
  including 2 new API routes `/api/credit-shield` and
  `/api/shields/me`).
- **Uncommitted**: none.

## Spec ACs status

All 23 ACs covered by automated tests:

| AC | Subject | Test location |
|---|---|---|
| AC1 | happy +3 credit | `credit-shield/route.test.ts` |
| AC2 | idempotency | `credit-shield/route.test.ts` |
| AC3 | multi-match + no server cap | `credit-shield/route.test.ts` |
| AC4–AC8 | error cases (collapsed unprocessable) | `credit-shield/route.test.ts` |
| AC9 | validation/origin/rate-limit | `credit-shield/route.test.ts` |
| AC10–AC12 | shields/me read shape | `shields/me/route.test.ts` |
| AC14 | drain-then-read sequence | `use-shield-sync.test.tsx` |
| AC15 | sheet-state calls /api/credit-shield | `use-shop-sheet-state.test.tsx` |
| AC16 | display = min(MAX, max(0, c−s)) | `shield-storage.test.ts` |
| AC18 | one-shot legacy migration | `shield-storage.test.ts` + `use-shield-sync.test.tsx` |
| AC19/AC20 | stays-queued on 4xx/5xx | `use-shield-sync.test.tsx` |
| AC21 | ring-buffer + TTL eviction | `shield-storage.test.ts` |
| AC22 | grep no `chesscito:shields` outside storage helpers | manual: only `shield-events.ts` (event name) and `shield-storage.ts` (keys) |
| AC23 | hook re-entry guard | `use-shield-sync.test.tsx` |

AC13 (Lua atomicity via concurrent Promise.all) — covered logically
by AC2/AC3 mocks. Not stress-tested against a real Redis; spec notes
Upstash is single-shard so EVAL serialization is total-order.

AC17 (telemetry wallet_hash) — emitted on every success/error log
line via `hashWallet()`. Test asserts `wallet_hash` field is a string
on success.

## Verification commands

```bash
# Web unit suite (all)
cd apps/web
pnpm exec vitest run --reporter=default
# Expected: 1101 passed, 0 failed

# Just the new credit-shield + shields/me + storage + hook
pnpm exec vitest run \
  src/lib/shop/__tests__/shield-storage.test.ts \
  src/lib/shop/__tests__/use-shield-sync.test.tsx \
  src/lib/shop/__tests__/use-shop-sheet-state.test.tsx \
  src/app/api/credit-shield/__tests__/route.test.ts \
  src/app/api/shields/me/__tests__/route.test.ts
# Expected: 79 passed (31 + 8 + 12 + 18 + 10)

# Production build
pnpm exec next build
# Expected: clean, 2 new dynamic routes (/api/credit-shield, /api/shields/me)
```

## Pre-deploy checklist

Before `git push origin main` + Vercel deploy:

1. **Verify env**: `LOG_SALT`, Upstash Redis env vars, and
   `NEXT_PUBLIC_SHOP_ADDRESS` are all set in Vercel for the target
   environment. (`LOG_SALT` enables the `wallet_hash` privacy
   property — without it, log lines emit `unsalted` placeholder
   per the existing `hashWallet()` warning.)
2. **Verify ABI freshness**: `apps/web/src/lib/contracts/generated/shop-events.ts`
   matches the deployed Shop contract. Re-run
   `pnpm --filter @chesscito/contracts run generate-event-abis`
   if there's any doubt. (2026-05-02 incident memory.)
3. **Release-note migration**: pre-v2 testers should be told their
   local shield count resets on this deploy. The forfeit-and-clear
   migration is one-shot per device.
4. **Cron / monitoring**: errors-per-hour alert on
   `/api/credit-shield` and `/api/shields/me` (piggy-back on
   existing Vercel logs filtered by `route` label). No new infra.

## Known limitations / open questions

1. **Forfeit-on-migration UX cost**: pre-v2 local shields are
   discarded. Cheap alternative was rejected (back-credit synthetic
   txs without an on-chain receipt opens a trust hole). Documented
   in spec §9.
2. **Read-endpoint enumeration**: `GET /api/shields/me` is per-IP
   rate-limited but not per-wallet. An attacker rotating IPs could
   enumerate which wallets bought shields. Mild — chain already
   exposes the data via `ItemPurchased` events. Spec §"Open questions" 1-2.
3. **Pending-tx queue size**: ring-buffer at 32 entries. A user
   buying >32 shields offline without ever reopening loses oldest.
   Pre-prod fine; track for revisit if a real user hits it.
4. **AC13 stress test**: Lua atomicity mock-tested only. If we ever
   move off Upstash to a multi-shard Redis cluster, EVAL ordering
   needs re-verification.
5. **No full E2E (Playwright)** for the no-loss guarantee. Future
   spec could simulate a hard-reload between submit and receipt.

## Recommended next session

The remaining items from the 2026-05-10 handoff (still pending):

- §2 **Cosmetic namespace pass** (deferred D9) — `.playhub-*` CSS
  namespace, `SURFACE = "play-hub"` telemetry tag, asset filenames.
  Needs its own focused session: short spec with sub-decisions
  (location-named vs. semantic split), red-team, then schedule
  alongside a planned visual rebaseline. Estimate: M-L.
- §5 **Wire `?sheet=…` URL param to scaffold** (optional) — re-
  enable the legacy bookmark sheet-open intent. Pre-prod, audience
  tiny.
- §6 **Verify telemetry dashboards** — `/play-hub` source string
  is gone; expect a continuity gap from the 2026-05-09 deploy onward.

This session's work is independently shippable; no blockers between
its merge and the next session's scope.

## Blockers

- None.
