# Hall of Fame — Incremental Scan Design Spec

**Date:** 2026-03-24
**Status:** Draft
**Author:** Wolfcito + Claude
**Red Team:** `docs/reviews/red-team-2026-03-24-hall-of-fame-cache.md`

---

## 1. Problem Statement

The `/api/hall-of-fame` and `/api/my-victories` endpoints scan on-chain `VictoryMinted` event logs from block 61,250,000 to latest using `eth_getLogs` in 50K-block chunks via the Celo RPC (`forno.celo.org`).

**Measured performance:**
- 1 chunk = ~10.5s (forno.celo.org latency)
- Current range: ~1.25M blocks = 26 chunks
- Total scan time: **~273s (4.5 minutes)**
- Vercel serverless function timeout: 10s (hobby) / 60s (pro)
- Result: **requests always timeout; trophies page crashes MiniPay WebView**

The scan range grows by ~17K blocks/day (~0.34 chunks/day). This never improves; it worsens linearly.

## 2. Why Proposals A/B/C Fail

| Proposal | Fatal Flaw |
|----------|-----------|
| **A — Cache with TTL** | First request after TTL expiry requires full re-scan (273s). Exceeds Vercel timeout. Cache never gets populated. |
| **B — Index at mint time** | `sign-victory` returns a signature; user may never submit the tx. Creates phantom entries. Server has no mint-confirmation callback. |
| **C — Hybrid (A + stale fallback)** | Inherits A's fatal flaw. Without a prior cache, there is no fallback. First-ever visit has no data. |

## 3. Chosen Architecture — Incremental Scan

### Core Idea

Store the last successfully scanned block number in Redis. Each API request scans only the delta (new blocks since last scan). New events are appended to Redis sorted sets. The full historical scan runs once as a CLI backfill script outside the API route.

### Invariants

1. **Chain is source of truth.** Redis is a read-through index, not a primary store.
2. **Scan is incremental.** Steady-state scans cover minutes of blocks, not months.
3. **Backfill is offline.** The one-time historical scan runs via CLI, never inside a Vercel function.
4. **Reads never block on refresh.** The API serves whatever Redis has, even if stale.

## 4. Redis Data Model

All keys use the prefix `hof:` to avoid collisions with existing `coach:` keys.

```
hof:lastBlock          — String. Last block number successfully indexed.
                         Default: EVENT_SCAN_START (61250000).

hof:entries            — Sorted Set.
                         Score: blockNumber * 100000 + logIndex
                         Member: JSON string of HallOfFameRow
                         Purpose: Global hall of fame, ordered newest-first.

hof:player:{address}   — Sorted Set (same schema as hof:entries).
                         Per-player victory index.
                         Address is lowercased, checksummed not required.

hof:refresh:lock       — String with TTL. Mutex for concurrent refresh.
                         Value: timestamp of lock acquisition.
                         TTL: 30s (auto-expires if holder crashes).
```

### Score Formula

```
score = blockNumber * 100_000 + logIndex
```

- `blockNumber` provides ordering by chain time.
- `logIndex` breaks ties within a block (deterministic).
- Factor of 100,000 ensures logIndex never overflows into block territory (max logIndex per block is realistically <10,000).
- For "newest first" queries, use `ZREVRANGE`.

### Member Identity and Deduplication

Each sorted set member is a JSON string. To prevent duplicates from replay scans, the member includes a stable identity field:

```json
{
  "id": "0xabc123:42",
  "tokenId": "7",
  "player": "0x...",
  "difficulty": 2,
  "totalMoves": 38,
  "timeMs": 145000,
  "timestamp": 1742400000
}
```

- `id` = `${txHash}:${logIndex}` — globally unique, stable across re-reads.
- Redis sorted sets deduplicate by member value. Two inserts of the same JSON string = one entry. However, if any field differs (e.g., different serialization), dedup fails.
- **Mitigation:** We canonicalize the JSON before insertion (sorted keys, no whitespace). The `id` field is the primary dedup mechanism; if the same `txHash:logIndex` appears twice with identical data, the second `ZADD` is a no-op.

### Why not a Hash per event?

Sorted sets give us ordering + pagination + dedup in a single structure. A hash-per-event would require a separate index for ordering, doubling the write surface and complexity.

## 5. Incremental Scan Algorithm

```
function refreshIndex():
  1. Try to acquire lock: SET hof:refresh:lock <now> NX EX 30
     - If lock exists, skip refresh (another request is handling it).
     - Return immediately; the read path serves existing data.

  2. Read lastBlock = GET hof:lastBlock ?? EVENT_SCAN_START

  3. Compute scanFrom = max(EVENT_SCAN_START, lastBlock - REORG_BUFFER)
     - REORG_BUFFER = 10 (Celo has instant finality, but 10 blocks
       covers edge cases like RPC returning slightly stale data)

  4. latestBlock = eth_blockNumber()
     - If latestBlock <= scanFrom, no work. Delete lock. Return.

  5. Scan logs from scanFrom to latestBlock in CHUNK_SIZE (50,000) chunks.
     - Use same getLogsPaginated() that exists in victory-events.ts.

  6. For each log:
     a. Resolve block timestamp (batch getBlock calls).
     b. Build row with id = txHash:logIndex.
     c. Compute score = blockNumber * 100000 + logIndex.
     d. ZADD hof:entries score canonicalJSON(row)
     e. ZADD hof:player:{log.player.toLowerCase()} score canonicalJSON(row)

  7. Pipeline all ZADD commands in a single Redis pipeline for atomicity.

  8. Only after pipeline succeeds:
     SET hof:lastBlock latestBlock

  9. Delete lock: DEL hof:refresh:lock

  10. Return metrics: { blocksScanned, newEventsFound, scanDurationMs }
```

### Chunk Budget for Serverless

Steady state: ~17K new blocks/day. With a 5-minute refresh cadence (triggered by traffic), that's ~59 blocks = 1 chunk. Even with 1 hour of no traffic, that's ~708 blocks = 1 chunk. Safe within Vercel's 10s timeout.

Worst case after extended downtime (24h no traffic): ~17K blocks = 1 chunk. Still fine.

Worst case after 7 days no traffic: ~119K blocks = 3 chunks = ~3s. Still fine.

The only scenario where incremental scan is slow is the initial backfill (1.25M+ blocks). That's why backfill is a CLI script.

## 6. Replay / Reorg Safety

**Celo has instant finality** (BFT consensus). True reorgs don't happen. However:

1. **Stale RPC responses:** A load-balanced RPC might return a block number slightly behind another node. Replaying the last 10 blocks catches this.
2. **Idempotent writes:** `ZADD` with identical member+score is a no-op. Replaying events does not create duplicates.
3. **Score stability:** The score formula uses on-chain data (blockNumber, logIndex), which is deterministic. Replaying the same log produces the same score.

`REORG_BUFFER = 10` blocks = ~10 seconds of chain time. Cost: one extra chunk that overlaps with previously scanned range. Negligible.

## 7. Refresh Locking

```
SET hof:refresh:lock <timestamp> NX EX 30
```

- `NX`: only set if not exists (mutex semantics).
- `EX 30`: auto-expires after 30 seconds (crash safety).
- If a function acquires the lock and crashes, the lock expires and the next request retries.
- If a function is actively refreshing, concurrent requests skip refresh and serve stale data.
- No distributed lock library needed; Redis `SET NX EX` is sufficient.

### Why 30s TTL?

Steady-state refresh scans <1 chunk (~0.5s). Even 3 chunks (week-long gap) take ~3s. 30s provides generous headroom without blocking other requests for too long.

## 8. API Behavior Contract

### GET /api/hall-of-fame

```
1. Attempt refresh (non-blocking if locked).
2. ZREVRANGE hof:entries 0 9 → top 10, newest first.
3. Return JSON array of HallOfFameRow.
4. Headers:
   - Cache-Control: s-maxage=30, stale-while-revalidate=120
   - X-HoF-Stale: true|false (whether refresh was skipped/failed)
   - X-HoF-Indexed-Through: <blockNumber>
```

### GET /api/my-victories?player={address}

```
1. Validate address (isAddress check).
2. Attempt refresh (same lock — global refresh indexes all players).
3. ZREVRANGE hof:player:{address.toLowerCase()} 0 -1 → all, newest first.
4. Return JSON array of MyVictoryRow.
5. Headers: same as above.
```

### Failure Modes

| Scenario | Behavior |
|----------|----------|
| Redis has data, refresh succeeds | Return fresh data, `stale: false` |
| Redis has data, refresh fails (RPC down) | Return existing data, `stale: true`, log warning |
| Redis has data, refresh locked (concurrent) | Return existing data, `stale: true` |
| Redis empty, refresh succeeds | Return fresh data (backfill must have run) |
| Redis empty, refresh fails | Return `[]` with 200, `stale: true`. Not a 500 — no data is not an error, it's "no victories yet" |
| Redis unavailable | Return `[]` with 200, log error. Graceful degradation. |
| VICTORY_NFT not configured | Return `[]` with 200 (existing behavior, unchanged) |

**Key principle:** The API never returns 500 for read operations. Empty array is a valid response. Errors are logged server-side, not exposed to the user.

## 9. Backfill CLI Design

A standalone script that runs the initial historical scan outside Vercel.

### Requirements

- **Resumable:** Reads `hof:lastBlock` from Redis. Starts from there.
- **Idempotent:** Can be run multiple times safely. ZADD deduplicates.
- **Chunked with progress:** Logs progress every chunk.
- **Not an API route:** Runs via `npx tsx scripts/backfill-hof.ts` or `pnpm backfill:hof`.

### Pseudocode

```
async function backfill():
  redis = Redis.fromEnv()
  client = createPublicClient(celo, http(RPC_URL))

  lastBlock = await redis.get("hof:lastBlock") ?? EVENT_SCAN_START
  latest = await client.getBlockNumber()

  console.log(`Backfill: ${lastBlock} → ${latest} (${latest - lastBlock} blocks)`)

  for from = lastBlock to latest step CHUNK_SIZE:
    to = min(from + CHUNK_SIZE - 1, latest)
    logs = await client.getLogs(...)
    timestamps = await resolveTimestamps(...)
    rows = logsToEntries(logs, timestamps)

    if rows.length > 0:
      pipeline = redis.pipeline()
      for row in rows:
        score = blockNumber * 100000 + logIndex
        member = canonicalJSON(row)
        pipeline.zadd("hof:entries", { score, member })
        pipeline.zadd(`hof:player:${row.player.toLowerCase()}`, { score, member })
      await pipeline.exec()

    await redis.set("hof:lastBlock", to.toString())
    console.log(`Chunk ${from}→${to}: ${rows.length} events (total indexed through ${to})`)

  console.log("Backfill complete.")
```

### Runtime Estimate

- 26 chunks x 10.5s = ~273s (~4.5 min) for full backfill.
- Acceptable for a one-time CLI operation.
- If interrupted, resume from `hof:lastBlock`.

## 10. Observability

### Structured Log Events

```typescript
type RefreshMetrics = {
  event: "hof:refresh";
  blocksScanned: number;      // latestBlock - scanFrom
  newEventsFound: number;      // logs.length
  redisWriteCount: number;     // ZADD commands in pipeline
  indexedThroughBlock: number;  // new lastBlock value
  scanDurationMs: number;      // wall clock time
  staleServed: boolean;        // true if refresh was skipped
  refreshFailed: boolean;      // true if RPC or Redis error
  lockAcquired: boolean;       // false if another request held lock
  error?: string;              // error message if failed
};
```

### Log Examples

```
[hof:refresh] blocksScanned=59 newEvents=0 duration=480ms indexed=62501414 stale=false
[hof:refresh] lockAcquired=false stale=true indexed=62501355
[hof:refresh] FAILED error="RPC timeout" stale=true indexed=62501355
[hof:backfill] chunk 61250000→61299999: 0 events (4/26)
[hof:backfill] chunk 61300000→61349999: 2 events (5/26)
```

### Alerts (future, not blocking)

- `refreshFailed` 3 consecutive times → investigate RPC health.
- `indexedThroughBlock` not advancing for >1 hour during active traffic → stale index.

## 11. Tradeoffs and Non-Goals

### Tradeoffs Accepted

| Decision | Tradeoff |
|----------|---------|
| Redis sorted sets, not Postgres | Simpler infra, no migrations, but less queryable. Acceptable for "top 10" and "my victories" use cases. |
| Single global refresh lock | Under high concurrency, most requests serve stale data. Acceptable: staleness is 30s max (lock TTL). |
| No real-time indexing at mint | New mints appear on next refresh (~30s delay). Acceptable for a hall of fame. |
| Canonicalized JSON as sorted set member | Larger memory footprint than hash references. Acceptable: <100 entries expected in near term. |
| REORG_BUFFER = 10 on a non-reorging chain | Slightly wasteful (re-scans 10 blocks). Cost: negligible. Benefit: resilience against stale RPC responses. |

### Non-Goals

- **Real-time event streaming** (WebSocket/SSE). Not needed for hall of fame.
- **Full event history beyond sorted sets.** We store what we need for current views (top 10 global, all per player). No analytics pipeline.
- **Postgres / Supabase migration.** Upstash Redis is sufficient. Introducing a relational DB adds operational complexity with no proportional benefit for this use case.
- **Automatic backfill in API route.** The backfill is a one-time CLI operation. If Redis is wiped, re-run the script manually.
- **Cache invalidation from mint flow.** The incremental scan catches new mints within ~30s. No write-through needed.

---

# Implementation Plan

## Phase 0 — Shared Utilities (Day 1, ~1h)

### 0.1 Add Redis keys for HoF index

**File:** `apps/web/src/lib/coach/redis-keys.ts` (rename to `lib/redis-keys.ts` since it's no longer coach-only)

Add:
```typescript
export const HOF_KEYS = {
  lastBlock: "hof:lastBlock",
  entries: "hof:entries",
  player: (address: string) => `hof:player:${address.toLowerCase()}`,
  refreshLock: "hof:refresh:lock",
} as const;
```

### 0.2 Canonical JSON helper

**File:** `apps/web/src/lib/server/hof-index.ts` (new)

```typescript
function canonicalJSON(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}
```

### 0.3 HoF row type

**File:** Same `hof-index.ts`

```typescript
export type IndexedVictoryRow = {
  id: string;           // txHash:logIndex
  tokenId: string;
  player: string;
  difficulty: number;
  totalMoves: number;
  timeMs: number;
  timestamp: number;
};
```

## Phase 1 — Incremental Refresh Engine (Day 1, ~2h)

### 1.1 Implement `refreshHofIndex()`

**File:** `apps/web/src/lib/server/hof-index.ts`

Core function implementing the algorithm from Section 5. Responsibilities:
- Acquire lock (`SET NX EX 30`)
- Read `lastBlock`
- Scan delta from RPC
- Resolve timestamps
- Pipeline ZADD to sorted sets
- Update `lastBlock`
- Release lock
- Return `RefreshMetrics`

### 1.2 Implement `readHofEntries()` and `readPlayerVictories()`

**File:** Same `hof-index.ts`

Pure Redis reads:
- `ZREVRANGE hof:entries 0 9` with score parsing
- `ZREVRANGE hof:player:{addr} 0 -1`
- Parse JSON members back to `IndexedVictoryRow`

### 1.3 Constants

```typescript
const REORG_BUFFER = 10n;
const REFRESH_LOCK_TTL = 30;   // seconds
const CHUNK_SIZE = 50_000n;
const SCORE_MULTIPLIER = 100_000n;
```

## Phase 2 — Update API Routes (Day 1, ~1h)

### 2.1 Rewrite `/api/hall-of-fame/route.ts`

Replace full RPC scan with:
```
1. refreshHofIndex() — fire-and-forget if locked
2. readHofEntries() — always returns data (or [])
3. Set response headers (Cache-Control, X-HoF-Stale, X-HoF-Indexed-Through)
```

### 2.2 Rewrite `/api/my-victories/route.ts`

Same pattern:
```
1. Validate player address
2. refreshHofIndex() — same global refresh indexes all players
3. readPlayerVictories(player)
4. Response headers
```

### 2.3 Remove duplicate code

Both routes currently duplicate the scan logic. After this change, both delegate to `hof-index.ts`. The shared `victory-events.ts` utilities (`getLogsPaginated`, `resolveTimestamps`, `logsToEntries`) are reused by the refresh engine.

## Phase 3 — Backfill CLI Script (Day 2, ~1h)

### 3.1 Create backfill script

**File:** `apps/web/scripts/backfill-hof.ts`

- Reads `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from env
- Reads `CELO_RPC_URL` from env (defaults to forno)
- Resumable: reads `hof:lastBlock` to determine start
- Chunked: processes 50K blocks per iteration
- Logs progress per chunk
- Updates `hof:lastBlock` after each successful chunk commit

### 3.2 Add npm script

**File:** `apps/web/package.json`

```json
"backfill:hof": "tsx scripts/backfill-hof.ts"
```

### 3.3 Run backfill

```bash
cd apps/web && pnpm backfill:hof
```

Expected: ~4.5 min for full historical scan. One-time operation.

## Phase 4 — Cleanup & Verification (Day 2, ~1h)

### 4.1 Remove dead code

- Delete the full-scan logic from `victory-events.ts` (`fetchHallOfFame`, `fetchMyVictories`) if no other consumers remain.
- Keep `getLogsPaginated`, `resolveTimestamps`, `logsToEntries` as shared utilities (used by both backfill and refresh).

### 4.2 Add error boundary for trophies

**File:** `apps/web/src/app/trophies/error.tsx` (new)

Granular error boundary so trophies failures don't show "Board crashed."

### 4.3 Update Playwright tests

Update `e2e/ux-review.spec.ts`:
- Increase timeout for trophies to 30s (should now load in <2s but give margin)
- Verify trophies page renders data or empty state, not crash

## Test Plan

### Unit Tests

| Test | Assertion |
|------|-----------|
| `canonicalJSON` produces stable output | Same object in different key order = same string |
| `refreshHofIndex` with empty Redis | Sets lastBlock, returns metrics |
| `refreshHofIndex` with existing lastBlock | Scans only delta |
| `refreshHofIndex` with lock held | Skips refresh, returns `lockAcquired: false` |
| `readHofEntries` with empty sorted set | Returns `[]` |
| `readHofEntries` with data | Returns parsed rows in newest-first order |
| Score formula | `blockNumber * 100000 + logIndex` produces correct ordering |

### Integration Tests (manual)

| Test | Steps |
|------|-------|
| Backfill from scratch | Clear Redis, run backfill, verify `hof:entries` has expected count |
| Incremental after backfill | Mint a new victory, wait, hit API, verify new entry appears |
| Concurrent requests | Hit `/api/hall-of-fame` 10x simultaneously, verify no duplicates, only 1 acquires lock |
| RPC failure | Set bad `CELO_RPC_URL`, hit API, verify returns stale data (not 500) |
| Redis failure | Remove `UPSTASH_REDIS_REST_URL`, hit API, verify returns `[]` (not crash) |

### Playwright (e2e)

| Test | Assertion |
|------|-----------|
| `/trophies` loads within 5s | No timeout |
| `/trophies` shows data or empty state | No "Board crashed" |
| Idle stability 30s on `/trophies` | No crash |

## Rollout Plan

1. **Deploy backfill script** (no user impact)
2. **Run backfill** against production Redis (`pnpm backfill:hof`)
3. **Verify** Redis has data: `ZCARD hof:entries`, `GET hof:lastBlock`
4. **Deploy API route changes** (swap full-scan for incremental)
5. **Smoke test** `/trophies` in browser and MiniPay
6. **Monitor** logs for `hof:refresh` events over 24h
7. **Remove** dead full-scan code after 48h confidence period

## Operational Checklist

- [ ] `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` set in Vercel env
- [ ] `CELO_RPC_URL` set in Vercel env (or fallback to forno)
- [ ] `NEXT_PUBLIC_VICTORY_NFT_ADDRESS` set (existing)
- [ ] Backfill script run successfully (check `GET hof:lastBlock` in Upstash console)
- [ ] `/api/hall-of-fame` returns data within 2s
- [ ] `/api/my-victories?player=0x...` returns data within 2s
- [ ] `/trophies` page loads in MiniPay without crash
- [ ] Playwright e2e tests pass

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Upstash free tier limits (10K commands/day) | Medium | Sorted set operations count as commands. High traffic could hit limit. | Monitor usage. Upgrade to pay-as-you-go if needed (~$0.20/100K commands). |
| forno.celo.org rate limiting | Low | Incremental scans are 1 chunk. Full backfill is 26 chunks over 4.5 min. | Backfill runs once. Incremental is gentle. If rate limited, refresh fails gracefully and retries next request. |
| Redis data loss (Upstash eviction) | Very Low | Hall of fame goes empty until next refresh + backfill. | Self-healing: `lastBlock` resets, incremental scan rebuilds. For full loss, re-run backfill script. |
| JSON serialization drift | Very Low | If `canonicalJSON` output changes between deploys, dedup breaks (duplicate members). | Pin key order in type definition. Add unit test for stability. |
| Backfill interrupted | Low | Partial index. | Resumable: re-run script, continues from `lastBlock`. |
