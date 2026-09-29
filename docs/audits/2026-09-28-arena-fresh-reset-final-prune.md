# Arena fresh reset final pruning checkpoint — 2026-09-28

## Scope

- Event: `arena_fresh_reset_fired`
- Fixed cutoff: `2026-08-11T14:12:14.822368Z`
- Predicate: `created_at < cutoff`
- Batch maximum: 100 rows
- Round maximum: 22 batches
- Write path: validated transactional wrapper

No other event or maintenance operation was included.

## Wrapper and precheck

The wrapper read the initial candidate count and stored it as the run baseline. It required the observed value to equal the user-confirmed expected starting value of 2,137. After each confirmed COMMIT, it queried the remaining candidates and compared that count with `baseline_start - committed_rows`; it stopped immediately at zero.

| Check | Result |
| --- | ---: |
| Project ref | `brsbdzpuvotxsadmcxyj` |
| Database / schema / table | `postgres / public / analytics_events` |
| Transaction read-only | `off` in the dedicated controlled write session |
| Baseline start | 2,137 |
| Active vacuum/autovacuum before run | 0 |
| Conflicting locks before run | 0 |
| Deadlocks before run | 0 |
| EXPLAIN index | `idx_analytics_events_event` |
| Sequential scan | No |

Each transaction used `lock_timeout = '1s'`, `statement_timeout = '15s'`, `FOR UPDATE SKIP LOCKED`, and `ORDER BY created_at`. DELETE and COMMIT acknowledgements were checked by the wrapper.

## Batch results

| Batch | Rows | DELETE round-trip (ms) | COMMIT round-trip (ms) | Expected remaining | Actual remaining | COMMIT confirmed |
| ---: | ---: | ---: | ---: | ---: | ---: | :---: |
| 1 | 100 | 265.371 | 77.811 | 2,037 | 2,037 | Yes |
| 2 | 100 | 212.273 | 72.537 | 1,937 | 1,937 | Yes |
| 3 | 100 | 217.180 | 72.517 | 1,837 | 1,837 | Yes |
| 4 | 100 | 209.247 | 68.703 | 1,737 | 1,737 | Yes |
| 5 | 100 | 224.484 | 71.867 | 1,637 | 1,637 | Yes |
| 6 | 100 | 220.276 | 68.457 | 1,537 | 1,537 | Yes |
| 7 | 100 | 205.837 | 70.257 | 1,437 | 1,437 | Yes |
| 8 | 100 | 191.619 | 73.427 | 1,337 | 1,337 | Yes |
| 9 | 100 | 191.945 | 68.482 | 1,237 | 1,237 | Yes |
| 10 | 100 | 199.629 | 69.098 | 1,137 | 1,137 | Yes |
| 11 | 100 | 356.608 | 71.571 | 1,037 | 1,037 | Yes |
| 12 | 100 | 197.614 | 71.164 | 937 | 937 | Yes |
| 13 | 100 | 189.015 | 68.286 | 837 | 837 | Yes |
| 14 | 100 | 186.730 | 70.256 | 737 | 737 | Yes |
| 15 | 100 | 198.139 | 71.070 | 637 | 637 | Yes |
| 16 | 100 | 225.171 | 75.815 | 537 | 537 | Yes |
| 17 | 100 | 172.883 | 68.381 | 437 | 437 | Yes |
| 18 | 100 | 188.956 | 70.964 | 337 | 337 | Yes |
| 19 | 100 | 192.084 | 73.732 | 237 | 237 | Yes |
| 20 | 100 | 166.570 | 70.990 | 137 | 137 | Yes |
| 21 | 100 | 183.437 | 69.951 | 37 | 37 | Yes |
| 22 | 37 | 106.416 | 69.537 | 0 | 0 | Yes |

## Final checkpoint

| Measure | Result |
| --- | ---: |
| Baseline start | 2,137 |
| Batches attempted | 22 |
| Batches confirmed | 22 |
| Rows deleted and committed | 2,137 |
| Expected remaining | 0 |
| Actual remaining from final read-only COUNT | 0 |
| DELETE round-trip average | 204.613 ms |
| DELETE round-trip maximum | 356.608 ms |
| Combined deleted timestamp range | `2026-08-04 22:11:47.677706+00` through `2026-08-11 14:11:22.632923+00` |
| Active vacuum/autovacuum after run | 0 |
| Conflicting locks after run | 0 |
| Deadlocks after run | 0 |
| Confirmed rollbacks | 0 |
| Transaction state unknown | No |
| Wrapper/psql exit status | 0 |

After batch 22, the actual count reached zero and matched the calculated expected count. No additional batch was started.

## Classification

**ARENA_FRESH_RESET COMPLETE** — `expected_remaining = actual_remaining = 0`.

No `arena_mount` rows, maintenance operations, retention settings, or cutoff values were changed.
