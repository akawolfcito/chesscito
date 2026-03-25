# Red Team Review — Hall of Fame Cache Strategy

**Date:** 2026-03-24
**Target:** 3 proposals for caching `/api/hall-of-fame` and `/api/my-victories`
**Current state:** Sequential RPC log scan, 26 chunks x 10.5s = ~273s per request

---

## Current System — Attack Surface

Before evaluating proposals, the current system is broken:

| Vector | Severity | Detail |
|--------|----------|--------|
| **DoS via normal use** | CRITICAL | Any user visiting `/trophies` triggers a 4.5-min RPC scan. Two concurrent users = 2 parallel scans. Serverless function timeout (Vercel default 10s, max 60s on hobby) will kill it before it finishes. |
| **Cascading crash** | HIGH | The timeout propagates to the frontend error boundary, showing "Board crashed" even though the board is fine — only trophies failed. |
| **Growing scan range** | HIGH | Celo produces ~17K blocks/day. Every day adds ~0.34 new chunks. In 6 months: 26 + 62 = 88 chunks = ~15 minutes per request. Never gets better, only worse. |
| **No abort signal** | MEDIUM | If user navigates away, the server-side scan continues burning resources until timeout. |
| **Duplicate code** | LOW | `hall-of-fame/route.ts` and `my-victories/route.ts` share identical scan logic (DRY violation). |

---

## Proposal A: Cache in Redis with TTL

**Concept:** Scan RPC, store result in Redis with `ex: 300` (5 min TTL). Next request reads from cache.

### Attack vectors

| # | Vector | Severity | Detail |
|---|--------|----------|--------|
| A1 | **Cold start = 4.5 min** | CRITICAL | First request after TTL expires still takes 4.5 minutes. On Vercel, this WILL timeout (10s default, 60s max). The cache never gets populated. **This proposal doesn't work on Vercel at all.** |
| A2 | **Thundering herd** | HIGH | Multiple users hit `/trophies` simultaneously after cache expires. All trigger full RPC scans in parallel. No mutex/lock. |
| A3 | **my-victories uncached** | HIGH | Per-player endpoint can't share the hall-of-fame cache. Each player triggers their own 4.5-min scan. N players = N scans. |
| A4 | **Cache key collision** | LOW | If VICTORY_NFT address changes (upgrade), stale cache serves wrong data. Need address in cache key. |
| A5 | **Upstash payload limit** | LOW | Upstash free tier: 1MB max value. 10 rows is tiny, but if the contract gets heavy usage (1000+ mints), the full scan result before slicing could be large in memory. |

### Verdict: FAILS — doesn't solve the core problem (4.5 min scan can't complete on Vercel)

---

## Proposal B: Index in Redis at Mint Time

**Concept:** When `/api/sign-victory` signs a mint, also write the event to Redis. Hall-of-fame reads from Redis, zero RPC.

### Attack vectors

| # | Vector | Severity | Detail |
|---|--------|----------|--------|
| B1 | **Signature != mint** | CRITICAL | `sign-victory` returns a signature. The user might never submit the tx, or it might fail on-chain. Writing to Redis at sign time = phantom entries that were never actually minted. |
| B2 | **Backfill required** | HIGH | Existing mints (before this change) are on-chain only. Need a one-time backfill script. If it fails or misses events, hall-of-fame is incomplete forever. |
| B3 | **Dual write inconsistency** | HIGH | If we write to Redis after confirmed mint (wait for tx receipt), the server needs to know the tx hash AND poll for confirmation. The current architecture is fire-and-forget: sign -> return -> client mints. Server has no callback. |
| B4 | **External mints invisible** | MEDIUM | If someone mints directly via the contract (not through our API), Redis never learns about it. Hall-of-fame becomes incomplete. |
| B5 | **Redis data loss** | MEDIUM | Upstash is durable but not a database. If keys are evicted (TTL misconfiguration, plan limits), data is permanently lost with no way to recover except re-scanning chain. |
| B6 | **Ordering** | LOW | Redis sorted sets could handle ordering, but plain key-value would need careful list management to maintain "newest first, top 10" semantics. |

### Verdict: DANGEROUS — the sign != mint gap (B1) makes this unreliable without a confirmation callback, which requires architectural changes

---

## Proposal C: Hybrid (Cache + Stale Fallback)

**Concept:** First hit scans RPC and caches in Redis (TTL 5 min). Subsequent hits read from cache. On RPC failure, serve stale cache.

### Attack vectors

| # | Vector | Severity | Detail |
|---|--------|----------|--------|
| C1 | **Same as A1: cold start** | CRITICAL | Inherits the 4.5-min scan problem. First request after TTL expires still times out on Vercel. Stale fallback only works if there WAS a previous successful cache — first-ever visit has no fallback. |
| C2 | **Same as A2: thundering herd** | HIGH | No mutex. Multiple concurrent requests all try to scan when cache is cold. |
| C3 | **Stale data can be very stale** | MEDIUM | If RPC keeps failing, the "stale fallback" could be hours or days old. No indication to the user that data is stale. |
| C4 | **Same as A3: my-victories** | HIGH | Per-player data still requires full scan per player. |

### Verdict: FAILS — inherits the fatal flaw from A (scan can't complete within serverless timeout)

---

## The Real Problem

All 3 proposals fail because they assume the RPC scan can complete at least once. It can't — **Vercel serverless functions timeout at 10-60s**, and the scan takes ~273s.

The fundamental issue is: **you're re-scanning the entire chain history on every cache miss**.

---

## Recommended Alternative: Proposal D — Event Indexer with Incremental Scan

**Concept:** Store the last scanned block number in Redis. Each request only scans NEW blocks since the last scan, appends new events to a Redis sorted set, and returns the top 10.

### How it works

1. Redis stores:
   - `hof:lastBlock` — last block number successfully scanned
   - `hof:entries` — sorted set (score = blockNumber, value = JSON row)
   - `hof:player:{address}` — sorted set per player

2. On request:
   - Read `hof:lastBlock` (default: `EVENT_SCAN_START`)
   - Scan ONLY from `lastBlock+1` to `latest` (incremental)
   - Append new events to sorted sets
   - Update `hof:lastBlock`
   - Return top 10 from `hof:entries`

3. First-ever run: one-time backfill via CLI script (not in API route)

### Why this works

| Vector from A/B/C | How D handles it |
|--------------------|------------------|
| A1/C1: 4.5-min cold start | Incremental: only scans new blocks. At 17K blocks/day and 5-min cache, that's ~59 blocks = 1 chunk = ~0.5s |
| A2/C2: Thundering herd | First request updates `lastBlock`. Concurrent requests see fresh `lastBlock`, scan 0 new blocks = instant |
| A3/C4: my-victories per-player | Per-player sorted set, same incremental pattern |
| B1: Sign != mint | Reads from chain (source of truth), not from sign endpoint |
| B4: External mints | Chain scan catches all mints regardless of source |
| B5: Redis data loss | If Redis is wiped, `lastBlock` resets to `EVENT_SCAN_START` and next request does full backfill (slow but self-healing). Can be mitigated with a manual backfill script. |
| Growing scan range | Incremental = always fast. Only the backfill is slow, and it runs once. |

### Attack vectors for D

| # | Vector | Severity | Mitigation |
|---|--------|----------|------------|
| D1 | **First-ever backfill** | MEDIUM | Run as CLI script, not in API route. One-time operation. |
| D2 | **Race condition on concurrent writes** | LOW | Two requests scan overlapping ranges and double-insert. Sorted set deduplicates by tokenId (use as member). |
| D3 | **Redis eviction** | LOW | Self-heals: falls back to full scan from `EVENT_SCAN_START`. Slow once, then fast again. |
| D4 | **Reorg** | VERY LOW | Celo has instant finality. Not a concern. |

---

## Summary

| Proposal | Core Flaw | Verdict |
|----------|-----------|---------|
| **A: Cache TTL** | Can't populate cache (4.5 min > Vercel timeout) | FAIL |
| **B: Index at mint** | Sign != mint gap, needs architectural changes | DANGEROUS |
| **C: Hybrid** | Inherits A's fatal flaw | FAIL |
| **D: Incremental scan** | Backfill is one-time; steady state is ~0.5s | RECOMMENDED |

**Recommendation: Proposal D** with a one-time backfill script. Steady-state latency drops from 273s to <1s. Uses existing Upstash Redis. No architectural changes to the mint flow.
