# Chesscito — read-only production performance diagnosis

> Archived evidence: this report describes its dated observation/source snapshot, not current production state or authorization to execute its recommendations. As of this curation, the operator reports www on Cloudflare and Play/Learn stable; main contains adaptive and bounded cron fixes. Source paths, inventories, platform limits, access failures and deployment assumptions below may have changed. See [the curation review](2026-10-05-infrastructure-worktree-curation.md).


Capture: 2026-10-03 approximately 02:05–03:04 UTC, corresponding to the evening of October 2 in Bogotá. Results describe the observation window, not continuous monitoring.

## Finding

**The primary reproduced bottleneck is transport / edge delivery on the normally resolved production path.** All three surfaces are affected, including static assets that do not call Supabase or Redis. Normal DNS selected addresses in `216.150.1.x` / `216.150.16.x`. Of 60 bounded requests, 49 timed out, including five partial downloads. A comparison retaining the HTTPS hostname, SNI and URLs but selecting `76.76.21.21` completed all 36 requests with HTTP 200. Five browser cases failed or timed out on the normal path; all five navigated successfully on the comparison path.

This identifies the failing layer with high confidence within the measured vantage point. It does not establish whether Vercel, an intermediary network or transit/routing owns the fault. The user independently reports desktop and mobile/MiniPay impact; probes were not run from every affected network. The comparison was ephemeral in diagnostic requests, without a production DNS change.

A secondary Learn Inbox spike remains on the comparison path: 3.005 seconds. Runtime versus Supabase gateway contribution cannot be separated without per-request tracing. It cannot explain static-asset TLS failures or startup failures before APIs execute.

## Safety and measurement limits

- Application code, services, deployments, plans and production DNS were unchanged. No login, transaction, stats refresh, SQL aggregate, statistics reset or database write was executed.
- Curl: five fresh requests per resource type and surface, at most three concurrent requests across surfaces. Connection deadline 6 seconds, total deadline 15 seconds. Comparison: three requests per resource and surface. Bounded sampling, not a load test.
- All timings below are milliseconds unless stated otherwise. DNS/TCP/TLS are incremental stages; TTFB is cumulative from request start.
- Medians use completed samples only and have survivor bias. Timeout-heavy population medians are censored and cannot be stated precisely. Worst sample is a p95-like observation, not a statistical p95.
- HTTP 200 with an incomplete body is a failed download. The five partial downloads are included in the 49 timeouts.
- Chromium used fresh contexts, no personal browser profile, desktop/mobile viewports and a synthetic injected MiniPay provider. The simulation is not a real MiniPay wallet/device.
- Browser policy blocked non-read requests, analytics, blockchain RPC POSTs and app GETs with writes, aggregate work or incompletely audited side effects. Only audited Inbox GET was allowed. Intentional aborts are not production errors.
- Supabase/Redis credentials remained in memory. No credentials, sensitive response contents or personal wallet data are reproduced. This report is the only repository file added by this performance investigation.

## Phase 1 — end-to-end timings

### Normally resolved path

| Surface | Resource | Completed / 5 | Median completed | Worst completed | Worst attempt / deadline | Timeouts | Partial downloads |
|---|---|---:|---:|---:|---:|---:|---:|
| www | HTML | 2 | 4050.17 | 5095.82 | 6006.82 | 3 | 0 |
| www | JS | 1 | 1966.74 | 1966.74 | 6006.90 | 4 | 0 |
| www | CSS | 3 | 2094.37 | 3585.06 | 6003.20 | 2 | 0 |
| www | Image | 0 | unavailable | unavailable | 6007.02 | 5 | 0 |
| Learn | HTML | 1 | 4253.20 | 4253.20 | 15004.10 | 4 | 1 |
| Learn | JS | 0 | unavailable | unavailable | 15003.33 | 5 | 1 |
| Learn | CSS | 0 | unavailable | unavailable | 15005.23 | 5 | 1 |
| Learn | Image | 2 | 4940.46 | 5465.40 | 6006.69 | 3 | 0 |
| Play | HTML | 1 | 2153.00 | 2153.00 | 15001.31 | 4 | 1 |
| Play | JS | 1 | 1595.31 | 1595.31 | 15006.36 | 4 | 0 |
| Play | CSS | 0 | unavailable | unavailable | 15006.43 | 5 | 1 |
| Play | Image | 0 | unavailable | unavailable | 6006.72 | 5 | 0 |

No probe received HTTP 4xx/5xx. Most failures happened before an HTTP response: status-code monitoring alone misses them.

### Completed HTML stage timings

Each cell gives median / worst. Learn and Play each have only one completed HTML sample.

| Surface | DNS | TCP | TLS | TTFB | Total HTML | After TLS to first byte |
|---|---:|---:|---:|---:|---:|---:|
| www | 32.86 / 62.30 | 1523.38 / 2021.77 | 2256.91 / 3844.93 | 4030.91 / 5076.83 | 4050.17 / 5095.82 | 217.76 / 232.03 |
| Learn | 4.78 / 4.78 | 3022.34 / 3022.34 | 677.90 / 677.90 | 4051.92 / 4051.92 | 4253.20 / 4253.20 | 346.89 / 346.89 |
| Play | 3.48 / 3.48 | 20.45 / 20.45 | 1497.76 / 1497.76 | 1847.24 / 1847.24 | 2153.00 / 2153.00 | 325.55 / 325.55 |

Across the 11 completed resource requests, median TLS was approximately 1,644 ms; median after-TLS-to-first-byte was approximately 245 ms. Failed requests often exhausted the connection deadline without completing TLS. DNS lookup duration is generally short; DNS answer/path selection is implicated by the comparison.

### Same URLs, alternative diagnostic entry address

All 36 requests completed with HTTP 200, no timeouts or partial downloads.

| Surface | Resource | Samples | Median | Worst |
|---|---|---:|---:|---:|
| www | HTML | 3 | 365.67 | 439.33 |
| www | JS | 3 | 373.64 | 414.04 |
| www | CSS | 3 | 350.20 | 370.70 |
| www | Image | 3 | 1027.34 | 1931.45 |
| Learn | HTML | 3 | 535.70 | 615.97 |
| Learn | JS | 3 | 480.78 | 487.65 |
| Learn | CSS | 3 | 573.16 | 1398.53 |
| Learn | Image | 3 | 400.02 | 580.62 |
| Play | HTML | 3 | 509.52 | 543.82 |
| Play | JS | 3 | 393.41 | 403.18 |
| Play | CSS | 3 | 483.78 | 749.48 |
| Play | Image | 3 | 409.44 | 510.58 |

Representative JS/CSS/image URLs were extracted from each production HTML document.

| Surface | Representative JS | Representative CSS | Representative image |
|---|---|---|---|
| www | `/_next/static/chunks/app/%5Blocale%5D/page-f37a171b8633e40d.js` | `/_next/static/css/80e10533a67ff5e1.css` | `/art/landing-slides/slide-bg-1.png` |
| learn | `/_next/static/chunks/app/%5Blocale%5D/page-9e1d82601e1e1e0d.js` | `/_next/static/css/523f014d73adfde9.css` | `/art/ring-start-focus.avif` |
| play | `/_next/static/chunks/app/%5Blocale%5D/page-5e12aefce6d2af62.js` | `/_next/static/css/523f014d73adfde9.css` | `/art/redesign/bg/bg-new-hub.avif` |

 App JS was the locale page chunk; CSS the referenced Next static stylesheet; Play image was `/art/redesign/bg/bg-new-hub.avif`. The www image probe used a roughly 2 MB PNG preload candidate; Chromium instead used optimized AVIF images. That PNG size contributes to transfer time but cannot explain failures of HTML and small JS/CSS.

Several static responses carried cache HIT headers; comparison HTML carried MISS. The improvement is not explained by serving cached HTML instead of performing database work.

## Phase 2 — routes / APIs

`/api/inbox` GET was source-audited: a fresh Supabase read of `inbox_messages`, wallet and expiry filters, ordering and limit 50. No Redis dependency. A synthetic address was used and bodies discarded. Timings combine edge, runtime and Supabase; they are not isolated SQL durations.

| Endpoint | Path | Samples | Median completed | Worst completed | Timeouts | Worst attempt | Classification | HTTP |
|---|---|---:|---:|---:|---:|---:|---|---|
| Play `/api/inbox` | Normal | 3 | unavailable | unavailable | 3 | ~6003 | TIMEOUT | No response |
| Learn `/api/inbox` | Normal | 3 | 6991.26 | 6991.26 | 2 | 15006.41 | VERY SLOW + TIMEOUT | 200 on completion |
| Play `/api/inbox` | Comparison | 3 | 488.93 | 653.73 | 0 | 653.73 | FAST median; one SLOW | 200 |
| Learn `/api/inbox` | Comparison | 3 | 984.17 | 3004.57 | 0 | 3004.57 | SLOW median; one VERY SLOW | 200 |

Classification: FAST <500 ms; SLOW 500 ms–2 s; VERY SLOW >2 s. Learn comparison samples were 603, 3005 and 984 ms. The slowest waited approximately 2769 ms from TLS completion to first byte: this cannot be assigned wholly to Supabase without tracing.

Initial-load dependencies observed in the browser or reviewed in source:

| Route / provider | Dependency | Measurement / safety decision |
|---|---|---|
| `/api/pro/status` | Entitlement / Redis path | Blocked under strict read-only policy; no latency classification |
| `/api/profile/stats` | Supabase stats query | Avoided aggregate/statistics workload |
| `/api/peones/balance` | Supabase ledger | GET can seed welcome pack; blocked |
| `/api/welcome-pack/status` | Supabase existence read and rate-limit path | Rate-limit bookkeeping can write; blocked |
| `/api/shields/me` | Redis and rate-limit path | Rate-limit bookkeeping can write; blocked |
| `/api/season-pass/status` | Supabase and Redis | Can initialize/backfill focus ledger and count days; blocked |
| `/api/my-victories` | Player victories path | Observed on Play; blocked pending full side-effect audit |
| Privy configuration GET | External auth | Comparison: ~490 ms Learn / ~476 ms Play; FAST; settles access gate |
| WalletConnect metadata GETs | External metadata | Comparison: ~103–612 ms; FAST to SLOW; some finish after access controls appear |
| Celo Forno RPC | Blockchain | POSTs blocked; chain latency unmeasured |

Unmeasured routes are not labeled FAST/SLOW by inference. Public www had no observed product API dependency. Desktop unauthenticated pages stop at the access gate; authenticated product startup is not fully exercised.

## Phase 3 — Vercel runtime

| Surface | Production status | Deployment | Region | Created UTC |
|---|---|---|---|---|
| Play | READY | `dpl_BiQPSbzpFVkkgFrQR3E6Jp9HN8Pe` | iad1 | Sep 30, 17:09:01 |
| Learn | READY | `dpl_CxHFj8tgm2Xdh5TR5gkgzvVLAafP` | iad1 | Sep 30, 17:09:01 |
| www | READY | `dpl_HybGgxGz94vQPRYVrZpM2jY3efYs` | iad1 | Sep 30, 19:15:34 |

Production logs were queried per project for the preceding two hours: a bounded 50-row normal sample and separate 5xx-filtered queries. Normal samples were predominantly HTTP 200/redirects, with occasional unrelated scanner 404s. Each project's 5xx query returned zero rows; no observed 504 or repeated runtime-timeout signature.

This is not proof every request succeeded: transport failures may never reach a function. Function duration fields, traces and cold-start markers were unavailable. Duration spikes and cold starts remain **unknown**, not zero. Static assets serve intermittently on the normal path and consistently in this comparison.

Vercel's public status was operational at the check; it does not rule out regional/transit problems. [Vercel status API](https://www.vercel-status.com/api/v2/summary.json).

## Phase 4 — Supabase

Exporter metrics only, no SQL. Latest safe capture: 03:00:46 UTC, compared with 02:38:36 UTC (~22 minutes). CPU counters give interval averages, not instantaneous usage or compute-credit readings.

| Signal | Observation | Limits |
|---|---|---|
| CPU | ~2.20% busy excluding idle/iowait; ~5.51% iowait over 22 min | No sustained CPU saturation observed; short spikes not excluded |
| Load 1 / 5 / 15 min | 0.21 / 0.22 / 0.18 | Latest snapshot |
| Memory | 406.51 MiB total; 211.36 MiB available (~52%) | Swap is in use; OOM not established |
| Connections | Earlier inventory: 11 / max 60 | Username groups, not active/idle states |
| Pool | `pgbouncer_up=1`, waiting clients 0 | Full Supavisor health not established |
| DB liveness | `pg_up=1` | Exporter observation |
| Database size | Earlier observation: 351,792,275 bytes (~335.50 MiB) | Telemetry, not a new table aggregate |
| Query execution telemetry | +885 calls, +8.142 s execution (~9.2 ms per added call) | Global pg_stat_statements counters; no per-query tails |
| Temp I/O | 66 files / 1,029,775,303 bytes cumulative; delta 0 | Historical usage; no increase in interval |
| Deadlocks | 0 | Does not establish absence of lock waits |
| Lock waits / heavy writers | unavailable per session/query | No blockers identified; not ruled out |
| Disk IO Budget / burst balance | unavailable | Cannot assert healthy or exhausted |
| Disk busy-time counters | nvme1n1 +0.976 s; nvme0n1 +100.72 s / ~1330 s | Not a measurement of IO Budget or throttling |
| Exporter request latency | 1411 ms, HTTP 200 | Administrative endpoint, not SQL latency |

A live Supabase incident reported intermittent Eastern US latency. Its Oct 2, 21:06 UTC update reported significant improvement with some remaining impact; the notice includes serverless clients regardless of database location. The iad1 functions are geographically relevant. This could contribute to secondary API latency, but does not establish Chesscito compute exhaustion. [Supabase incident](https://status.supabase.com/incidents/w91bvbjhqf0f).

Project-specific gateway-error/throttle series and Disk IO Budget were unavailable. No error in sampled operational reads. No statistics reset. [Supabase metrics documentation](https://supabase.com/docs/guides/observability/metrics).

## Phase 5 — Redis

| Read | Samples | Median | Worst | Result |
|---|---:|---:|---:|---|
| Authenticated HTTPS REST PING | 5 | 282.70 | 901.09 | All HTTP 200 / PONG |
| GET known existing public stats snapshot | 3 | 266.74 | 770.79 | All HTTP 200; existing value |

No snapshot payload is reproduced. No rebuild or write occurred. Timings include the diagnostic client's HTTPS transport and do not measure Vercel-to-Redis latency. No connectivity failure observed; Redis cannot explain static resource TLS/transfer stalls.

## Phase 6 — browser waterfall

Normal path: all five cases failed or exceeded a 30-second DOMContentLoaded wait. www and Learn desktop had incomplete document delivery. Play MiniPay simulation completed HTML around 2.92 seconds but had no DOMContentLoaded, paint or visible enabled controls by the deadline. A font and numerous JS chunks took roughly 9.52 seconds; some waited for first bytes and at least one stalled during transfer. No completed application API preceded these failures. A Learn simulated case failed with `ERR_CONNECTION_RESET`.

Longest completed normal-path resource observed: `/_next/static/media/bbd5014b95876927-s.p.woff2`, approximately 9526 ms in Play simulation. Several chunks were almost equally slow; pending resources have no completed timing, so no unique blocking file is established.

Comparison browser run mapped `*.chesscito.com` to the alternative diagnostic address, also affecting the custom Privy hostname. Same fresh contexts and read-only policy:

| Surface / context | HTML complete | DOMContentLoaded | First contentful paint | Visible enabled control proxy | Notable longest resource / API |
|---|---:|---:|---:|---:|---|
| www / mobile | 368.4 | 558.9 | 1276 | 382.2 | ~201 ms image; no app API |
| Learn / desktop | 415.9 | 594.5 | 608 | 1495.7 | Privy iframe ~1268 ms; config ~490 ms |
| Play / desktop | 431.8 | 636.9 | 636 | 1545.1 | Privy iframe ~1228 ms; config ~476 ms |
| Learn / MiniPay simulation | 374.8 | 654.8 | 664 | 1101.5 | Inbox ~1016 ms, HTTP 200 |
| Play / MiniPay simulation | 368.3 | 547.3 | 568 | 975.0 | Inbox ~1036 ms, HTTP 200 |

Visible enabled controls are a DOM proxy, not proof every action works; no interactions occurred. Simulated controls appeared **before** Inbox started (Learn 1110 ms / Play 979 ms). Thus Inbox did not block those controls. Other product APIs were blocked, so entitlement-dependent actions were not validated.

Desktop access buttons appeared after Privy configuration settled; its longer embedded-wallet iframe completed later. Maximum observed comparison JS long task: 74 ms, not a multi-second CPU stall.

Source: `WalletProviderBoundary` renders a shell without product children until hydration and a lazy wallet-provider branch load. Desktop additionally waits for Privy readiness. Slow critical CSS/chunks therefore prolong the shell. On the comparison path, branches and controls appear in roughly 1–1.5 seconds. This dependency amplifies asset-delivery stalls; client CPU is not the leading measured cause.

## Phase 7 — comparison

| Component | Median latency | Worst latency | Errors | Evidence | Confidence |
|---|---|---|---|---|---|
| Normal edge/transport | Completed HTML: www 4.05 s; Learn 4.25 s; Play 2.15 s; survivor bias | Curl deadlines 6–15 s; browser deadline 30 s | 49/60 timeouts; 5 partials | Static assets and HTML fail; alternate entry succeeds | High for layer; owner unresolved |
| Alternative diagnostic entry | HTML www/Learn/Play: 0.366 / 0.536 / 0.510 s | HTML 0.616 s; all-resource max 1.931 s | 0/36; all 200 | Same hostname/SNI and deployments | High for comparison |
| Application + Supabase Inbox | Comparison: Play 0.489 s; Learn 0.984 s | Learn 3.005 s | Comparison all 200 | Audited Supabase-backed GET, no split trace | Medium |
| Vercel runtime | unavailable | unavailable | No 5xx/504 in last-2h filtered queries | READY deployments; bounded log samples | Medium observations; duration exclusion unavailable |
| Supabase DB | ~9.2 ms per added call, counter average, not median | Query tail unavailable | No exporter error; provider incident | Low CPU average, 11/60 connections, no temp-I/O delta | Medium for no sustained saturation; gateway tails unknown |
| Redis HTTPS REST | PING 0.283 s; GET 0.267 s | 0.901 / 0.771 s | None in 8 reads | PONG / existing public snapshot | Medium; runtime path unmeasured |
| Client startup | Comparison proxy ~0.975–1.545 s app contexts | Normal deadline 30 s; completed resource ~9.526 s | Critical resources stalled | Max long task 74 ms; controls precede Inbox | High for resource dependency; auth coverage limited |

## Answers A–H

**A. Primarily edge/network?** Yes, for the reproduced slowdown. TCP/TLS and static delivery dominate; the alternative entry restores all three surfaces. The responsible operator/network remains unresolved. This is not dismissed as a single-device anomaly.

**B. Application/runtime?** Not the leading explanation. Invocation durations are unavailable and a backend spike remains. The wallet-provider shell amplifies slow asset delivery.

**C. Supabase?** Possible secondary contributor given its provider incident and Learn Inbox outlier. No evidence establishes it as the primary limiter or proves compute/connection exhaustion. Exact IO budget, query tails and lock waits remain unknown.

**D. Redis?** No observed connectivity failure or evidence it causes the common slowdown. It is absent from failing static delivery and the audited Inbox read.

**E. One blocking request?** No single API demonstrated. HTML/CSS/JS delivery prevents readiness before app APIs complete. Desktop depends on Privy readiness, but that comparison delay was ~0.5 s, not the observed hang.

**F. Smallest safe mitigation?** Have Vercel investigate the affected resolved-address/routing path with this evidence and apply a provider-supported routing correction if confirmed. No code rollback, restart or capacity change is justified. The diagnostic alternative IP is evidence, not a validated production DNS change. No mitigation was executed.

**G. Would upgrading Supabase help?** Unlikely to fix the primary incident: compute cannot repair static-resource TLS/transfer failures. No sustained CPU or connection saturation observed; IO Budget needs verification before a capacity decision.

**H. Would changing Vercel plan help?** No supporting evidence. The fault occurs before/outside function execution and affects cached assets; a higher plan is not a demonstrated routing/transport fix.

Immediate rollback: **not justified by available evidence**. No deployment regression was established; a deployment-to-incident causal comparison was unavailable.

Diagnosis complete; stopped without operational changes.
