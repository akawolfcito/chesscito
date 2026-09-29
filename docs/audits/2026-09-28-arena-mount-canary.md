# Arena mount pruning canary — 2026-09-28

## Scope

- Event: `arena_mount`
- Fixed cutoff: `2026-08-11T14:12:14.822368Z`
- Predicate: `created_at < cutoff`
- Maximum for this canary: 50 rows
- Write path: validated transactional wrapper

No second batch or maintenance operation was run.

## Precheck

| Check | Result |
| --- | ---: |
| Project ref | `brsbdzpuvotxsadmcxyj` |
| Database / schema / table | `postgres / public / analytics_events` |
| Baseline start (read-only COUNT) | 5,368 |
| Historical reference | 5,368 |
| Baseline delta | 0 |
| Active vacuum/autovacuum | 0 |
| Conflicting locks | 0 |
| Deadlocks | 0 |
| EXPLAIN index | `idx_analytics_events_event` |
| Sequential scan | No |

## Canary result

- Rows deleted: 50
- SQL success: `true`
- SQLSTATE: `00000`
- DELETE round-trip: 184.709 ms
- COMMIT round-trip: 74.543 ms
- COMMIT confirmed: `true`
- Deleted timestamp range: `2026-06-03 03:39:57.733017+00` through `2026-06-06 22:33:54.184339+00`

## Read-only checkpoint

| Measure | Result |
| --- | ---: |
| Expected remaining (`baseline_start - DELETE_ROWS`) | 5,318 |
| Actual remaining | 5,318 |
| Active vacuum/autovacuum | 0 |
| Conflicting locks | 0 |
| Deadlocks | 0 |
| Wrapper/psql exit status | 0 |

The post-COMMIT COUNT reconciled exactly with the baseline and committed row count.

## Classification

**FAST DELETE CONFIRMED** — the single canary committed successfully, completed within the timing limit, and the remaining candidate count matched the expected value.

No additional `arena_mount` batch was run.
