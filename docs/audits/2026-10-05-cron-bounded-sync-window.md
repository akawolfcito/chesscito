# Play cron bounded sync window — 2026-10-05

Branch: `fix/cron-bounded-sync-window`, clean worktree `/private/tmp/chesscito-cron-bounded`, based on current main `18e1e650` containing the deployed adaptive pagination fix. Unrelated dirty ignore-file changes in the other checkout were excluded.

## Root cause and batch policy

The operator reports that range rejection is resolved, but `/api/cron/sync` now times out at the route's 60-second limit. Previously `runSync()` selected every block from the saved cursor through the current head. Adaptive RPC requests still had to consume the entire accumulated history, followed by event upserts and passport reconciliation, before committing any progress.

`MAX_BLOCKS_PER_SYNC = 2_000` is a documented code constant, with no new environment variable. Each invocation captures the chain head and selects:

```text
fromBlock = saved last_synced_block + 1, or unchanged DEFAULT_FROM_BLOCK (61_113_664)
toBlock = min(captured currentBlock, fromBlock + 2_000 - 1)
```

Two thousand blocks is 1/25 of the existing maximum RPC chunk. It conservatively reduces the history scanned per invocation and leaves space for sequential event writes and, on a head-reaching batch, passport. It is a starting policy, not a measured latency guarantee: dense events, small provider limits, slow RPC/DB or rate limits can still exhaust 60 seconds. The original 50,000 maximum remains in adaptive pagination; each batch starts with at most its actual 2,000-block interval and reduces further if the RPC rejects it. No historical blocks are skipped.

Both contract scans receive the exact same inclusive interval. A successful batch stores only its own `toBlock`, not the captured head. The next serial invocation resumes at that value plus one. No-new-block runs return without scans, passport or writes. The default, Shop deploy floor and sync state are not reset or fast-forwarded.

`maxDuration = 60` stays unchanged. A modest increase could provide secondary headroom for measured cold-start/network tail latency if the hosting plan supports it; it is not necessary to implement bounded progress and is not the primary fix. The 15-minute GitHub Actions schedule and authentication/destination configuration are unchanged.

## Database safety

The authoritative score/victory helpers retain normalized-player upserts with `onConflict: "tx_hash"`, full overwrite semantics and no preliminary existence reads. Only decoded events returned from the selected interval generate row writes. Empty event ranges still require one cursor commit to record completed scanning.

Found an existing failure-safety gap: Supabase commonly returns errors instead of throwing, and per-log processing catches previously logged and continued. Reconciliation-only helpers now throw fixed messages for missing database configuration or returned write errors; event processing failures propagate. The cursor reader throws on read errors rather than treating them as absent state. These helpers are used by sync only; optimistic client write helpers remain unchanged. Cursor reads explicitly bypass Next's fetch cache (`freshReads: true`) so consecutive invocations see the latest committed row rather than reprocessing a cached interval.

The single cursor upsert remains after both scans and any required passport step. Failure before that point leaves the cursor unchanged. This is not a database transaction over all event writes: a failed batch may already have written some rows, and retry will redo those idempotent upserts. No duplicate logical rows are introduced. Serial successful invocations have no range gaps or overlaps. Concurrent invocations are not given a new distributed lock by this change; avoid overlapping manual dispatches while verifying catch-up.

No full-table read was added. The existing leaderboard RPC/view returns top ten entries (`leaderboard_combined_v` has `LIMIT 10` in migration `20260611120000_leaderboard_onchain_flag_player_rank.sql`), although its underlying ranking view can aggregate the full score data. That existing aggregate runs only on the head-reaching path, not each historical batch.

## Passport policy and trade-off

Passport reflects the present leaderboard, not a historical block interval. Catch-up batches with `toBlock < captured currentBlock` skip it and return `passportChecked: 0`. Existing passport cache is retained rather than cleared. On reaching the captured head, the existing top-ten reconciliation runs after score/victory processing and before cursor commit. At most ten external score calls run concurrently, each with the existing five-second abort timer; results are written in one bulk passport-cache upsert.

The trade-off is temporarily stale passport badges during a long backlog. Intermediate historical ranking states no longer trigger repeated passport work. Fresh reconciliation occurs once caught up; if catch-up never reaches the head, passport remains deferred and operators must investigate progress/capacity. No-new-block runs continue to skip passport, preserving prior no-op semantics. Existing Passport API fail-to-false behavior and tolerant leaderboard read fallback are unchanged.

## Expected Supabase operations

Counts below describe application requests for a successful invocation with configured DB; S/V denote processed score/victory events and P the returned passport entries (at most ten). Database-internal view work is not a constant-time guarantee.

| Invocation | Reads | Writes |
| --- | --- | --- |
| Normal 15-minute run, new blocks fit in cap and head is reached | One keyed `sync_state` read; one existing leaderboard RPC (a second view request only on RPC fallback). | S score upserts + V victory upserts; one bulk passport-cache upsert for P rows if entries exist; one keyed cursor upsert. |
| Historical catch-up batch still below head | One keyed `sync_state` read; zero leaderboard/passport DB reads. | S + V idempotent event upserts and one keyed cursor upsert; zero passport writes. |
| No new blocks | One keyed `sync_state` read. | Zero. |

An incremental run larger than the cap uses the catch-up policy until a later invocation reaches head. Retrying a failed batch can repeat already-applied event upserts, but does not duplicate rows or advance past uncompleted work. No additional scheduler writes, progress counters, schema changes or full-table scans were introduced.

## Local validation

- Focused Vitest suite: **69 tests passed across six files**, covering batching, successive cursor resume, partial final batch, no-op, exact score/victory intervals, adaptive retries, failure gates, event-scoped writes and Supabase error/upsert/cache behavior; existing Supabase helper and cron authorization tests included.
- Focused TypeScript check: passed for sync, queries, new/updated tests and imported dependencies using a temporary config, not committed.
- Full-app `tsc --noEmit`: retains **54 pre-existing diagnostics**, zero new versus the prior recorded baseline (React type/`react-dom.preload` and other existing errors). This is not reported as a globally green app type-check.
- Scoped ESLint passed for both changed runtime modules and both test files.
- No real RPC/DB, workflow, secret, cursor, Cloudflare or DNS operation was performed; no deployment occurred.

## Production verification after a separately authorized release

1. Deploy the reviewed Play change through the established release process, without changing cron secrets, Shop variables, schedule or cursor.
2. Record the existing cursor and dispatch one workflow manually; do not overlap invocations or print auth material. Confirm HTTP 200 and duration comfortably below 60 seconds.
3. Confirm response starts at prior cursor + one (unchanged default only if genuinely absent) and scans at most 2,000 blocks. Both event counts should match actual events; stored cursor must equal response `toBlock`, even if the chain head remains far ahead. Historical batches should report `passportChecked: 0`.
4. Observe successive normal scheduled invocations: each starts at the prior successful end + one; a final partial batch ends at its captured head and reconciles passport. No-new-block runs do not write. Do not reset state or accelerate the schedule without measured need.
5. On failure/timeout, confirm no cursor advancement; partial event upserts may exist and will be idempotently retried. Inspect range/event density and RPC/DB duration before tuning the code constant or secondary headroom.
6. Measure chain-head growth versus completed blocks per interval and backlog reduction. A 2,000-block cap processes at most 8,000 blocks/hour at the unchanged cadence; this is a maximum, not a throughput guarantee. If arrivals exceed capacity or durations approach the limit, obtain measurements and review capacity/batch policy rather than skipping history.
