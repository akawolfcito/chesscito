# `analytics_events` VACUUM + ANALYZE checkpoint

Date: 2026-09-28\
Target: Supabase project `brsbdzpuvotxsadmcxyj`, database `postgres`, schema `public`, table `analytics_events`.

## Operation

The precheck was clear, so the authorized single operation was submitted:

```sql
VACUUM (ANALYZE, TRUNCATE FALSE) public.analytics_events;
```

The command runner did not return its captured stdout, exit code, or monotonic duration. The operation was not retried. The subsequent database checkpoint confirms that both VACUUM and ANALYZE completed: `last_vacuum` and `last_analyze` advanced to 2026-09-28, `vacuum_count` increased to 1, `analyze_count` increased to 2, dead tuples fell to zero, and `n_mod_since_analyze` is zero. Exact wall-clock duration is unavailable.

## Precheck

| Measure | Before |
| --- | ---: |
| Active vacuum/autovacuum workers | 0 |
| Conflicting or waiting locks | 0 |
| Long active operations on table (>60s) | 0 |
| Open transactions with snapshot (>5m) | 0 |
| Deadlocks | 0 |
| Total relation size | 274,874,368 bytes |
| Heap | 128,532,480 bytes |
| Indexes total | 146,276,352 bytes |
| `reltuples` / `relpages` | 470,588 / 15,690 |
| `n_live_tup` / `n_dead_tup` | 450,722 / 34,454 |
| `last_vacuum` / `last_analyze` | null / 2026-09-25 13:24:02.694825 UTC |
| `vacuum_count` / `analyze_count` | 0 / 1 |
| `autovacuum_count` / `autoanalyze_count` | 0 / 0 |

## Postcheck

| Measure | After |
| --- | ---: |
| `last_vacuum` | 2026-09-28 15:04:01.100013 UTC |
| `vacuum_count` / `autovacuum_count` | 1 / 0 |
| `last_analyze` | 2026-09-28 15:04:09.256299 UTC |
| `analyze_count` / `autoanalyze_count` | 2 / 0 |
| `reltuples` / `relpages` | 450,722 / 15,690 |
| `n_live_tup` / `n_dead_tup` | 450,722 / 0 |
| `n_mod_since_analyze` | 0 |
| Total relation size | 275,046,400 bytes |
| Heap | 128,532,480 bytes |
| Indexes total | 146,448,384 bytes |
| `analytics_events_pkey` | 19,316,736 bytes |
| `idx_analytics_events_created_at` | 12,099,584 bytes |
| `idx_analytics_events_event` | 38,903,808 bytes |
| Active vacuum/autovacuum workers at close | 0 |
| Conflicting or waiting locks at close | 0 |
| Deadlocks at close | 0 |
| Long active operations / old snapshot transactions at close | 0 / 0 |

The total and index bytes increased by 172,032 relative to the prior checkpoint; heap and the listed principal index sizes were unchanged. This is not a maintenance failure. The primary result is that the dead tuple estimate is zero, planner statistics match the live tuple estimate, and no modifications remain since ANALYZE. Physical file size is not expected to shrink from ordinary VACUUM with `TRUNCATE FALSE`.

## Classification

**MAINTENANCE COMPLETE** — database statistics confirm successful VACUUM and ANALYZE, with dead tuples substantially reduced and no safety anomalies at close. Physical size did not decrease; it rose by 172,032 bytes overall, which is not a maintenance failure. The runner did not provide a trustworthy operation duration, so it is recorded as unavailable rather than inferred from the surrounding tool wait time.

No further maintenance or pruning was performed.
