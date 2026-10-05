# Public statistics after Phase 1 Disk I/O containment

> Archived evidence: this report describes its dated observation/source snapshot, not current production state or authorization to execute its recommendations. As of this curation, the operator reports www on Cloudflare and Play/Learn stable; main contains adaptive and bounded cron fixes. Source paths, inventories, platform limits, access failures and deployment assumptions below may have changed. See [the curation review](2026-10-05-infrastructure-worktree-curation.md).


Date: 2026-09-30
Scope: read-only repository and existing-evidence investigation. No production query, refresh, deployment, or infrastructure change was made. The existing uncommitted retention files were preserved.

## Executive findings

- The public `/stats` route reads one durable Redis snapshot, `stats:public:all-all:v1`. It does not call Supabase. The authenticated refresh endpoint is the only production RPC path.
- The refresh currently enables five RPCs: activation funnel, access funnel, retention, account lifecycle, and activity trend. It deliberately omits `stats_install_counts`, `stats_top_countries`, and `stats_habit_depth`.
- The most recent saved production evidence is from 2026-09-29. Redis had the snapshot key, no expiry, and a 4,283-byte value. The last successful refresh was recorded at 2026-09-28 13:48:51 UTC; later scheduled refreshes received 503. At the health capture the snapshot was about 12 hours old. There is no evidence in the workspace that establishes its status on 2026-09-30.
- `active people (7d)` is the `active7d` count returned by the enabled account lifecycle RPC. A displayed zero is a real measurement if that RPC succeeded; it is an em dash only when the RPC is unavailable. The latest saved evidence does not contain the current field payload, so the current zero cannot be independently confirmed from this workspace.
- D7 retention is also computed by an enabled RPC. The renderer produces a percentage only when `cohort > 0`; a zero cohort displays “Not enough history yet.” If the snapshot literally shows 0.0%, the RPC returned a non-empty cohort and zero returning installs; that is not the missing-RPC state. No current payload is available here to distinguish the exact numerator and denominator.
- Safest near-term restoration candidates are the disabled all/all statistics only after an isolated read-only measurement confirms that their all/all plans do not spill and fit operational limits. The historical filtered spills were addressed in the SQL migration by function-scoped `work_mem=8MB` for countries and habit depth, but the Phase 1 exclusion remains in place and is not changed here.

## A. Confirmed causes

### Architecture and publication

1. `/stats` in `apps/landing/src/app/stats/page.tsx` uses `getStatsRedis()` and `readPersistedStatsSnapshot()` to read the single Redis key. Missing Redis, missing data, or invalid data renders the explicit snapshot-unavailable state; the public request has no Supabase fallback.
2. The refresh route checks the bearer secret before Redis/database work, obtains a distributed NX lease, builds the candidate off-key, and publishes only a complete candidate. A failed or partial refresh leaves the prior snapshot intact. This is stale-while-preserving behavior: the page can continue serving an old snapshot indefinitely because the snapshot itself has no TTL.
3. Snapshot publication is an atomic Redis Lua operation conditioned on still owning the lease. A 120-second lock and a separate cooldown protect against concurrent/manual refreshes and repeat work. Current code sets cooldown to 900 seconds.
4. Snapshot structure is version 1: `stats`, `breakdown`, `census`, `availability`, `version`, and `refreshedAt`. `stats.generatedAt` is the aggregation timestamp; `refreshedAt` is the publication timestamp. Availability is tracked independently for on-chain data, census, breakdown, and each of the eight RPCs. During containment, excluded RPCs are represented as temporarily unavailable, while their fields remain structurally present.
5. Public metric rendering distinguishes `null` from zero. Stat cards render null as an em dash and a numeric zero as `0`. Retention also treats a zero-sized cohort specially and renders “Not enough history yet.”

### RPC enablement

| RPC | Current refresh status | Reason/state |
|---|---|---|
| `stats_install_counts` | Disabled | Expensive full 30-day event aggregation; unavailable in snapshot. |
| `stats_activation_funnel` | Enabled | Emergency allow-list. |
| `stats_access_funnel` | Enabled | Emergency allow-list. |
| `stats_top_countries` | Disabled | Historical filtered group/sort spills. |
| `stats_retention` | Enabled | Emergency allow-list. |
| `stats_account_lifecycle` | Enabled | Emergency allow-list. |
| `stats_habit_depth` | Disabled | Historical distinct-day aggregation spill for filtered Play. |
| `stats_activity_trend` | Enabled | Emergency allow-list. |

The migration grants execution only to `service_role`; the refresh uses that server-side Supabase client. Public browsing itself does not invoke these functions.

### Schedule discrepancy resolved from current files

The checked-in workflow `.github/workflows/cron-stats-snapshot-refresh.yml` is `17 */6 * * *` (four scheduled attempts/day), while `persisted-snapshot.ts` sets a 15-minute cooldown. The 2026-09-16 Phase 1 document says the schedule/cooldown were aligned to 15 minutes, but the current workflow and the 2026-09-15 handoff say every six hours. Therefore the current repository state is six-hourly; the older Phase 1 description is stale or records a change that was later reverted. The cooldown still permits at most one successful refresh every 15 minutes. No workflow run or manual refresh was initiated for this investigation.

## B. Suspicious metrics and interpretation

### Active people = 0

`stats_account_lifecycle` returns `active_7d` by joining known accounts to their most recent event within the last 30 days and counting accounts whose last event is inside the exact rolling seven-day window. Its contract includes `active_7d + dormant + inactive = known`; `resurrected_7d` is a subset of active and must not be added. The UI uses `accountLifecycle.active7d` directly.

Consequences:

- If the RPC status is `available`, `active7d: 0` means the source query returned zero active accounts. It is not a fallback value.
- If the RPC failed, `active7d` is null and the page displays an em dash; the integrity callout names `stats_account_lifecycle`.
- If all accounts have no qualifying event, zero can be a genuine inactivity measurement even when sessions/events exist without `account_ref`. Account lifecycle measures connected-account pseudonyms, not anonymous installs.
- A mismatch between this measure and install/session activity can therefore be semantic (different identity denominator), not necessarily a calculation bug.

The saved September 29 diagnostic did not include the Redis payload values. It reported a successful earlier page response and a stale snapshot timestamp, but did not capture `active7d`, `known`, or the RPC availability bit. Thus the zero itself and the identity partition cannot be confirmed or disproved from present evidence.

### Retention D7 = 0%

The enabled `stats_retention` returns `returned` and `cohort`, not a percentage. D7 selects installs whose first-seen UTC date is 7–14 days old and tests activity on the exact UTC day seven days after birth. The UI divides only when `cohort > 0`; when cohort is zero it shows “Not enough history yet.”

- A literal 0.0% proves only that the stored bucket had a positive cohort and `returned = 0`; it may be a true exact-day measurement.
- A zero cohort is not a zero-percent result in the current component.
- Missing/failed RPC data is separately marked unavailable and rendered with the unavailable callout, not as 0%.
- Calendar-day exact D7 is naturally sparse and stricter than “returned at any point during days 7–14.” Whether this is product-intended is a metric-definition question, not an execution failure.

The function builds `act` from only the preceding 30 days. That is sufficient for D7 and the declared 15–21-day week-three window, but first-seen rows are retained independently of pruned events. A future change to retention windows must revisit the event-history bound and retention policy together.

### Other low engagement values

Activation and access funnel counts are derived from event names and nested prefixes. The activation query was measured on September 29 at 4.752 s, 1.707 s, and 0.201 s; access funnel at about 0.19 s. Retention was 1.606 s, then about 0.18–0.20 s. Those readings show variability but no timeout in those three passes. They do not prove current freshness or semantic completeness.

Existing analytics evidence records a period with `NEXT_PUBLIC_TELEMETRY_ENABLED=0` in the public client bundle, zero recent telemetry endpoint invocations in a limited Vercel sample, and no new analytics events in short DB windows on September 29. This can explain low/zero frontend-event engagement, but it does not establish the current state: server-side duel event writers and direct POSTs can still write analytics rows. Account activity additionally requires `account_ref`, so anonymous activity does not count as a person.

## C. Current snapshot health (latest available evidence)

There was no live read in this investigation. Latest saved evidence:

| Signal | Saved observation | Assessment |
|---|---|---|
| Redis snapshot key | Exists; 4,283 bytes; TTL `-1` | Present and durable at the read time. |
| Snapshot refresh time | `2026-09-28 13:48:51 UTC` | Confirmed last successful publication in the Sep 29 health report. |
| Subsequent scheduled refreshes | Two HTTP 503 outcomes | Refresh reliability degraded. Cause was not established. |
| Age at health capture | About 12 hours | Stale relative to a six-hour schedule. |
| Redis connectivity | PING and key metadata reads succeeded during diagnostics | No Redis failure reproduced; historical cause remains unknown. |
| Supabase latency | `select now()` was 5.889 s in health snapshot; later read-only sample was 67–73 ms | Severe transient latency was observed, not reproduced in the later diagnostic. |
| Five enabled RPCs | All succeeded in three sequential read-only passes, `statement_timeout=8s` | No timeout reproduced; activation was marginal at 4.752 s once. |
| Current Sep 30 age / key / timestamp | Not observed | Unknown. Durable key can remain stale indefinitely if refreshes fail. |

The September 29 root-cause diagnostic says the exact failing component is unknown: no endpoint error body/log row was available for the original 503. Redis was accessible in the later read-only check, but that cannot exclude a transient Redis or database/app error during the failed runs.

## D. Disabled RPC implementation and historical cost

The production SQL implementation lives in `apps/web/supabase/migrations/20260805000000_stats_aggregation_rpcs.sql`. Historical measurements below come from the 2026-08-05 Phase A review and September containment record; they are not a current production benchmark.

| RPC | Implementation / principal I/O | Historical measurement | Bounded/incremental suitability |
|---|---|---|---|
| `stats_install_counts` | One scan of `analytics_events` over rolling 30 days; computes distinct sessions for 7d/30d and app-open rows/sessions. Optional surface/container predicates. Dominant cost is reading the entire eligible event window and distinct aggregation; no historical temp spill was recorded for the all/all case. | Phase A `EXPLAIN ANALYZE`: all/all about 137–139 ms warm, 152,304 shared buffer hits, zero disk reads; Learn 174 ms, Play 126 ms, MiniPay 142 ms. These are pre-Phase-1 measurements and reflect the then-current table/load. | Bounded window is already present. Further row limiting would make exact distinct counts wrong. Incremental daily summaries are appropriate if current window scans remain costly; keep 7d/30d rolling boundaries exact by retaining daily distinct identity or a mergeable sketch, not summing per-day distinct counts. |
| `stats_top_countries` | 30-day window, filters, `GROUP BY country`, `COUNT(DISTINCT session_id)`, rank top eight. Temp sort can occur when a dimension filter changes the index path; country grouping/ranking causes sort work. | At default 3.5MB `work_mem`: Play external merge 2,232 kB / 167–172 ms; MiniPay external merge 3,264–3,280 kB / 263–276 ms. All/all had no sort spill; warm plan about 357 ms. Function-scoped 8MB changed filtered sorts to memory: 6,050kB Play, 7,422kB MiniPay, with similar latency. | Bounded 30d window already exists, but cap/limit before grouping would bias top countries. Incremental country/day/session summaries can preserve exact windows with careful distinct identity. A compact daily country aggregate is insufficient if one session can produce events on multiple days and the request asks distinct installs over a rolling 30-day window. |
| `stats_habit_depth` | Groups 30-day events by install and counts distinct UTC active dates, then computes cumulative 1/3/7/14/21-day bands and median. Main costs are input scan, per-install grouping, distinct-day sort, and percentile. | At 3.5MB `work_mem`, surface=Play external merge 3,432–3,456 kB / 125–131 ms. All/all warm about 140 ms without spill. At scoped 8MB the Play sort used 6,642kB in memory / 133 ms. | Bounded 30d window already exists. Avoid truncating raw rows, which biases active days and median. Incremental per-install/day presence can make the 30-day rollup much smaller and exact; then maintain active-day counts or derive from bounded daily presence. |

The existing Phase A review reported 32 plans across RPC/filter cases, no sequential scans of `analytics_events`, no disk reads, and maximum warm execution of 357 ms after the two function-local `work_mem` settings. The spill records above are the earlier baseline before that mitigation. Phase 1 nevertheless keeps all three omitted because their known workload was judged too risky to reactivate without isolated measurement under current state.

## E. Optimization options

| Option | Correctness / Disk I/O | Complexity and cost | Assessment |
|---|---|---|---|
| Existing full-history/window RPCs | Exact for declared windows. Reads every matching event row and performs distinct/grouping each refresh. All three already have time bounds; `install_counts` and `habit_depth` use 30 days; countries uses 30 days. | Lowest migration complexity; recurring DB read/CPU and possible temp I/O. | Keep as baseline and benchmark only in controlled read-only isolation. Do not restore by removing the emergency gate. |
| Arbitrary bounded row query / LIMIT | Low I/O but not exact: newest-prefix bias can reorder countries, undercount distinct installs, active days, retention, and denominators. | Easy, but invalid public metrics. | Reject for published exact counts. A bounded-time predicate is appropriate; a row cap is not. |
| Incremental daily/session summaries | Lower refresh I/O; exactness possible if storing the sufficient grain, e.g. one row per install/day and dimensions, not only daily totals. Rolling windows can combine bounded day rows. | Medium/high schema, writer, backfill, idempotency, late-arrival, and correction complexity. Must preserve existing raw data and be independently deployable. | Best target for habit depth and potentially country counts. For retention, retain cohort first-seen and daily activity summaries for the full maturity window. |
| Precomputed summary tables/materialized views | Fast reads if refreshed safely; daily aggregates alone lose unique-install union semantics. `REFRESH MATERIALIZED VIEW` can itself rescan and spike I/O. | Medium/high. Scheduled refresh/write amplification, storage, locks/concurrency, freshness and rollback concerns. | Prefer incrementally maintained summary tables over full refresh MVs for high-volume raw events. MV is viable only if refresh cost is measured and bounded. |
| Redis-only cached snapshot | Already removes public request load and provides one coherent publication unit; does not reduce the DB cost of a successful rebuild. | Very low incremental cost; stale snapshot risk without alerting. | Retain as publication layer, add freshness visibility/alert before changing DB aggregation. |

## F. Remediation sequence

1. **Observe without refreshing:** capture the existing key's `refreshedAt`, `stats.generatedAt`, and per-RPC availability through an authorized safe read path, plus workflow run statuses and sanitized 503 bodies. Do not trigger the endpoint. Compare the timestamp to the six-hour schedule and mark the snapshot stale if it exceeds the agreed freshness SLO.
2. **Clarify the measurements from the same payload:** record only aggregate values and availability for `active7d`, lifecycle partition (`known`, active/dormant/inactive), D7 returned/cohort, habit fields if present, and event/identity definitions. Never expose session IDs, account references, wallets, or secrets. This resolves true zero vs unavailable vs stale without recomputation.
3. **Improve failure observability independently:** ensure scheduled workflow results preserve the already-sanitized HTTP response body and request ID; log allow-listed failed RPC name, duration, outcome, and stable error code/SQLSTATE. Never log raw SQL, parameters, auth headers, or user identifiers. This is prerequisite to diagnosing future refresh failures, not a reason to raise limits.
4. **Safe restoration candidate: install counts.** First compare its current all/all plan and temp blocks using EXPLAIN without ANALYZE and existing statement telemetry; only run a controlled single RPC benchmark if operationally approved later. It had no historical temp spill and 30-day bounds, so it is the first candidate, but its full-window distinct scan must be tested against current table size/load. Restore independently behind an RPC allow-list and availability bit; rollback is a config/code change that disables this RPC without touching the stored snapshot schema.
5. **Restore countries and habit separately.** Their all/all paths historically did not spill after local 8MB settings, but filtered plans did. Verify the deployed function config and current plan before either reactivation. If only all/all is supported, keep filters unavailable and do not certify other filter combinations. Ship, observe, and roll back each RPC independently.
6. **Define summary grain before adding tables.** If current costs justify it, design install/day, country/install/day, and activity/install/day presence summaries with idempotent upserts, bounded backfill, late-event correction, and parity checks against existing raw-history results. Build shadow summaries while leaving raw events and the old snapshot untouched; compare outputs before a consumer switch.
7. **Keep Redis as the publication boundary.** Publish a new complete snapshot only after all required enabled reads pass. Preserve last-known snapshot on partial failure; expose snapshot age and per-metric availability clearly. Do not make the public page fall back to raw queries.
8. **Only later evaluate pruning-policy effects.** Existing retention work is uncommitted and deliberately outside this investigation. Coordinate any analytics retention or summary-table rollout so raw-history requirements for D7/week-three cohorts and backfills remain satisfied. Do not overwrite or stage those files as part of this report.

## G. Validation and production strategy

No tests or production validation were run for this read-only task. For implementation follow-up:

### Local / migration checks

- Unit-test snapshot schema compatibility, per-RPC availability, null-versus-zero rendering, and publication preservation on partial failure.
- SQL regression tests should assert exact bucket keys, nonnegative values, lifecycle partition equality, stable top-country ordering, and cumulative habit buckets.
- For summary tables, test duplicate event delivery, late-arriving events, UTC day edges, backfill idempotency, and parity to raw SQL over fixed fixtures. Retention cohorts need explicit tests for day 7 and days 15–21.
- Preserve rollback as an additive migration plus independent consumer switch; never drop raw events or the old aggregation path during the first rollout.

### Production read-only checks before any rollout

- Inspect current snapshot metadata and safe aggregate fields; do not invoke refresh.
- Use `pg_stat_statements` counter deltas over a fixed window for calls, elapsed time, shared blocks, and temp blocks. Use `EXPLAIN (COSTS TRUE)` only; no `EXPLAIN ANALYZE` or expensive counts in this investigation.
- Confirm `proconfig` for function-scoped `work_mem` and compare all/all plan estimates to historical plan shape. Estimates are not measured execution.
- For any future isolated benchmark, use one RPC at a time, explicit statement timeout, read-only transaction, no concurrent load test, and stop if latency or temp I/O crosses the agreed ceiling. Keep each disabled RPC disabled until its own approval gate passes.

### Rollout validation

- Deploy one metric at a time. Use an internal/canary snapshot first, inspect its availability and `refreshedAt`, and compare aggregate outputs with a bounded trusted reference window.
- Require zero unexpected temp writes, bounded execution time, no increase in public-request Supabase calls, and no change to unrelated snapshot metrics before promotion.
- Confirm one scheduled refresh completes and that the public route still reads Redis only. Monitor snapshot age, refresh success/failure reason, per-RPC latency and error codes, Supabase shared/temp block deltas, and Redis availability.
- Roll back by disabling the individual RPC or switching the consumer back to the prior summary version. Keep the last known-good snapshot and all raw data intact.

## Unverified hypotheses

- The historical 503s were caused by a slow Supabase/RPC call. This is plausible from the 5.889-second control query and activation variance, but the exact failure was not captured and later samples recovered.
- Current `active7d = 0` reflects genuine inactivity among known connected accounts. It could also reflect a stale snapshot or currently unavailable RPC; latest payload availability and counts are absent.
- Current D7 0% is a real exact-day return rate. The UI semantics make a positive cohort necessary, but current returned/cohort values were not preserved in the available report.
- Telemetry client-off status explains current low engagement. It limits client event collection, but server-side writers and direct requests remain possible, and no current matched-window event census was taken.
- The historical `work_mem=8MB` configurations remain live in production and fit current data. They were verified in the earlier Phase A review; current live function config was not read in this investigation.

## Source files and evidence

- `apps/landing/src/app/stats/page.tsx`
- `apps/landing/src/app/api/internal/stats/refresh/route.ts`
- `apps/landing/src/lib/stats/persisted-snapshot.ts`
- `apps/landing/src/lib/stats/aggregator.ts`
- `apps/landing/src/components/stats/primitives.tsx`
- `apps/landing/src/components/stats/stats-dashboard.tsx`
- `apps/web/supabase/migrations/20260805000000_stats_aggregation_rpcs.sql`
- `.github/workflows/cron-stats-snapshot-refresh.yml`
- `docs/audits/2026-09-15-stats-snapshot-containment.md`
- `docs/audits/2026-09-16-phase-1-disk-io-containment.md`
- `docs/audits/2026-09-15-supabase-disk-io-audit.md`
- `docs/audits/2026-09-29-operational-health-snapshot.md`
- `docs/audits/2026-09-29-stats-refresh-root-cause-diagnostic.md`
- `docs/handoffs/2026-08-05-stats-rpc-phase-a-review.md`
