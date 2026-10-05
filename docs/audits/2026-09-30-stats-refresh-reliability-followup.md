# Stats refresh reliability — production follow-up

> Archived evidence: this report describes its dated observation/source snapshot, not current production state or authorization to execute its recommendations. As of this curation, the operator reports www on Cloudflare and Play/Learn stable; main contains adaptive and bounded cron fixes. Source paths, inventories, platform limits, access failures and deployment assumptions below may have changed. See [the curation review](2026-10-05-infrastructure-worktree-curation.md).


Date: 2026-09-30 19:52 UTC
Mode: read-only. No refresh, database aggregation, deployment, or configuration change was performed. Existing uncommitted retention work was preserved.

## 1. Current snapshot freshness

Read-only Upstash REST requests (`EXISTS`, `TTL`, `GET`) returned:

| Field | Observed value |
|---|---|
| `stats:public:all-all:v1` exists | Yes (`EXISTS = 1`) |
| Redis TTL | `-1` (no expiry) |
| `refreshedAt` | `2026-09-28T13:49:02.497Z` |
| `stats.generatedAt` | `2026-09-28T13:48:55.834Z` |
| Age at capture | About **54 hours 4 minutes** |
| `stats_account_lifecycle` | Available; `active7d = 0` |
| `stats_retention` | Available; D7 `returned = 0`, `cohort = 2,386` (0.0% for this stored cohort) |
| Failed / omitted RPCs | `stats_install_counts`, `stats_top_countries`, `stats_habit_depth` |

The snapshot is structurally present and internally marks the five containment RPCs available. It is too old to represent current activity. The zero active count and D7 rate are actual values from this snapshot's successful RPC results, not null/unavailable placeholders; they describe the snapshot time only. The D7 denominator is positive, so its 0% is not the UI's “not enough history” case.

The snapshot has no TTL by design. If refreshes stop, the page continues to serve this old value rather than degrading or querying Supabase. Freshness therefore depends on monitoring `refreshedAt` and scheduled refresh success.

## 2. Cron health

The checked-in workflow `.github/workflows/cron-stats-snapshot-refresh.yml` still declares `17 */6 * * *`, or four scheduled runs per day. The expected 2026-09-30 18:17 UTC run was due about 1 hour 36 minutes before this capture.

The latest successful publication is confirmed by Redis at 2026-09-28 13:49 UTC. The previous operational report recorded two later scheduled HTTP 503 failures on 2026-09-29. Since there is no newer snapshot, no successful publication has occurred since then. However, this does **not** prove that scheduled executions continue failing: Actions may be disabled, delayed, skipped, or not running.

**Current GitHub Actions run list and status cannot be verified.** The local `gh` session reports an invalid token, and the repository is private to the GitHub read connector available in this session. Therefore the latest attempted run, the latest failed run, and whether failures continued after September 29 remain unknown. The schedule is present in the repository file; the live Actions workflow enabled state is not observable here.

## 3. Previous 503 investigation

### Confirmed

- The documented scheduled attempts returned HTTP 503.
- The deployed snapshot was preserved rather than replaced with partial values.
- The September 29 read-only diagnostic reproduced neither an RPC timeout nor a Redis failure. Redis PING/key metadata reads succeeded; the five enabled RPCs succeeded in three sequential passes with an 8-second statement timeout.
- One activation-funnel pass took 4.752 seconds; its two repeats were faster. A separate earlier health sample measured `select now()` at 5.889 seconds, but later small DB latency reads were 67–73 ms.
- The current local route has distinct 503 paths for unavailable Redis, incomplete required RPC results, phase timeout, and unexpected refresh failure. Its incomplete response/log now includes allow-listed failed RPC names, outcomes, durations, and stable error codes. The workflow captures and sanitizes a bounded response body on non-2xx.

### Still unconfirmed

The exact HTTP response body, request ID, and server log for the historical failed Actions runs were not available in the saved evidence. The September 29 diagnosis explicitly classified the failure cause as unknown. Elevated DB latency / an RPC error remains plausible; Redis or application/runtime errors are not ruled out historically.

A read of the Vercel runtime log stream for the current deployment returned no log rows during a bounded nine-second observation. Vercel's documented endpoint is a runtime stream for one deployment, so this empty sample is not evidence that the older failed invocations had no logs. The Vercel connector could not retrieve logs without a team ID, and the attempted direct historical logs endpoint was not a valid endpoint. No existing failure log or request ID was recovered.

The current code would make a new failure easier to classify if its Action response body is retained, but it cannot retroactively establish the reason for the September 29 503s.

## 4. Telemetry status

The deployed `play.chesscito.com` frontend was fetched read-only. The current public bundle contains the telemetry gate compiled as `if (!f("0") || …)`, and the source implementation returns early when the flag is `"0"`/`"false"`. The deployed client is therefore **OFF** for telemetry. This matches the production bundle result recorded in the September 29 health diagnostic.

Vercel's production environment API returned an opaque encrypted representation for this public flag in the non-decrypted response. The decrypted response did not expose a plain flag value through this token path, so this report relies on the effective compiled frontend behavior rather than claiming an environment value. No environment setting was changed.

Client telemetry being off can reduce client analytics events and make low engagement counts real for the observation window. It does not prove the entire analytics table is idle: server-side duel writers and direct requests can still write events.

## 5. Smallest safe next action

**Restore read-only GitHub Actions visibility and inspect the latest run, especially the 2026-09-30 18:17 UTC schedule. Do not rerun it.** The checked-in workflow now records the sanitized response body for a failed HTTP response. That single read will distinguish “no scheduled run” from a continuing 503 and, when present, identify `incomplete_snapshot`, `phase_timeout`, `refresh_failed`, or another HTTP response. No corrective change is justified before that evidence is visible.

If the latest run shows a 503, correlate its timestamp/request ID with the matching Vercel function logs and use the response's allow-listed failed RPC/error code. Do not infer a root cause from the stale snapshot alone.

## 6. Can production measurements proceed?

- **Yes:** bounded read-only operational checks can proceed: GitHub run metadata, snapshot metadata, public deployed bundle inspection, and existing logs.
- **No:** the snapshot's engagement numbers should not be presented as current production measurements; it is more than two days old.
- **No:** this investigation did not run raw database aggregates, `EXPLAIN ANALYZE`, a refresh, or a load test. Those remain outside the authorization given here.

## Access limitations and sources

- GitHub CLI `gh auth status`: local GitHub token invalid. Private Actions run list unavailable through the read connector.
- Vercel: public deployment HTML and JS fetched; production project metadata/environment metadata read without returning unrelated variable values. Runtime stream produced no rows in the bounded sample.
- Redis: only the existing snapshot key metadata and requested aggregate fields were read.
- Local references: `docs/audits/2026-09-30-public-stats-investigation.md`, `docs/audits/2026-09-29-operational-health-snapshot.md`, and `docs/audits/2026-09-29-stats-refresh-root-cause-diagnostic.md`.
- Vercel documents runtime logs as function invocation/application logs and describe retention through the Logs product; the REST endpoint for a deployment returns a runtime log stream: [Runtime Logs](https://vercel.com/docs/logs/runtime), [Get logs for a deployment](https://vercel.com/docs/rest-api/logs/get-logs-for-a-deployment).
