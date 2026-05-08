# Spec — credit-shield-server-side

**Date**: 2026-05-08
**Status**: revised (v2.1 — addresses red-team v1 P0s/P1s + v2 P0/P1s)
**Carry-forward**: handoff `docs/handoffs/2026-05-10-shop-sheet-debug-handoff.md` §3
**Red-team**: `2026-05-08-credit-shield-server-side-redteam.md` (v2 — verdict READY)

## Problem

The retry-shield credit (3 shields per Shop purchase) is written
**client-side**, inside a `useEffect` that fires when wagmi's
`useWaitForTransactionReceipt` confirms the `buyItem` tx
(`apps/web/src/lib/shop/use-shop-sheet-state.ts:269-286`). If the user
navigates away — closes MiniPay, kills the tab, or just route-changes
hard enough to unmount the hook — between submit and confirmation, the
credit is **never written**. Pre-prod the impact is small; post-prod
each lost credit is real $0.025 + 3 missed shields.

The fix moves the credit to the server, gated by the receipt itself.

## Goal

After the user submits a `buyItem` tx for `SHIELD_ITEM_ID`, their
shield credit is durably persisted server-side keyed by the wallet,
even if the client unmounts before the receipt confirms. The client
mirrors that state and applies local spends.

## Non-goals

- Reconciling pre-fix orphan purchases (Q3 below).
- Migrating shield-spend to the server (only credits move; spend stays
  local — see §"Counter model" for why this is safe now).
- Changing pricing, `MAX_SHIELDS`, or `SHIELDS_PER_PURCHASE`.
- Touching `verify-pro` / `coach/verify-purchase` shape.
- A pre-purchase "you're capped" warning (future P1).

## Counter model — the key revision (addresses red-team P0-4)

The first draft stored a single mutable "available shields" number on
the server and let it race with client-side spends. This v2 splits the
state:

- **Server** stores `coach:shields:credited:${wallet}` — a **monotonic
  counter** of the total shields ever credited to that wallet. Never
  decrements. **No cap on the server**.
- **Client** stores `chesscito:shields:consumed` — a monotonic local
  counter of shields the user has spent. Never decrements (until a
  full reset, future scope).
- **Displayed shields** = `min(MAX_SHIELDS, max(0, credited − consumed))`.
  Cap is a UI clamp, not a server constraint.

Why this is correct:
- A credit can never be "lost to the cap" race-style — server just
  records that you bought, even past the visible cap; the over-credit
  becomes spendable as soon as you spend.
- Client-side spend never needs to be "respected" by the server; it
  lives in its own counter. Boot-sync only updates `credited`, leaving
  `consumed` intact.
- Migration on first server sync is trivial: pre-prod we treat
  `localStorage["chesscito:shields"]` (legacy single-number) as
  `credited - consumed = legacy`. Concretely, on first boot post-deploy
  with no `consumed` key, we set
  `consumed = max(0, credited_from_server − legacy)`. If
  `credited_from_server === 0` and legacy > 0 (very common pre-prod),
  we initialize `consumed = 0` and tag the wallet for a one-time
  baseline credit upload via §"Behavior 9" (one-shot migration).

## Decisions taken (v2)

| # | Decision | Rationale |
|---|---|---|
| Q1 | Server authoritative for **credits only**. | Bug class eliminated by construction; spend stays local because no race. |
| Q2 | Always call write endpoint after submit; server polls receipt. | Idempotent by `txHash`. |
| Q3 | No pre-fix reconciliation. | Pre-prod scope. |
| Q4 | Stablecoin-only enforced server-side. | Defense-in-depth, mirror `verify-pro`. |
| **Q5 (NEW)** | **Split into two routes**: `POST /api/credit-shield` (write) + `GET /api/shields/me` (read). | Red-team P0-1: clean union types; P0-2: separate rate-limit buckets. |
| **Q6 (NEW)** | **No server-side cap**. Cap is a UI clamp at render-time only. | Red-team P0-4: eliminates cap-vs-spend race entirely. |
| **Q7 (NEW)** | Read endpoint is **public** (any caller can query any wallet's `credited` count). Documented as public-readable; chain already exposes the purchases via `ItemPurchased` events. | Red-team P0-3: explicit stance over implicit leak. Per-IP rate-limit prevents enumeration spam. |
| **Q8 (NEW)** | Chain selected from `getConfiguredChainId()` (mainnet **and** Sepolia supported). | Red-team P1-3: dev/QA on Sepolia must work. |
| **Q9 (NEW)** | Lua does SETNX-on-`processedTx` **inside** the script. | Red-team P1-5: closes concurrent-same-tx race. |
| **Q10 (NEW)** | Client maintains a `pending-shield-tx` queue in localStorage; boot-sync retries queued txHashes before reading the count. | Red-team P1-7: closes "user closes app immediately after submit and reopens days later" gap. |
| **Q11 (v2.1)** | Pending-tx queue dequeues **only on 2xx**. Per-entry 30-day TTL + 32-entry ring-buffer for organic eviction of permanently-bad txs. | Red-team v2 P0: `unprocessable` is a collapsed error (mixes terminal + transient cases); cannot dequeue on it without re-introducing the lost-credit bug for slow-mined txs. |
| **Q12 (v2.1)** | All shield read sites (`chesscito-footer` chip, retry button, etc.) migrate to `readDisplayedShields()` in the **same PR** as the server-side credit work. | Red-team v2 P1: legacy key gets deleted by §9; chip stuck at 0 if not co-migrated. |

## Contracts (SDD)

### `POST /api/credit-shield` — server-side credit write

```ts
type CreditShieldRequest = {
  txHash: `0x${string}`;        // 0x-prefixed 32-byte hex (validated)
  walletAddress: `0x${string}`; // checksum-tolerant; matched against ItemPurchased.buyer
};

type CreditShieldSuccess = {
  ok: true;
  /** Total monotonic credits for this wallet, post-call. */
  credited: number;
  /** Delta applied by *this* call. 0 = idempotent retry of an already-
   *  processed tx. ≥3 (multiples of SHIELDS_PER_PURCHASE if the tx
   *  contained multiple ItemPurchased(itemId=2) events). */
  delta: number;
  /** Echoed lowercase. */
  txHash: string;
};

type CreditShieldError = {
  ok: false;
  /** Pre-validation errors are specific (helps client retry logic).
   *  Post-validation errors are unified into `unprocessable` to
   *  avoid tx-existence oracles (red-team P1-2). */
  error:
    | "missing_params"   // 400 — txHash or walletAddress absent / not configured
    | "invalid_wallet"   // 400 — !isAddress(walletAddress)
    | "invalid_tx_hash"  // 400 — !TX_HASH_RE.test(txHash)
    | "rate_limited"     // 429
    | "origin_blocked"   // 403
    | "unprocessable"    // 400 — tx not mined within poll, tx failed, no shield purchase, wrong buyer, non-stablecoin token
    | "internal";        // 500
};

type CreditShieldResponse = CreditShieldSuccess | CreditShieldError;
```

### `GET /api/shields/me?wallet=0x…` — public credit read

```ts
type ShieldsMeRequest = {
  /** Query string; lowercased before lookup. */
  wallet: `0x${string}`;
};

type ShieldsMeSuccess = {
  ok: true;
  /** Total monotonic credits. 0 if no record. */
  credited: number;
};

type ShieldsMeError = {
  ok: false;
  error: "missing_params" | "invalid_wallet" | "rate_limited" | "origin_blocked" | "internal";
};

type ShieldsMeResponse = ShieldsMeSuccess | ShieldsMeError;
```

Read endpoint trades a separate (looser) per-IP rate-limit bucket
(`shields:read:${ip}`) than the write bucket — read is allowed up to
60/min, write up to 10/min. Documented as **public-readable**; chain
already exposes shield purchases via `ItemPurchased` events on the Shop
contract.

### Redis keys (additions to `apps/web/src/lib/coach/redis-keys.ts`)

```ts
/** Per-wallet monotonic credit counter (0..∞). No TTL. Lives under
 *  `coach:` namespace for ops parity with `pro:` and `credits:`. */
shieldsCredited: (wallet: string) => `coach:shields:credited:${wallet}`,

/** Per-tx dedupe — set NX inside the credit Lua. 90-day TTL. */
shieldProcessedTx: (txHash: string) => `coach:shields:processed-tx:${txHash}`,
```

### Client storage (`apps/web/src/lib/shop/shield-storage.ts`, new)

```ts
export const SHIELDS_LEGACY_KEY = "chesscito:shields";        // pre-v2 single-number — read once for migration, then unused
export const SHIELDS_CONSUMED_KEY = "chesscito:shields:consumed";
export const SHIELDS_CREDITED_CACHE_KEY = "chesscito:shields:credited-cache";
export const SHIELDS_PENDING_TX_KEY = "chesscito:shields:pending-tx"; // JSON array of `0x${string}`
export const MAX_SHIELDS = 30;

/** Derived: clamped to [0, MAX_SHIELDS]. */
export function readDisplayedShields(): number;
/** Bumps `consumed` by 1; never touches `credited`. */
export function consumeOneShield(): void;
/** Idempotent push; bounded length 32 (ring-buffer trim, oldest first).
 *  Each entry is `{ txHash, queuedAt: number }`. Entries older than
 *  PENDING_TX_TTL_MS (30 days) are dropped on read. */
export function enqueuePendingTx(txHash: `0x${string}`): void;
export function dequeuePendingTx(txHash: `0x${string}`): void;
export function readPendingTxs(): { txHash: `0x${string}`; queuedAt: number }[];
export const PENDING_TX_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Set after read endpoint confirms; used by readDisplayedShields(). */
export function writeCreditedCache(n: number): void;
export function readCreditedCache(): number;
/** Returns true once; consumes the legacy key into a one-shot migration
 *  payload that the caller uploads via §"Behavior 9". */
export function consumeLegacyShieldsForMigration(): { legacy: number } | null;
```

### Boot-sync hook (`apps/web/src/lib/shop/use-shield-sync.ts`, new)

```ts
export function useShieldSync(): {
  /** Last server-confirmed `credited`, null until first sync resolves. */
  serverCredited: number | null;
  /** Manual trigger (e.g., right after a credit-shield write). */
  refresh: () => Promise<void>;
};
```

The hook runs on `useAccount()` connect with a defined address.
**Re-entry guard**: a `useRef<boolean>` `syncingRef` short-circuits
overlapping invocations (wagmi can fire connect twice on
account-switch / sleep-resume). Set true before sequence, reset in
`finally`.

Internal sequence:
1. Drain `readPendingTxs()` (already TTL-pruned by reader). For each,
   `POST /api/credit-shield` with the queued `txHash`.
   - **2xx (any `delta`, including 0)** → `dequeuePendingTx`.
   - **Any 4xx OR 5xx** → leave queued. Organic eviction comes from
     the 30-day per-entry TTL + 32-entry ring-buffer trim. The
     collapsed `unprocessable` error mixes terminal cases (tx failed
     forever) with transient cases (slow-mined tx); we cannot
     distinguish from the response, so we accept the bounded retry
     cost.
2. `consumeLegacyShieldsForMigration()` — if a legacy number exists,
   one-shot migration via §"Behavior 9".
3. `GET /api/shields/me?wallet=…` → `writeCreditedCache(credited)` and
   dispatch `shield-events`.

### Telemetry

```ts
track("shield_credit_server", {
  stage: "start" | "success" | "error",
  source: "post_submit" | "boot_sync_retry" | "boot_sync_read" | "migration",
  wallet_hash?: string,    // hashWallet(walletAddress) — non-throwing
  delta?: number,          // success
  credited?: number,       // success
  error_kind?: CreditShieldError["error"] | ShieldsMeError["error"],
});
```

## Behavior

1. **Client calls `POST /api/credit-shield` immediately after `buyItem`
   write resolves.** Inside `handleConfirmPurchase`, after
   `setShopTxHash(buyHash)`, client `enqueuePendingTx(buyHash)`
   *first*, then fires the fetch with `{ txHash, walletAddress }`. On
   **2xx (any `delta`, including 0)** → `dequeuePendingTx`,
   `writeCreditedCache(response.credited)`, dispatch `shield-events`.
   On **any error response (4xx/5xx) or network failure** → leave the
   entry queued; boot-sync drains it later (per §7). The 30-day
   per-entry TTL + 32-entry ring-buffer evict permanently-bad txs
   (failed-on-chain, fee-too-low, dropped) organically.

   **Banner timing note**: the success banner reflects *tx submission*,
   not *server-side credit success*. The server polls receipt up to
   20s; the banner auto-dismisses at 6s. The chip will reflect the
   new total when (a) the post-submit fetch resolves before unmount
   (immediate via `writeCreditedCache`) or (b) the next boot-sync
   runs (recovery path). This is intentional: banner truthfulness is
   "your tx is on chain", which is true the instant `buyHash` exists.

2. **Server validates origin + rate-limits** (write bucket: 10/min/IP).

3. **Server polls receipt** with `publicClient.waitForTransactionReceipt({ hash, timeout: 20_000 })`.
   Chain is `getConfiguredChainId()`-derived (mainnet 42220 or
   sepolia 11142220). On any failure (timeout, fetch error, status !==
   "success", no matching log) → return `unprocessable` (400) with the
   *real* reason in `logger.warn`, not the response.

4. **Server validates the receipt logs.**
   - Filter by `address === SHOP_ADDRESS && topics[0] === ITEM_PURCHASED_TOPIC`.
   - For each matching log, decode via `ITEM_PURCHASED_ABI`. Skip
     decode failures with a `logger.warn` (smoking-gun pattern from
     `verify-pro`).
   - Match: `buyer.toLowerCase() === wallet.toLowerCase() &&
     itemId === SHIELD_ITEM_ID && STABLECOIN_ADDRESSES_LOWER.includes(token.toLowerCase())`.
   - Zero matches → `unprocessable` (400).
   - N≥1 matches → continue with `matches = N`.

5. **Server credits via single Lua EVAL.**
   ```lua
   -- KEYS: [1]=processedTx, [2]=creditedCounter
   -- ARGV: [1]=delta, [2]=processedTtlSec
   local already = redis.call('SET', KEYS[1], '1', 'NX', 'EX', ARGV[2])
   if not already then
     -- Already processed; return existing credited with delta=0.
     local cur = redis.call('GET', KEYS[2])
     return { tonumber(cur) or 0, 0 }
   end
   local newTotal = redis.call('INCRBY', KEYS[2], ARGV[1])
   return { newTotal, tonumber(ARGV[1]) }
   ```
   - `delta = matches * SHIELDS_PER_PURCHASE`. No cap applied
     server-side (UI clamps).
   - `SETNX` *inside* the script ensures the dedupe is atomic with the
     credit (red-team P1-5).
   - Returns `[credited, delta]`.

6. **Server returns `{ ok: true, credited, delta, txHash }`.** Telemetry
   `success` event fires with `wallet_hash`. **Failure mapping**:
   - origin/rate-limit → `403 origin_blocked` / `429 rate_limited`.
   - param validation → `400 missing_params | invalid_wallet | invalid_tx_hash`.
   - any post-validation failure (poll timeout, receipt status, log
     decode, no match) → `400 unprocessable` (collapsed to avoid
     tx-existence oracle).
   - `redis.eval` exception (Redis down, Lua syntax) → outer
     `try/catch` returns `500 internal`.

   Client retry contract: **any non-2xx leaves the txHash in the
   pending queue**; only 2xx (with any `delta`) dequeues.

7. **Boot-sync drains pending queue first, then reads count.** See
   `useShieldSync()` sequence in §"Contracts". Order matters: drain
   queued credits before reading, so the read reflects the latest
   total.

8. **Client display always recomputes from cached counters.** UI never
   stores a single "available shields" number. `readDisplayedShields()`
   returns `min(MAX_SHIELDS, max(0, readCreditedCache() − readConsumedCount()))`.
   `chesscito-footer` chip and the consume path both use it.

9. **One-time legacy migration (forfeit-and-clear).** If the wallet
   has `localStorage["chesscito:shields"] = N > 0` and no
   `chesscito:shields:consumed` key:
   - Initialize `consumed = 0` and `credited-cache = 0` (or whatever
     the server reports — they're independent counters; cache writes
     happen in step 3 of §"useShieldSync").
   - **Forfeit** the legacy `N` (do not back-credit; back-crediting
     without an on-chain receipt opens a trust hole that costs more
     than the lost shields).
   - **Atomic clear**: only delete `chesscito:shields` *after*
     `consumed` and `credited-cache` writes both succeed. If a write
     throws, retry on next boot.
   - Emit `track("shield_credit_server", { stage: "success", source: "migration", delta: 0 })`
     with `wallet_hash` for ops visibility (so we can correlate "user
     reports lost shields" with "their wallet hit migration code").
   - Document in user-visible release notes: "local shield counts
     reset on this update — purchased shields will appear as new
     credits land."

   *(The earlier draft's `if credited > 0` branch is removed: pre-
   deploy nobody has a server `credited > 0`, so the branch is dead
   code in practice. Rollback-then-redeploy is out of scope.)*

10. **Spend (unchanged path).** Retry button calls
    `consumeOneShield()`; client display refreshes via
    `shield-events`. Server is not involved.

## Edge cases

- **Network partition between submit and `/api/credit-shield`.** Tx
  stays in `pending-shield-tx` queue; next boot-sync retries.
- **User closes app immediately after submit and doesn't reopen for a
  week.** Tx still in queue on next launch; boot-sync drains it. No
  loss.
- **User submits two shield txs back-to-back.** Two separate `txHash`
  Lua executions; both increment `credited`.
- **One tx with multiple `ItemPurchased(itemId=2)` events.** Single
  Lua call with `delta = matches * 3`.
- **User at displayed cap (30) and buys.** Server `credited` goes to
  33; UI displays 30. After spending one, UI displays 30 still (29
  underlying, but max'd back to 30 since `credited - consumed = 32`).
  Eventually the over-credit drains naturally.
- **Concurrent two-client race on same `txHash`.** Both EVAL the Lua;
  the SETNX inside ensures only one succeeds the credit; the other
  returns `delta=0`.
- **Concurrent boot-sync from two devices.** Each does its own pending
  drain + read. Read is monotonic; no corruption.
- **`SHOP_ADDRESS` env unconfigured.** Endpoint returns
  `missing_params` (400). Telemetry catches.
- **Sepolia QA**: chain selection from env; same code path.
- **Wallet disconnect-and-reconnect-as-different-wallet between submit
  and post-submit fetch.** The fetch is fired with the wallet that
  *submitted* the tx, captured by closure in `handleConfirmPurchase`.
  Even if `useAccount()` flips mid-flight, the request body still has
  the correct buyer.
- **`hashWallet()` failure in telemetry.** Wrapped non-throwing
  (recent `01d7213` fix); event emits without `wallet_hash` rather
  than crashing the route.

## Acceptance criteria

- [ ] AC1: `POST /api/credit-shield` for a confirmed shield-purchase tx
      with clean wallet returns `{ ok: true, credited: 3, delta: 3, txHash }`.
- [ ] AC2: Same call repeated returns `{ ok: true, credited: 3, delta: 0 }`.
- [ ] AC3: Two distinct shield txs from same wallet → final `credited`
      equals 6. **No server-side cap** is applied; cap is UI-only.
- [ ] AC4: Tx with only `ItemPurchased(itemId=1, …)` returns
      `unprocessable` 400.
- [ ] AC5: Tx where `buyer !== walletAddress` returns `unprocessable` 400.
- [ ] AC6: Tx with `itemId=2` but non-stablecoin `token` returns
      `unprocessable` 400.
- [ ] AC7: Receipt with `status !== "success"` returns `unprocessable` 400.
- [ ] AC8: Unmined tx polled past 20s returns `unprocessable` 400;
      Redis untouched.
- [ ] AC9: Origin-blocked → `origin_blocked` 403; rate-limited →
      `rate_limited` 429.
- [ ] AC10: `GET /api/shields/me?wallet=…` for an unknown wallet
      returns `{ ok: true, credited: 0 }`.
- [ ] AC11: `GET /api/shields/me?wallet=…` after a successful credit
      reflects the post-credit total.
- [ ] AC12: `GET /api/shields/me` rate-limit bucket is independent
      from the write bucket (verified by spamming reads doesn't block
      a credit write from the same IP).
- [ ] AC13: Lua atomicity — two concurrent EVALs with the same
      `txHash` produce exactly one `delta > 0` and one `delta === 0`
      (test via concurrent `Promise.all`).
- [ ] AC14: `useShieldSync()` drains a queued `pending-shield-tx`
      before reading; the read reflects the post-drain `credited`.
- [ ] AC15: `use-shop-sheet-state` calls `/api/credit-shield` after
      `setShopTxHash(...)`; the receipt-watcher `useEffect` and
      `pendingShieldCredit` flag are removed.
- [ ] AC16: Display = `min(MAX_SHIELDS, max(0, credited − consumed))`.
      A wallet with `credited=33, consumed=2` displays 30; with
      `credited=33, consumed=4` displays 29.
- [ ] AC17: Telemetry events include `wallet_hash` on success and
      error; `hashWallet()` failure does **not** throw.
- [ ] AC18: One-shot legacy migration deletes
      `localStorage["chesscito:shields"]` after first sync; deletion
      happens **only after** `consumed` + `credited-cache` writes
      both succeed (atomic-shaped).
- [ ] AC19: Post-submit fetch returning 4xx leaves the txHash in the
      pending queue; only 2xx (any `delta`) dequeues.
- [ ] AC20: Post-submit fetch returning 500 (Redis down sim) leaves
      the txHash in the pending queue.
- [ ] AC21: Pending-tx ring-buffer evicts oldest at 33rd enqueue;
      entries with `queuedAt + PENDING_TX_TTL_MS < now` are dropped
      on read.
- [ ] AC22: All shield-display sites read via `readDisplayedShields()`
      (verified by `grep "chesscito:shields"` returning only
      `shield-storage.ts` post-PR).
- [ ] AC23: `useShieldSync()` re-entry guard — two synchronous calls
      to the hook's `refresh()` produce exactly one network request
      (the second short-circuits via `syncingRef`).

## Test plan

- **Unit (vitest)**: Lua semantics with mocked `redis.eval` — cap
  removed, idempotency, multi-match, atomic SETNX. Mirror
  `apps/web/src/app/api/verify-pro/__tests__/route.test.ts`.
- **Integration (vitest)**: full POST + GET handlers with mocked
  `createPublicClient` returning synthesized receipts. AC1–AC13 each
  get a test.
- **Client unit**: `use-shop-sheet-state.test.tsx` updated — old
  receipt-watcher assertions deleted; new assertions on
  `fetch("/api/credit-shield", …)` body. New
  `use-shield-sync.test.tsx` covers AC14, AC18.
- **Storage unit**: `shield-storage.test.ts` covers AC16, queue
  enqueue/dequeue idempotency, ring-buffer trim at 32.
- **E2E**: not in scope this PR. Future Playwright spec could simulate
  a hard-reload between submit and receipt to lock in the no-loss
  guarantee.

## Out of scope / future

- Pre-purchase cap warning in Shop sheet ("you're at 30; new credits
  bank for later").
- Server-authoritative spend (anti-cheat). Schema supports it: add a
  decrement Lua against a new `coach:shields:consumed:${wallet}` key.
- Reconciliation of pre-fix orphan purchases (chain-scan on connect).
- Cross-device parity for `consumed` counter (today: per-device).
- Rollback flag (`NEXT_PUBLIC_USE_SERVER_SHIELDS`) — see "Operational
  readiness" below; tracked but not blocking.

## Operational readiness

- **Logging**: `logger.warn("decode failed", { logIndex, dataSize, … })`
  smoking-gun line, parity with `verify-pro`. Plus
  `logger.info("credit ok", { wallet_hash, delta, credited })`.
- **Rollback**: env-flag `NEXT_PUBLIC_USE_SERVER_SHIELDS` (boolean)
  flips client between v1 (receipt-watcher) and v2 (server-side). v1
  code path is removed in the same PR; the flag's "off" state means
  "no credit happens, banner still fires" — so this is documented as
  a kill-switch, not a true rollback. Acceptable for pre-prod; revisit
  before mainnet user-facing deploy if any.
- **Monitoring**: error-rate alert on `/api/credit-shield` and
  `/api/shields/me` — piggy-back on existing Vercel logs filtered by
  the `route` label. No new infra.
- **ABI source**: confirm `ITEM_PURCHASED_ABI` from
  `lib/contracts/generated/shop-events.ts` is current at the commit of
  the PR (re-run `pnpm --filter @chesscito/contracts run generate-event-abis`
  if there's any doubt). 2026-05-02 incident memory.

## Open questions

1. **Pending-tx queue size.** 32 entries is a guess. If a user buys
   more than 32 shields in a single offline window without ever
   reopening, oldest are dropped. Pre-prod fine; track for revisit.
2. **Wallet-hash salt rotation.** Out of scope — coach pipeline owns
   `LOG_SALT`; we reuse it.
3. **Read-endpoint privacy stance documentation.** Once confirmed in
   release notes, link from `DESIGN_SYSTEM.md` or `CLAUDE.md` so
   future reviewers don't re-litigate it.
