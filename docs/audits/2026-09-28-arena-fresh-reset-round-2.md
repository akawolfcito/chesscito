# Arena fresh reset pruning checkpoint — round 2 — 2026-09-28

## Scope

- Event: `arena_fresh_reset_fired`
- Fixed cutoff: `2026-08-11T14:12:14.822368Z`
- Predicate: `created_at < cutoff`
- Batch limit: 100 rows
- Authorized maximum: 20 independent batches
- Write path: corrected validated transactional wrapper

No other event or maintenance operation was included.

## Wrapper/precheck correction

The previous wrapper had a stale hard-coded expected count of 5,137. This run reads the candidate count at the start, requires it to equal the user-confirmed expected starting value of 4,137, stores that live value as `baseline_start`, and calculates the expected remaining count from confirmed commits. The final read-only count must equal that calculation.

The wrapper was syntax-checked before execution. The per-batch SQL, transaction checks, timing guard, explicit COMMIT acknowledgement, and stop conditions remain enforced.

## Precheck

| Check | Result |
| --- | ---: |
| Project ref | `brsbdzpuvotxsadmcxyj` |
| Database / schema / table | `postgres / public / analytics_events` |
| Transaction read-only | `off` in the dedicated controlled write session |
| Active vacuum/autovacuum | 0 |
| Conflicting locks | 0 |
| Deadlocks | 0 |
| Baseline start | 4,137 |
| EXPLAIN index | `idx_analytics_events_event` |
| Sequential scan | No |

## Batch results

Every batch deleted 100 rows, completed below the 5,000 ms limit, and received explicit COMMIT confirmation with SQLSTATE `00000`.

| Batch | Rows | DELETE round-trip (ms) | COMMIT round-trip (ms) | COMMIT confirmed |
| ---: | ---: | ---: | ---: | :---: |
| 1 | 100 | 258.076 | 76.824 | Yes |
| 2 | 100 | 224.075 | 76.008 | Yes |
| 3 | 100 | 204.546 | 71.046 | Yes |
| 4 | 100 | 260.602 | 70.861 | Yes |
| 5 | 100 | 251.495 | 72.879 | Yes |
| 6 | 100 | 228.960 | 72.427 | Yes |
| 7 | 100 | 237.201 | 71.393 | Yes |
| 8 | 100 | 451.321 | 71.977 | Yes |
| 9 | 100 | 290.246 | 70.062 | Yes |
| 10 | 100 | 239.085 | 70.854 | Yes |
| 11 | 100 | 221.132 | 76.422 | Yes |
| 12 | 100 | 216.276 | 70.060 | Yes |
| 13 | 100 | 203.333 | 70.900 | Yes |
| 14 | 100 | 198.903 | 70.836 | Yes |
| 15 | 100 | 213.733 | 70.963 | Yes |
| 16 | 100 | 279.764 | 69.906 | Yes |
| 17 | 100 | 238.627 | 70.324 | Yes |
| 18 | 100 | 204.890 | 75.704 | Yes |
| 19 | 100 | 186.246 | 71.934 | Yes |
| 20 | 100 | 209.851 | 69.869 | Yes |

## Checkpoint

| Measure | Result |
| --- | ---: |
| Batches attempted | 20 |
| Batches confirmed | 20 |
| Rows committed | 2,000 |
| Baseline start | 4,137 |
| Expected remaining (`baseline_start - committed_rows`) | 2,137 |
| Actual remaining from read-only COUNT | 2,137 |
| DELETE round-trip average | 240.918 ms |
| DELETE round-trip maximum | 451.321 ms |
| Combined deleted timestamp range | `2026-08-03 15:31:57.371574+00` through `2026-08-04 22:11:36.191221+00` |
| Active vacuum/autovacuum | 0 |
| Conflicting locks | 0 |
| Deadlocks | 0 |
| Confirmed rollbacks | 0 |
| Transaction state unknown | No |
| Wrapper/psql exit status | 0 |

The expected and actual remaining counts match exactly: `4,137 - 2,000 = 2,137`.

## Classification

**ARENA_FRESH_RESET PARTIAL** — 2,137 candidates remain, and the round completed with all 20 commits confirmed and a matching final count.

No further batches, `arena_mount` deletion, or maintenance were run.
