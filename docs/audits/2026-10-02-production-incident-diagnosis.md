# Chesscito production incident — read-only diagnosis

> Archived evidence: this report describes its dated observation/source snapshot, not current production state or authorization to execute its recommendations. As of this curation, the operator reports www on Cloudflare and Play/Learn stable; main contains adaptive and bounded cron fixes. Source paths, inventories, platform limits, access failures and deployment assumptions below may have changed. See [the curation review](2026-10-05-infrastructure-worktree-curation.md).


Observation window: 2026-10-03 00:59–01:15 UTC (2026-10-02 19:59–20:15 America/Bogota).

## Conclusion

The strongest reproduced failure is intermittent connectivity/TLS and download stalling on the network path from this observer to Vercel's DNS-selected public addresses. The same hostname and resource served quickly through another Vercel public address, with certificate validation retained. This establishes a path-dependent accessibility problem, but does **not** distinguish a Vercel edge fault from ISP/transit routing or prove that every affected MiniPay user shares this path.

The application was serving successful production requests during observation. All three deployments are READY. Existing logs did not reveal HTTP 5xx in the bounded two-hour query. Supabase PostgreSQL and Redis responded, and database telemetry did not show connection exhaustion or sustained CPU saturation in the measured samples.

Separately, Supabase has an unresolved Eastern US API Gateway latency incident. All three applications run functions in `iad1`, making this a credible intermittent backend risk, but this investigation did not correlate a current failing invocation with that incident. Supabase cannot explain TLS failures when downloading a static board image.

## Incident table

| Component | Status | Latency | Errors | Evidence | Confidence |
| --- | --- | --- | --- | --- | --- |
| Client-to-Vercel network/edge path | Degraded from this observer | TLS timeouts at 5–10 s; one partial download timed out at 10 s | curl 28, including pre-HTTP failures | DNS-selected addresses `216.150.1.1` / `216.150.16.1` repeatedly stalled; alternate `76.76.21.21` served the same resources quickly | High for observed path dependence; medium for relevance to reported users; low for fault ownership |
| Vercel deployments | Available | Alternate-path responses 0.40–0.61 s | No 5xx rows in bounded query | Play, Learn, www all production READY; aliases confirmed; all functions `iad1` | High for metadata; medium for runtime health |
| Application runtime | Available in sampled requests | Play inbox 2.744 s; Learn inbox 0.571 s through alternate edge | No reproduced 5xx; expected validation 400 | Production request samples include successful inbox, balance, welcome-pack, game, profile and page requests | Medium; duration distributions and full browser behavior unavailable |
| Supabase API Gateway/network | Provider incident active; project reachable | Schema GET 2.160–2.504 s; metrics GET 0.398–1.682 s | No error on these reads | Official Eastern US latency incident; applies to clients/serverless functions there; deployments are in `iad1` | High that provider incident exists; medium-low attribution to this incident |
| PostgreSQL compute/memory | No sustained saturation observed | Telemetry only; not a direct SQL latency measurement | `pg_up=1`, exporter scrape error 0 | CPU busy approximately 1.56%; iowait 3.78%; load1 0.15–0.28; available memory 50.1–54.1% | Medium, short cached observation window |
| Database connections/pool | No exhaustion indicated | Wait-duration percentile unavailable | No pool waiting clients in exported sample | 11 PostgreSQL connections across exported username groups versus maximum 60; `pgbouncer_up=1`, waiting clients 0 | Medium; active/idle split and Supavisor service-specific utilization unavailable |
| Slow queries/temp I/O/locks | No execution-time surge shown in global telemetry; individual attribution unavailable | Approximately 4.02 ms execution time per additional statement, globally | Deadlocks counter 0; temp counters unchanged across refreshed samples | `pg_stat_statements` telemetry: +86 calls / +0.345423 s; temp files 66 and temp bytes 1,029,775,303 are historical totals | Medium-low; averages hide outliers and lock waits were not observable |
| Disk I/O budget/throttling | Budget UNKNOWN; no sustained busy-disk signal in sampled counters | Database-volume busy-time increment 0.099 s over the refreshed metric interval | Explicit throttling signal unavailable | `nvme1n1`: +142 reads / +84 writes; `nvme0n1`: +24,343 reads / +14,051 writes and +5.114 s busy time | Low for budget/throttling; medium for observed counters |
| Redis | Reachable | PING 0.980 s initially, 0.294 s later, including connection setup | HTTP 200, PONG twice | Connectivity only; no scan, rebuild, refresh, writes or quota changes | High for connectivity; medium for sustained health |

## Production deployment metadata

| Domain | Project | Current deployment | State | Created UTC | Runtime region |
| --- | --- | --- | --- | --- | --- |
| play.chesscito.com | chesscito | `dpl_BiQPSbzpFVkkgFrQR3E6Jp9HN8Pe` / `chesscito-mz3hw3c86-goodwolf.vercel.app` | READY, production | 2026-09-30 17:09:01 | iad1 |
| learn.chesscito.com | lite-chesscito | `dpl_CxHFj8tgm2Xdh5TR5gkgzvVLAafP` / `lite-chesscito-1gvcw7xnr-goodwolf.vercel.app` | READY, production | 2026-09-30 17:09:01 | iad1 |
| www.chesscito.com | chesscito-landing | `dpl_HybGgxGz94vQPRYVrZpM2jY3efYs` / `chesscito-landing-lggk3qagn-goodwolf.vercel.app` | READY, production | 2026-09-30 19:15:34 | iad1 |

The inspected deployment payload did not supply a commit SHA; local HEAD is not treated as evidence of the deployed revision.

CLI log reads were restricted to production, with branch filtering disabled. Latest normal samples contained 50 rows per project. Play showed 200 and normal redirects; Learn additionally showed the diagnostic validation 400 and two historical `/robots.txt` 404 rows; landing showed 200 and normal redirects. Samples contain log records, potentially multiple records per invocation, and are not traffic totals. Separate `5xx` queries over the preceding two hours returned zero rows for each project. No runtime timeout/error signature was established from these reads. Function durations were absent from the returned fields, so duration spikes, p95/p99 and 300-second timeout counts remain **unknown**, not zero.

Vercel's public status reported all systems operational, including `iad1`, at capture. This does not rule out localized routing problems. [Vercel status](https://www.vercel-status.com/api/v2/summary.json).

## Safe endpoint checks

Classification convention: fast ≤1 s, slow >1 s; timeout means curl reached its bound even if a partial HTTP response had started. These are single-observer measurements, not service percentiles.

| GET/read | Normal DNS path | Alternate edge, same hostname and TLS verification | Classification |
| --- | --- | --- | --- |
| Play `/` | HTTP 200, 4.191 s; TLS completed at 3.630 s. An earlier attempt timed out before HTTP at 15 s | Not needed | Slow / intermittent timeout |
| Learn `/` | HTTP 200, 3.886 s | Not needed | Slow |
| www `/` | HTTP 200, 3.487 s; TLS completed at 3.131 s. An earlier attempt timed out before HTTP at 15 s | Not needed | Slow / intermittent timeout |
| Play `/art/chesscito-board.png` | Repeated TLS timeouts. Explicit `216.150.1.1` comparison eventually returned HTTP 200 but transferred only 66,938 of 274,046 bytes before the 10 s timeout | HTTP 200, complete response, 0.518 s | Timeout on selected path / fast on alternate |
| Learn `/art/chesscito-board.png` | TLS timeout at 10 s, remote `216.150.1.1` | HTTP 200, 0.514 s | Timeout / fast |
| www `/robots.txt` | TLS timeout at 10 s, remote `216.150.16.1` | HTTP 200, 0.404 s | Timeout / fast |
| www `/stats` | TLS timeout at 10 s | HTTP 200, 0.612 s | Timeout / fast; existing snapshot read only |
| Play `/api/inbox`, synthetic zero address | First TLS timeout; repeated GET HTTP 200, 2.744 s | Not needed | Intermittent timeout / slow successful DB-backed read |
| Learn `/api/inbox`, synthetic zero address | Not tested directly | HTTP 200, 0.571 s | Fast DB-backed read |
| Learn `/api/leaderboard?window=invalid` | HTTP 400, 0.849 s | Not needed | Expected 4xx; runtime validation only, no database aggregation |
| Play `/api/leaderboard?window=invalid` | TLS timeout at 10 s | Not repeated | Timeout before runtime validation |
| Supabase `/rest/v1/` | HTTP 200, 2.160 and 2.504 s | Not applicable | Slow schema read; not a query-latency benchmark |
| Supabase existing metrics | HTTP 200, 0.398–1.682 s | Not applicable | Fast/slow variability; telemetry retrieval only |
| Redis REST PING | HTTP 200, PONG, 0.980 and 0.294 s | Not applicable | Fast |

`curl --resolve` was used solely as a per-request diagnostic override. DNS, domains and Vercel configuration were not changed. The alternate address is evidence for a path comparison, **not** a recommended permanent DNS target.

## Database telemetry and limitations

The [Supabase Metrics API](https://supabase.com/docs/guides/observability/metrics) provided existing host and PostgreSQL telemetry. No SQL aggregates, application-table scans, RPCs, `EXPLAIN`, stats reset or maintenance were executed.

- PostgreSQL database `postgres`: 351,792,275 bytes, approximately **335.50 MiB**. A separate exported `pg_database_size_mb` series was 349.91; these series are not assumed to represent identical database scope.
- Memory: total 426,258,432 bytes; available 213,426,176–230,805,504 bytes. Latest refreshed available value 225,046,528 bytes (**52.80%**). Swap is allocated/in use; that alone does not establish current swapping pressure or OOM. Current OOM and swap-rate telemetry were not recovered.
- CPU percentages use changes in cumulative CPU-mode counters divided by the sum of those changes across the two exported CPUs: approximately **1.56% busy**, **3.78% iowait**, excluding steal from execution. This is host telemetry, not a measurement of compute-plan credits or throttling entitlement.
- The first pair of scrapes, 20.417 s apart, had identical counters, demonstrating cached telemetry. Their zero deltas were **not** treated as zero workload. The later sample differed; CPU counters advanced about 92.22 s per CPU despite approximately 72 s between client captures. Exact instantaneous rates therefore cannot be assigned to client wall time.
- Refreshed global statement telemetry advanced by **86 calls** and **0.345423 s** execution time, about **4.02 ms per added call** in aggregate. This does not identify individual slow queries or exclude p99 spikes. No reset was performed, and no negative/reset discontinuity appeared in the compared counters; complete reset metadata was unavailable.
- Temp-file/byte counters remained 66 / 1,029,775,303 across the refreshed comparison; the ~1.03 GB is historical, not current temp traffic. Deadlocks remained zero. Zero deadlocks do **not** establish absence of lock waits.
- Connection series exposed counts 9 and 2 grouped by username, not by active/idle state. Total observed connections **11 / 60**. **Active connections: UNKNOWN**. Exported PgBouncer had zero waiting clients and was up; this does not fully characterize the session-mode Supavisor pool.
- Disk IO Budget percentage/remaining credits were **not exposed in the retrieved series**. The dashboard was inaccessible through the available UI access. Exact budget depletion and storage throttling remain **UNKNOWN**. Supabase locates this budget in its Database Health observability dashboard: [High Disk I/O](https://supabase.com/docs/guides/troubleshooting/exhaust-disk-io).
- Per-query `pg_stat_statements`, heavy-writer attribution, lock-wait inventory and historical query-latency distributions were unavailable. The existing SQL client requires Docker, whose daemon was stopped. No Docker service was started and no replacement client was installed.

## A–F decisions

**A. Most likely bottleneck:** the client-to-Vercel edge/transit network path for the accessibility failures reproduced here. The fault occurs before HTTP or stalls static downloads, and the alternate path succeeds. Production-wide attribution remains provisional until reproduced from an affected user's independent network.

**B. Is Supabase currently the limiting factor?** Not demonstrated. Current telemetry and successful DB-backed reads argue against sustained database saturation/connection exhaustion as the observed blocker. Its active provider networking incident could still cause intermittent backend delays.

**C. Would upgrading Supabase compute likely help?** No evidence supports it for this failure. Additional database compute cannot fix client TLS/static-download failures or a provider API Gateway transit issue. Exact Disk IO Budget is unknown, so this conclusion does not claim unlimited storage capacity.

**D. Is Vercel implicated?** Its public edge network path is implicated in the reproduction. Deployments and sampled functions are healthy; a Vercel platform/runtime outage is not established. Responsibility between Vercel, transit and the observer's ISP remains unresolved.

**E. Smallest safe mitigation:** for affected clients, try another network connection as a temporary workaround and corroborate the result. Preserve current deployments/configuration. If confirmed across independent connections, the diagnostic address/timing comparison is suitable evidence for an edge/transit support investigation. No external message was sent. Do not replace DNS with the diagnostic alternate IP on this evidence alone.

**F. Immediate rollback justified?** No. No deployment-specific runtime regression or current failing application route was established; rollback would not address the reproduced TLS/static-transfer path failure.

Supabase's latest provider update, **2026-10-02 21:06 UTC**, reports improvement but continuing latency for some Eastern US clients. This incident includes serverless clients regardless of the database's own region. [Supabase incident: Intermittent latency in Eastern US](https://status.supabase.com/incidents/w91bvbjhqf0f).

## Safety and access record

Production actions were bounded GETs, Redis PING, existing telemetry reads and deployment/log inspection. `/api/peones/balance` was excluded from active probing because its GET can seed a welcome pack. Leaderboard data/aggregate routes, stats refresh, cron execution, migrations, restarts, upgrades, deployments, cache rebuilds and writes were not performed. Inbox reads used the synthetic zero address and discarded response bodies. Secrets remained in memory or subprocess stdin; no credentials, connection strings, personal records or raw application log messages were rendered or saved.

The Vercel connector returned 403 for this team; the existing authenticated CLI supplied metadata and logs. UI access to Chrome was not approved, so the Supabase dashboard itself could not be inspected. Initial sandbox DNS failures were excluded from production evidence and relevant probes were repeated with approved network access. Existing untracked repository work was preserved; only this Markdown report was added to the repository. Diagnosis stops here; no mitigation was applied.
