# Arena mount pruning checkpoint — round 1 — 2026-09-28

## Scope

- Event: `arena_mount`
- Fixed cutoff: `2026-08-11T14:12:14.822368Z`
- Predicate: `created_at < cutoff`
- Batch limit: 100 rows
- Round maximum: 20 batches
- Write path: validated transactional wrapper

No other event or maintenance operation was included.

## Precheck

The wrapper read the candidate count at the start and used that value as `baseline_start`. It required the observed count to equal the expected 5,318 before writing.

| Check | Result |
| --- | ---: |
| Project ref | `brsbdzpuvotxsadmcxyj` |
| Database / schema / table | `postgres / public / analytics_events` |
| Transaction read-only | `off` in the dedicated controlled write session |
| Baseline start | 5,318 |
| Active vacuum/autovacuum | 0 |
| Conflicting locks | 0 |
| Deadlocks | 0 |
| EXPLAIN index | `idx_analytics_events_event` |
| Sequential scan | No |

After every confirmed COMMIT, the wrapper read the remaining candidate count and compared it with `baseline_start - committed_rows` before proceeding.

## Batch results

Each batch deleted 100 rows and received explicit COMMIT confirmation. Every post-COMMIT count matched the expected remaining count.

| Batch | Rows | DELETE round-trip (ms) | COMMIT round-trip (ms) | Expected = actual remaining |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 100 | 253.532 | 74.917 | 5,218 |
| 2 | 100 | 205.401 | 69.971 | 5,118 |
| 3 | 100 | 200.945 | 69.948 | 5,018 |
| 4 | 100 | 172.749 | 73.838 | 4,918 |
| 5 | 100 | 176.334 | 74.267 | 4,818 |
| 6 | 100 | 230.215 | 71.138 | 4,718 |
| 7 | 100 | 191.380 | 71.174 | 4,618 |
| 8 | 100 | 168.921 | 72.208 | 4,518 |
| 9 | 100 | 158.647 | 69.608 | 4,418 |
| 10 | 100 | 170.343 | 70.952 | 4,318 |
| 11 | 100 | 174.592 | 73.036 | 4,218 |
| 12 | 100 | 166.438 | 68.842 | 4,118 |
| 13 | 100 | 469.918 | 70.462 | 4,018 |
| 14 | 100 | 171.787 | 68.683 | 3,918 |
| 15 | 100 | 168.261 | 69.958 | 3,818 |
| 16 | 100 | 173.997 | 79.374 | 3,718 |
| 17 | 100 | 282.846 | 72.558 | 3,618 |
| 18 | 100 | 148.055 | 69.468 | 3,518 |
| 19 | 100 | 166.767 | 67.725 | 3,418 |
| 20 | 100 | 140.867 | 72.982 | 3,318 |

## Final checkpoint

| Measure | Result |
| --- | ---: |
| Baseline start | 5,318 |
| Batches attempted | 20 |
| Batches confirmed | 20 |
| Rows committed | 2,000 |
| Expected remaining | 3,318 |
| Actual remaining | 3,318 |
| DELETE round-trip average | 199.600 ms |
| DELETE round-trip maximum | 469.918 ms |
| Combined deleted timestamp range | `2026-06-06 22:41:33.756854+00` through `2026-08-04 07:24:54.538774+00` |
| Confirmed rollbacks | 0 |
| Transaction state unknown | No |
| Active vacuum/autovacuum | 0 |
| Conflicting locks | 0 |
| Deadlocks | 0 |
| Wrapper/psql exit status | 0 |

The final read-only count matched the calculated remaining count: `5,318 - 2,000 = 3,318`.

## Classification

**ARENA_MOUNT PARTIAL** — candidates remain and all 20 batches completed with confirmed commits and reconciled counts.

No further batches or maintenance operations were run.
