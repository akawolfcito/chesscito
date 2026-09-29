# Arena fresh reset pruning checkpoint — 2026-09-28

## Scope

- Event: `arena_fresh_reset_fired`
- Cutoff: `2026-08-11T14:12:14.822368Z`
- Predicate: `created_at < cutoff`
- Batch limit: 100 rows
- Maximum batches authorized: 10
- Write path: validated transactional wrapper only

No other event or maintenance operation was included.

## Precheck

| Check | Result |
| --- | ---: |
| Project ref | `brsbdzpuvotxsadmcxyj` |
| Database / schema / table | `postgres / public / analytics_events` |
| Transaction read-only | `off` for this controlled write session |
| Active vacuum/autovacuum | 0 |
| Conflicting locks | 0 |
| Deadlocks | 0 |
| Candidates before | 5,137 |
| EXPLAIN index | `idx_analytics_events_event` |
| Sequential scan | No |

## Batch results

All ten batches deleted 100 rows each. Each transaction received explicit server confirmation of COMMIT; no rollback or ambiguous transaction state occurred.

| Batch | Rows | DELETE round-trip (ms) | COMMIT round-trip (ms) | COMMIT confirmed |
| ---: | ---: | ---: | ---: | :---: |
| 1 | 100 | 191.097 | 72.864 | Yes |
| 2 | 100 | 202.523 | 70.803 | Yes |
| 3 | 100 | 191.847 | 70.863 | Yes |
| 4 | 100 | 217.040 | 70.823 | Yes |
| 5 | 100 | 223.587 | 73.189 | Yes |
| 6 | 100 | 225.024 | 70.390 | Yes |
| 7 | 100 | 210.186 | 71.680 | Yes |
| 8 | 100 | 206.485 | 73.600 | Yes |
| 9 | 100 | 202.214 | 70.252 | Yes |
| 10 | 100 | 186.871 | 68.907 | Yes |

## Checkpoint

- Batches attempted: 10
- Batches confirmed: 10
- Rows deleted: 1,000
- Mean DELETE round-trip: 205.687 ms
- Maximum DELETE round-trip: 225.024 ms
- Combined deleted timestamp range: `2026-06-14 02:49:44.367318+00` through `2026-08-03 15:31:44.991551+00`
- Candidates remaining under cutoff: 4,137
- Active vacuum/autovacuum: 0
- Conflicting locks: 0
- Deadlocks: 0
- Confirmed rollbacks: 0
- Transaction state unknown: No
- Wrapper/psql exit status: 0

## Classification

**ARENA_FRESH_RESET PARTIAL** — candidates remain, and all ten batches completed safely with confirmed commits.

No further batches, `arena_mount` deletion, or maintenance were run.
