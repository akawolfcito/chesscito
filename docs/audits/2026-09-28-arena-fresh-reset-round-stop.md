# Arena fresh reset round — stopped at precheck (2026-09-28)

## Scope

- Requested event: `arena_fresh_reset_fired`
- Fixed cutoff: `2026-08-11T14:12:14.822368Z`
- Authorized maximum: 20 independent batches of up to 100 rows
- Required write path: validated transactional wrapper

## Precheck result

| Check | Result |
| --- | ---: |
| Project ref | `brsbdzpuvotxsadmcxyj` |
| Database / schema / table | `postgres / public / analytics_events` |
| Transaction read-only setting | `off` |
| Active vacuum/autovacuum | 0 |
| Conflicting locks | 0 |
| Deadlocks | 0 |
| Actual candidates under cutoff | 4,137 |
| Wrapper's hard-coded expected baseline | 5,137 |
| EXPLAIN / DELETE | Not reached |
| DELETE sent | No |

The precheck correctly stopped because its expected candidate count was stale by 1,000 rows. A separate read-only count confirmed 4,137. No DELETE, COMMIT, or ROLLBACK was attempted in this round; there were no batches or transaction outcomes to report.

## Classification

**STOP / INVESTIGATE** — the wrapper's precheck baseline must match the confirmed current count before another authorized pruning round. No automatic retry was made.

No `arena_mount` rows or maintenance operations were touched.
