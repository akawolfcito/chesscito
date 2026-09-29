# `analytics_events` after the first pruning families — 2026-09-28

**Mode:** audit; no operation on persistent application rows was intended.\
**Fixed cutoff:** `2026-08-11T14:12:14.822368Z`\
**Target:** `public.analytics_events` in database `postgres`.

## Executive summary

- Physical size is unchanged from the pre-pruning reference: 274,874,368 bytes total, 128,532,480 heap, 146,276,352 indexes. DELETE has not shrunk the files.
- Current catalog/stat estimates are `reltuples=470,588`, `n_live_tup=458,323`, and `n_dead_tup=26,853`; the last ANALYZE was 2026-09-25 and no vacuum is recorded. Estimates are now stale relative to committed deletions.
- Read-only indexed counts confirm zero historical candidates for `dock_tap`, `dock_center_close`, `arena_mount`, and `arena_fresh_reset_fired`.
- The fixed-cutoff cleanup records support **12,265 confirmed deletions** across those four events. The older pre-ANALYZE 250-row experiment is not added because its committed event split is not captured in repository checkpoints.
- `arena_select_view` has 7,601 rows before the cutoff. EXPLAIN uses `idx_analytics_events_event` without a sequential scan; the exact count/min/max query took 3.328 s.
- No current emitter, RPC, stats code, test, or versioned dashboard consumes the raw event. Historical audits did use it for a cohort comparison; a daily count alone would not preserve that cohort analysis.
- Recommendation: **PRESERVE AGGREGATE FIRST**. No DELETE was executed or authorized by this audit.

## Execution note

The catalog, statistics, EXPLAIN, and event-count queries in the audit ran in a `BEGIN READ ONLY` transaction and ended with `ROLLBACK`. During startup, importing the reused temporary wrapper also ran its built-in wrapper smoke checks: they used a temporary table, included temporary DML and a COMMIT/ROLLBACK test, and reported `PERSISTENT_TABLES_MODIFIED=none`. They did not write to `analytics_events` or any persistent table, but this was a deviation from the instruction forbidding all INSERT/DELETE statements, even temporary-table tests. No additional DB commands were run after this was identified.

## A. Current table impact

### A1. Physical size

| Measure | Current bytes | Current pretty size | Prior reference bytes | Change |
|---|---:|---:|---:|---:|
| Total relation | 274,874,368 | 262 MB | 274,874,368 | 0 |
| Heap | 128,532,480 | 123 MB | 128,532,480 | 0 |
| All indexes | 146,276,352 | 140 MB | 146,276,352 | 0 |

Individual index sizes:

| Index | Bytes | Approx. MiB |
|---|---:|---:|
| `analytics_events_pkey` | 19,316,736 | 18.42 |
| `idx_analytics_events_created_at` | 12,099,584 | 11.54 |
| `idx_analytics_events_event` | 38,903,808 | 37.10 |
| `idx_analytics_events_account_ref` | 18,489,344 | 17.63 |
| `idx_analytics_events_container` | 13,787,136 | 13.15 |
| `idx_analytics_events_country` | 13,647,872 | 13.02 |
| `idx_analytics_events_session` | 16,252,928 | 15.50 |
| `idx_analytics_events_surface` | 13,778,944 | 13.14 |
| **Total** | **146,276,352** | **139.50** |

The byte totals exactly match the prior reference. PostgreSQL DELETE marks tuples dead and makes their space reusable after cleanup; it does not ordinarily shrink the table or index files immediately. This audit did not run VACUUM or REINDEX.

### A2. Table statistics

| Statistic | Observed |
|---|---:|
| `pg_class.reltuples` | 470,588 |
| `pg_class.relpages` | 15,690 |
| `pg_stat_user_tables.n_live_tup` | 458,323 |
| `pg_stat_user_tables.n_dead_tup` | 26,853 |
| `last_vacuum` | null |
| `last_autovacuum` | null |
| `last_analyze` | 2026-09-25 13:24:02.694825 UTC |
| `last_autoanalyze` | null |
| `vacuum_count` | 0 |
| `autovacuum_count` | 0 |

The last ANALYZE predates these pruning commits. `reltuples` remains at the ANALYZE estimate while `n_live_tup` has moved downward; the difference is 12,265 rows (about 2.7% of `n_live_tup`). `n_dead_tup` is also an estimate, not an exact DELETE ledger. These values are useful for scale and trend, not exact accounting. No ANALYZE was run for this audit.

### A3. Remaining old rows

Each count was run separately with the event predicate and fixed cutoff; no global GROUP BY was used.

| Event | Rows before cutoff now |
|---|---:|
| `dock_tap` | 0 |
| `dock_center_close` | 0 |
| `arena_mount` | 0 |
| `arena_fresh_reset_fired` | 0 |

### A4. Confirmed deleted rows

| Event | Rows committed deleted |
|---|---:|
| `dock_tap` | 1,453 |
| `dock_center_close` | 207 |
| `arena_mount` | 5,368 |
| `arena_fresh_reset_fired` | 5,237 |
| **Total** | **12,265** |

The Arena starting counts and final per-batch confirmations are recorded in [the Arena entry consumer review](2026-09-26-arena-entry-telemetry-consumer-review.md), [the fresh-reset final-prune checkpoint](2026-09-28-arena-fresh-reset-final-prune.md), [the mount canary](2026-09-28-arena-mount-canary.md), and [the mount final-prune checkpoint](2026-09-28-arena-mount-final-prune.md). The dock counts are the exact confirmed cleanup amounts from the preceding checkpoint sequence; unlike the Arena runs, that sequence does not currently have one consolidated per-batch Markdown file in the repository.

An earlier experiment authorized a batch of up to 250 rows before the accurate ANALYZE baseline. That experiment is excluded from this sum: the repository does not contain a confirmed COMMIT record with an event-by-event row count, so it cannot safely be added or allocated. The 12,265 total is the confirmed fixed-cutoff pruning represented by the four rows above; it matches the observed difference between current live-tuple estimate and the pre-pruning ANALYZE estimate, but that statistical match is corroboration rather than independent proof.

## B. `arena_select_view`

### B1. Current volume and access path

EXPLAIN was run without ANALYZE before the count query:

```text
Limit  (cost=0.42..99.91 rows=100 width=24)
  -> Index Scan Backward using idx_analytics_events_event on analytics_events
     (cost=0.42..4416.58 rows=4439 width=24)
     Index Cond: (event = 'arena_select_view' AND created_at < cutoff)
```

No sequential scan appeared. The exact individual event count and timestamp bounds were then measured:

| Measure | Result |
|---|---|
| Rows before cutoff | 7,601 |
| First `created_at` | 2026-06-03 03:39:58.524287 UTC |
| Last `created_at` | 2026-08-11 14:11:22.632923 UTC |
| Count/min/max query duration | 3,327.583 ms |

This is about 1.66% of the current `n_live_tup` estimate. The count query stayed index-predicated, though 3.33 seconds is material enough to keep the individual-event method and avoid a global aggregate.

### B2. Emitter history and reason for removal

| Role | Evidence |
|---|---|
| Emitter introduced | Commit [`b3d13c40`](../../) dated 2026-05-04: `feat(arena): wire ArenaSelectScaffold flag-gated + 5 telemetry events`. It added `arena_select_view` on the scaffold selector mount, gated by the `?arena=new` selection path. The release handoff used it as the denominator for the scaffold-only `arena_select_view → arena_start_tap` conversion ratio. |
| Meaning | A render-driven selector/scaffold view, not an explicit start action. It had no event props. |
| Removal | Commit [`9ff0434f`](../../) dated 2026-08-18: removed the emit call from `apps/web/src/app/[locale]/arena/page.tsx`. |
| Reason | The 2026-08-18 review measured it identical to `arena_coach_signal_viewed` over the prior 24 hours (255 events, 68 sessions, same per-session distribution), found no props and no code reader, and called it redundant write-only telemetry. |
| Closest replacement | `arena_coach_signal_viewed` fires on the same selecting/scaffold transition and carries context such as surface, PRO state, wallet connection, and difficulty. It is guarded to first view for the selecting period. |

The events are near-equivalent, not proven identical for their full lifetimes: before this prune, the fixed-cutoff historical counts were 7,601 for `arena_select_view` and 7,384 for `arena_coach_signal_viewed`, a difference of 217. The identical 24-hour sample should not be generalized to the entire history.

### B3. Current consumers and stats dependency

Repository searches covered application source, SQL/migrations, tests, scripts, versioned docs, and versioned dashboards/notebooks:

- **Current emitter:** none. The only current source occurrence is a comment documenting the 2026-08-18 removal. The active replacement emitter is `track("arena_coach_signal_viewed", arenaCoachTelemetry())` in `apps/web/src/app/[locale]/arena/page.tsx`.
- **Current runtime/RPC consumer:** none found. No direct event reference exists in the current stats RPC definitions, admin Lite stats source, or product logic.
- **Test/query/script/dashboard consumer:** none found as an active query. References in tests/specs/docs are historical documentation, not a reader.
- **External dashboards:** not verifiable from this repository. No versioned dashboard definition/query was found, but unversioned third-party dashboards or saved queries remain outside this audit's visibility.
- **Stats RPCs:** no direct dependency found in `stats_activation_funnel`, `stats_access_funnel`, `stats_retention`, `stats_account_lifecycle`, `stats_activity_trend`, or `stats_daily_focus_funnel`. Their product windows are rolling 30 days; the fixed cutoff is more than 30 days old as of this audit.

Historical documents did consume the event. In particular, [the September 2 retention analysis](2026-09-02-where-they-quit-and-why-they-return.md) compared selector exposure on day one for accounts that returned versus those that did not. That is a completed analysis, not a live consumer, but it proves the event has had product-analysis value. The existing report preserves its headline percentages, not the underlying cohort data needed to recompute them.

### B4. What pruning the raw rows would lose

Deleting only `arena_select_view` rows before the cutoff would remove their exact event timestamps and session-level link to other events. The event has no props, so it does not contain selector settings or other event-specific payload dimensions. The remaining data would not support re-running the exact historical row-level sequence/cohort analysis.

Nearby events answer different questions:

| Event | What it measures | Why it is not a full substitute |
|---|---|---|
| `play_hub_arena_tap` | User intent to enter Arena from Play Hub | Does not establish that the selector rendered. |
| `arena_coach_signal_viewed` | First coach-signal view while Arena is selecting | Closest proxy; historical count is 217 lower across the full cutoff range. |
| `arena_start_tap` | Explicit start action from the selector | Omits viewers who did not start and includes a different point in the funnel. |
| `arena_game_start` | Game actually started | Measures state transition after selection, not exposure. |
| `arena_difficulty_tap` / `arena_color_tap` | Configuration interactions | Omits passive views and measures user choices. |

The specific historical retention table in the September 2 report would remain readable as a document, but its underlying `arena_select_view` cohort membership and timing could not be reconstructed from a daily event count alone.

### B5. Classification and aggregate recommendation

**Classification: SAFE AFTER SMALL AGGREGATE.** There is no live code consumer, but the event supported a historical retention comparison and is not exactly interchangeable with the closest remaining event over its full lifetime. The 2026-08-17 cost/free-tier audit independently classified it `AGGREGATE_IS_ENOUGH`.

If preserving the documented product insight before a future prune, a compact CSV can keep one row per UTC cohort day with these columns:

```text
cohort_date_utc
one_day_cohort_accounts
one_day_accounts_with_arena_select_view
one_day_selector_view_rate
returning_cohort_accounts
returning_accounts_with_arena_select_view
returning_selector_view_rate
```

These cohort-level counts/rates preserve the specific day-one selector/returning comparison without session IDs or raw payloads. They do not preserve arbitrary user-level sequences or support new unanticipated cohort questions. No aggregate was created in this audit.

## C. Alternatives already measured

| Candidate | Historical rows before cutoff | Current emitter | Consumer | Risk | Archive needed? |
|---|---:|---|---|---|---|
| `arena_select_view` | 7,601 | No; removed 2026-08-18 | No active reader found; historical retention analysis used it | Medium until its cohort result is preserved | Yes, preserve the cohort aggregate described above |
| `modal_open` | ≈8,416 | Yes; several modal components | No stats RPC consumer found; generic UI/product signal, external dashboards unverified | Medium; current, multi-surface event with props | Unknown; inspect external dashboards before pruning |
| `tx_progress_*` | ≈8,371 combined | Yes; `tx-progress-steps.tsx` emits view, step, duration, and completion signals | Operational transaction diagnostics and tests/docs; no direct stats RPC dependency found | Medium-high because it is current operational telemetry | Yes before replacing raw diagnostics with another metric/log path |
| Coach granular (`coach_viewer_move_jump`, `coach_viewer_replay_scrub`) | ≈835 combined | Yes; `coach-game-client.tsx` | Core-loop diagnostic identifies them as the only signal for viewer move/replay navigation | High value per row, low volume | Keep raw for now; no pruning priority |

The supplied historical counts come from the earlier event-by-event audit; they are not newly profiled here.

## Decision

### PRESERVE AGGREGATE FIRST

`arena_select_view` is the best next pruning candidate among this group once the compact cohort aggregate is created and validated. Its raw event is retired, has no current in-repository consumer, and sits outside active 30-day stats windows. The prior retention analysis means there is a known historical metric worth carrying forward. Do not begin a canary until the aggregate is preserved and the external-dashboard limitation is accepted.

### Proposed future 50-row canary SQL — not executed

After the aggregate has been saved and validated, a future authorized canary could use:

```sql
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '15s';

WITH candidates AS MATERIALIZED (
  SELECT id
  FROM public.analytics_events
  WHERE event = 'arena_select_view'
    AND created_at < '2026-08-11T14:12:14.822368Z'::timestamptz
  ORDER BY created_at
  LIMIT 50
  FOR UPDATE SKIP LOCKED
), deleted AS (
  DELETE FROM public.analytics_events AS e
  USING candidates AS c
  WHERE e.id = c.id
  RETURNING e.created_at
)
SELECT count(*) AS delete_rows,
       min(created_at) AS first_deleted,
       max(created_at) AS last_deleted
FROM deleted;
```

This is a proposal only. No DELETE, ANALYZE, VACUUM, REINDEX, index/retention/configuration change, or migration was run.
