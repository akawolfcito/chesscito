# Arena mount final pruning checkpoint — 2026-09-28

## Scope

- Event: `arena_mount`
- Fixed cutoff: `2026-08-11T14:12:14.822368Z`
- Predicate: `created_at < cutoff`
- Maximum batch size: 100 rows
- Maximum batches authorized: 34
- Write path: validated transactional wrapper

No other event or maintenance operation was included.

## Precheck

| Check | Result |
| --- | ---: |
| Project ref | `brsbdzpuvotxsadmcxyj` |
| Database / schema / table | `postgres / public / analytics_events` |
| Baseline start (read-only COUNT) | 3,318 |
| Expected baseline | 3,318 |
| Active vacuum/autovacuum | 0 |
| Conflicting locks | 0 |
| Deadlocks | 0 |
| EXPLAIN index | `idx_analytics_events_event` |
| Sequential scan | No |

Each batch used an independent transaction, `lock_timeout = '1s'`, `statement_timeout = '15s'`, `FOR UPDATE SKIP LOCKED`, and `ORDER BY created_at`. The wrapper counted candidates after every confirmed COMMIT and compared the result with `baseline_start - committed_rows`.

## Batch results

All batches completed below the 5,000 ms DELETE round-trip limit. Each COMMIT was explicitly confirmed, and every read-only COUNT matched the expected remaining count.

| Batch | Rows | DELETE round-trip (ms) | COMMIT round-trip (ms) | Expected = actual remaining |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 100 | 202.008 | 75.824 | 3,218 |
| 2 | 100 | 191.280 | 70.887 | 3,118 |
| 3 | 100 | 175.538 | 70.910 | 3,018 |
| 4 | 100 | 171.737 | 68.047 | 2,918 |
| 5 | 100 | 170.387 | 69.975 | 2,818 |
| 6 | 100 | 160.156 | 74.650 | 2,718 |
| 7 | 100 | 155.735 | 69.765 | 2,618 |
| 8 | 100 | 154.933 | 71.036 | 2,518 |
| 9 | 100 | 140.148 | 72.277 | 2,418 |
| 10 | 100 | 150.172 | 69.932 | 2,318 |
| 11 | 100 | 154.051 | 71.736 | 2,218 |
| 12 | 100 | 140.060 | 72.271 | 2,118 |
| 13 | 100 | 151.151 | 78.805 | 2,018 |
| 14 | 100 | 147.418 | 68.126 | 1,918 |
| 15 | 100 | 151.390 | 71.687 | 1,818 |
| 16 | 100 | 154.759 | 75.639 | 1,718 |
| 17 | 100 | 163.543 | 70.705 | 1,618 |
| 18 | 100 | 156.678 | 74.239 | 1,518 |
| 19 | 100 | 180.866 | 71.559 | 1,418 |
| 20 | 100 | 180.147 | 71.425 | 1,318 |
| 21 | 100 | 157.532 | 69.253 | 1,218 |
| 22 | 100 | 150.885 | 70.685 | 1,118 |
| 23 | 100 | 141.702 | 72.496 | 1,018 |
| 24 | 100 | 180.669 | 68.774 | 918 |
| 25 | 100 | 193.953 | 68.881 | 818 |
| 26 | 100 | 168.947 | 72.280 | 718 |
| 27 | 100 | 151.156 | 69.788 | 618 |
| 28 | 100 | 153.254 | 75.043 | 518 |
| 29 | 100 | 145.521 | 74.436 | 418 |
| 30 | 100 | 158.582 | 81.576 | 318 |
| 31 | 100 | 156.744 | 74.514 | 218 |
| 32 | 100 | 150.744 | 74.700 | 118 |
| 33 | 100 | 224.866 | 70.454 | 18 |
| 34 | 18 | 89.702 | 100.102 | 0 |

## Final checkpoint

| Measure | Result |
| --- | ---: |
| Baseline start | 3,318 |
| Batches attempted | 34 |
| Batches confirmed | 34 |
| Rows committed | 3,318 |
| Expected remaining | 0 |
| Actual remaining (final read-only COUNT) | 0 |
| DELETE round-trip average | 161.071 ms |
| DELETE round-trip maximum | 224.866 ms |
| Combined deleted timestamp range | `2026-08-04 07:25:42.741997+00` through `2026-08-11 14:11:22.632923+00` |
| Confirmed rollbacks | 0 |
| Transaction state unknown | No |
| Active vacuum/autovacuum | 0 |
| Conflicting locks | 0 |
| Deadlocks | 0 |
| Wrapper/psql exit status | 0 |

After batch 34, the final COUNT was zero and matched the expected remaining count. No batch beyond the authorized maximum was started.

## Classification

**ARENA_MOUNT COMPLETE** — `expected_remaining = actual_remaining = 0`.

No other events or maintenance operations were run.
