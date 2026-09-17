# Phase 1 containment review — preview handoff

Date: 2026-09-16. Branch: `fix/phase-1-supabase-io-containment`.
Verdict: **READY for preview testing** after the correctness fixes below.
No commit, push, deployment, production SQL execution or environment change was
performed. All pre-existing user work remains in the worktree.

## 1. First-seen implementation review

`apps/web/src/app/api/telemetry/route.ts` remains the only application writer
of `account_first_seen` and `session_first_seen`. An accepted wallet-bearing
event contributes an account cohort write regardless of event name; only
`app_opened` contributes a session cohort write. Batch-local first-touch
dimensions and HMAC account identity are unchanged.

Each confirmed registry holds at most 10,000 keys, with FIFO eviction. A key
is remembered only when Supabase returns `error: null`. Concurrent requests
for an unconfirmed key join its pending write; completion or rejection removes
the pending entry. Errors, incomplete responses and synchronous exceptions are
not remembered. A later eligible event retries; no timer or automatic retry
loop was added.

Cold starts, different instances and eviction can repeat a DB attempt. The
unchanged `ignoreDuplicates: true` / `ON CONFLICT DO NOTHING` contract keeps
the existing `first_seen`, first surface/container/country and session source
immutable. The tables' default timestamps remain the first successful DB
insert timestamps, as before; the cache does not invent a new event-time rule.

Separate requests for unrelated accounts do not share a lock. Cohort writes
within one batch still execute sequentially, as before. Pending maps contain
active unique writes rather than completed history; unlike the confirmed maps,
they have no hard cardinality limit or additional timeout. A permanently stuck
DB request remains pending until request/runtime termination. This review did
not change that pre-existing network timeout behavior.

Analytics insertion still precedes cohort writes. Both wire formats, the
20-event batch limit, sanitization, row order, event names/payloads, privacy
handling, empty 204 success response and 413 size rejection are unchanged.
The existing `afterResponse` seam awaits work by default; its name does not
imply that this route currently writes after returning the response.

## 2. Stats containment review

The public landing `src/app/stats/page.tsx` reads only
`stats:public:all-all:v1` from Redis. Reloads, locale changes and filter query
strings cannot execute Supabase aggregation. Filters remain explicitly
unavailable during containment. Web's localized stats route redirects to the
public landing URL; when testing preview, visit the landing preview directly
because that unchanged redirect points at the production hostname.

The protected `POST /api/internal/stats/refresh` is the only routed caller of
the stats aggregator. Missing/wrong secrets return 401 before Redis/DB access;
missing Redis returns 503. The historical `snapshot.ts` Next cache and its
process-local single-flight are not used by the public containment path.
`/api/revalidate-stats` only invalidates that historical Next cache tag and
does not refresh or delete the durable Redis value.

The refresh intentionally runs **five** RPCs:
`stats_activation_funnel`, `stats_access_funnel`, `stats_retention`,
`stats_account_lifecycle`, `stats_activity_trend`.

It intentionally omits `stats_install_counts`, `stats_top_countries`, and
`stats_habit_depth`; the on-chain block, census and install breakdown are also
explicitly unavailable. No omitted RPC is re-enabled by this review. The five
enabled RPCs are not assumed to be free of temp IO; frequency containment is
the mitigation, and their IO still needs measurement.

| Redis key | Semantics |
| --- | --- |
| `stats:public:all-all:v1` | Durable value with no freshness/deletion TTL; retains last published snapshot. |
| `stats:public:refresh-lock:v1` | Shared `SET NX EX` lease, 120 seconds; unique ownership token. |
| `stats:public:refresh-cooldown:v1` | Shared 900-second cooldown after successful publication. |

There is one data key, independent of locale/filter/instance. The workflow
schedules every 15 minutes; successful computation is gated by the cooldown.
This is an approximate target, not a maximum snapshot age: scheduler delays,
failures and a scheduled request arriving before the previous publication's
cooldown expires can extend freshness beyond 15 minutes. The original
`generatedAt` remains visible when stale data is served.

The existing cadence change increases the scheduled ceiling from four to
96 refresh attempts per day: five enabled RPCs per successful refresh means
about 480 RPC calls/day, versus 20/day at the previous six-hour cadence.
Public requests contribute zero. Failures do not set a successful cooldown;
manual authenticated retries can add work and should not be looped in a test.
The 15-minute cadence is approved for preview validation only; its suitability
for production has not been established. Do not promote to production until
one refresh's IO cost is measured and its estimated daily impact at 96 refreshes
is assessed. Public reads adding zero DB work does not remove the cron's IO risk.

| Situation | Result |
| --- | --- |
| No valid snapshot / missing Redis / Redis read failure | Public unavailable state; no DB fallback. |
| Fresh or stale valid snapshot | Read and render the same durable data; no recomputation. |
| Concurrent refresh from another worker | Shared Redis lease denies acquisition; 409, no second build. |
| Successful refresh inside cooldown | 429 with unchanged body and `Retry-After: 900`; no build. |
| All attempted RPCs succeed | Publish unchanged version-1 snapshot schema and cooldown in one owned Redis operation; 200. |
| Attempted RPC fails, times out or produces a null required scalar | 503 `incomplete_snapshot`; previous snapshot and timestamp remain; later retry possible. |
| Crash before publication | Old value survives; lock expires after 120 s. |
| Crash after publication | Valid snapshot and cooldown have already been written together. |
| Worker tries to publish after losing its lease | Publication denied; it cannot overwrite data or release its successor's lock. |

The lease exceeds the deployed `maxDuration = 60`. The deployment must honor
that function limit; an arbitrary worker allowed to run beyond the lease can
overlap computation after lease expiration. Publication is fenced even in
that case. A network timeout can make publication acknowledgement ambiguous:
Redis may already have committed the valid value and cooldown together. It
cannot publish a rejected partial candidate through this path.

## 3. Race-condition / correctness findings

1. **Partial refresh accepted:** the previous structural validator allowed
   failures among RPCs that were actually attempted. Marking those blocks
   unavailable made them eligible to replace a good snapshot. Fixed by requiring
   the explicitly selected RPC set to succeed and produce non-null required
   results before publication. The intentionally omitted set is still allowed.
   This also rejects the empty aggregator result when Supabase is unconfigured.
2. **Publication/cooldown crash gap and expired ownership:** two separate SETs
   could leave a published value without its cooldown, and publication did not
   check lease ownership. Fixed with a single ownership-checked Redis Lua
   operation using the existing Redis API and keys. Lock release remains
   ownership-checked.
3. **First-seen incomplete acknowledgement:** `!error` treated an absent error
   field as success. Fixed by requiring `error === null`.
4. **Synchronous first-seen exception:** invoking the writer before constructing
   the pending chain could abort the rest of a batch's cohort work. It now runs
   inside the chain, after pending registration, and follows the retryable path.
5. **Test state leakage:** clearing captured calls did not reset the module's
   confirmed maps. Tests now reload the route per test and restore stubbed env
   variables; requests within each test still share one process registry.

The structural validator also rejects missing metric fields, missing breakdown
objects and missing census clocks. Valid version-1 legacy snapshots without
availability metadata still load with their existing default availability.

## 4. Test coverage review

First-seen route tests cover new wallet/session writes, batch deduplication,
repeated requests, concurrent account/session requests, unrelated accounts,
Supabase response errors, rejected promises, synchronous exceptions, missing
success acknowledgement, later retry, app_opened-only session eligibility,
10,000-entry FIFO eviction for both registries, unchanged identity on a cold
process and analytics recording while cohort work fails or is coalesced.

The eviction tests simulate the DB's immutable conflict contract and verify
the original timestamp and dimensions survive the retry. This is contract
coverage, not a live Postgres integration test; preview smoke verifies actual
stored values. The unchanged SQL migrations establish primary keys, default
timestamps and `ON CONFLICT DO NOTHING` semantics.

Stats tests cover runtime public page reads across simultaneous visits,
locales/filters, missing storage and storage failure; there is no Supabase
fallback. They cover two independent worker modules sharing Redis, cooldown
boundaries at 899.999/900 seconds, dead-worker lease expiration, stale reads
during refresh and after failure, failed required RPCs, empty results, Redis
publication failure, successor ownership and unchanged snapshot/HTTP shapes.
The historical Next-cache TTL/single-flight tests remain in the full landing
suite. Redis unit tests model shared storage; the actual EVAL round-trip remains
a required preview smoke check.

## 5. Diff isolation review

| Class | File | Change |
| --- | --- | --- |
| A | `.github/workflows/cron-stats-snapshot-refresh.yml` | Existing 15-minute schedule change. |
| A | `apps/web/src/app/api/telemetry/route.ts` | Existing bounded first-seen containment plus the two acknowledgement/exception safety fixes. |
| A | `apps/landing/src/lib/stats/persisted-snapshot.ts` | Existing 900-second gate plus required-result validation and owned atomic publication. |
| A | `apps/landing/src/app/api/internal/stats/refresh/route.ts` | Declare the existing five attempted RPCs as required. |
| B | `apps/web/src/app/api/telemetry/__tests__/route.test.ts` | Existing regression tests plus missing failure/concurrency/eviction/isolation coverage. |
| B | `apps/landing/src/lib/stats/__tests__/persisted-snapshot.test.ts` | Missing refresh failure, ownership, stale-read, distributed-worker and TTL coverage. |
| B | `apps/landing/src/app/api/internal/stats/refresh/__tests__/route.test.ts` | Existing cooldown expectation plus preservation/empty-result/lock and response-shape coverage. |
| B | `apps/landing/src/app/stats/__tests__/stats-page-containment.test.tsx` | New runtime page-read regressions. |
| B | `docs/audits/2026-09-16-phase-1-preview-review.md` | This report. |
| B | `docs/audits/2026-09-16-phase-1-io-capture.sql` | Read-only counter capture; not executed. |
| B | `docs/audits/2026-09-16-phase-1-io-compare.sql` | Read-only interval comparison; not executed. |

No unrelated changes are mixed into the modified functional files. No event
emitter, stats formula, SQL migration, client gameplay/economy component or
blockchain code is changed. The standard build regenerated existing ABI files
without leaving a tracked diff.

Pre-existing supporting docs (B), left unchanged:

- `docs/audits/2026-09-15-stats-snapshot-containment.md`
- `docs/audits/2026-09-15-supabase-disk-io-audit.md`
- `docs/audits/2026-09-16-phase-1-disk-io-containment.md`
- `docs/handoffs/2026-09-15-stats-disk-io-containment-handoff.md`
- `docs/handoffs/2026-09-16-supabase-io-incident-handoff.md`

The September 15 snapshot audit/handoff describe older refresh sets/cadences;
they are historical context, not current deployment instructions. Use this
review for the current five-RPC/15-minute behavior. Do not include conflicting
historical runbooks in the Phase 1 commit without an explicit historical note.

Unrelated pre-existing untracked docs (C), preserved and excluded from the
recommended commit:

- `docs/audits/2026-08-28-docker-footprint-audit.md`
- `docs/audits/2026-09-01-farcaster-feasibility.md`
- `docs/audits/2026-09-02-duel-council-review.md`
- `docs/audits/2026-09-02-duel-preflight.md`
- `docs/audits/2026-09-02-state-of-chesscito-synthesis.md`
- `docs/audits/2026-09-02-telemetry-verified-and-real-state.md`
- `docs/audits/2026-09-02-unread-experiment-result.md`
- `docs/audits/2026-09-02-vitals-and-infra-rightsizing.md`
- `docs/audits/2026-09-02-wallet-provisioning-models.md`
- `docs/audits/2026-09-02-where-they-quit-and-why-they-return.md`
- `docs/audits/2026-09-04-estado-actual.md`
- `docs/audits/2026-09-13-free-tier-readiness.md`
- `docs/audits/2026-09-14-upstash-vercel-handoff.md`

D flag: the unrelated `2026-09-02-duel-council-review.md` contains a NUL byte
and is treated as binary by rg. It is untouched and should stay out of this
commit; inspect it separately before including it in a documentation commit.

## 6. Validation results

- `git diff --check`: passed.
- `pnpm build`: passed; all four build tasks completed, including both Next apps.
- `pnpm -C apps/landing type-check` and `pnpm -C apps/web exec tsc --noEmit`:
  passed after the production build completed.
- `pnpm -C apps/web lint`: passed, with three existing hook-dependency warnings
  in unchanged gameplay files.
- First-seen route suite after final fixes: **39 passed**.
- Landing full suite: **334 passed, 3 skipped, 32 files**.
- Final targeted stats suites after the independent-worker test update:
  **33 passed across 3 files**.
- `pnpm -C apps/web test -- --maxWorkers=4`: **9,261 passed, 2 failed, 1 todo;
  729 passing files / 731 total**, completed in 301 seconds. The failures are
  the two known unrelated baseline failures: coach prompt inline-snapshot state
  initialization (`src/lib/coach/__tests__/prompt-template.test.ts`) and the
  stale `/dev/pro-chip` consumer catalog
  (`src/lib/dev/__tests__/dev-catalog.test.ts`). The final added batch-exception
  test was additionally verified in the focused 39-test route rerun.

Failed command classification:

- `pnpm lint`: pre-existing repository configuration failure; landing invokes
  Next's interactive ESLint setup. Configuration was not changed.
- `pnpm type-check`: environment/tooling failure; Turbo TLS/Keychain setup.
  Direct app checks and both app builds passed.
- `pnpm test`: pre-existing repository limitation; no root test script.
  App suites were run directly.
- An intermediate direct web TypeScript run raced with `.next` regeneration
  by the concurrently running build and reported missing generated files. That
  validation sequencing issue was resolved by rerunning after the build.
- One added test initially used the wrong location for the filters prop and
  one added fixture needed an explicit record type. Both test-code issues were
  fixed and their checks rerun.

The prior Google Fonts DNS and build timeout blockers did not recur in the
completed standard build. No repository/tool configuration was changed to
obtain these results.

## 7. Fixes made

Only the five safety/test-isolation findings in section 3 were fixed. Existing
user changes were retained. This review added regression coverage and the
review/measurement artifacts, and created the review branch without a commit.

## 8. Exact modified-file list after review

The eleven files in the section 5 A/B table form the current Phase 1 review
boundary: seven tracked modified files and four new files. The eighteen
pre-existing untracked documents listed separately remain user work and were
not changed by this review. Nothing is staged or committed by this task.

## 9. Preview readiness

**READY for preview testing.** The compile/build and focused regression evidence
support testing the reviewed implementation. This is not evidence that the
production IO incident is resolved, nor that the preview smoke has already run.

Gameplay, score save/session signing, rewards, Peones accounting, leaderboard
definitions, HMAC/wallet identity, retention definitions, monetization and
chain transaction flows have no implementation diff. Account-capacity reads
still count the same durable cohort rows; the containment skips only redundant
conflict attempts, not new identities. Telemetry/API and version-1 snapshot
contracts retain their existing return shapes.

## 10. Preview blockers

No outstanding Phase 1 code blocker. Global lint setup and the known unrelated
web test failures are recorded validation limitations, not silently fixed.
Actual preview deployment, isolated environment configuration and smoke results
remain to be performed by the preview workflow.

## 11. Exact preview smoke procedure

Prerequisites: deploy this branch to both web preview variants (Learn/Play) and
landing preview using preview Supabase and Redis stores distinct from
production. This matters because the Redis snapshot/lock keys deliberately have
one fixed name; a preview sharing production storage could overwrite/block the
production snapshot. This review did not inspect secret values or provision
storage. Confirm isolation through existing environment tooling before writes.
Use a dedicated test account and a 390px mobile viewport. Build preview with
telemetry enabled and the same preview HMAC secret across smoke reloads.
The production telemetry kill switch remains an independent operational choice.
Do not copy raw request bodies, wallet addresses, auth headers or tokens into
reports/logs.

1. **Telemetry:** open a fresh preview bundle; sign in normally. Navigate to
   the hub, open/close a normal modal, reload twice and navigate back to the hub
   twice. Wait at least six idle seconds after each event group for the existing
   five-second client flush. Browser Network should show normal
   `POST /api/telemetry` batches with empty 204 responses. Using preview-only
   read-only DB tooling, confirm accepted analytics rows for that test activity
   continue appearing. Compare the test account/session cohort before and
   after, returning only equality booleans/counts: one row per key, unchanged
   `first_seen` and first-touch fields. New storage/account identity should
   produce the appropriate new cohort row. A cold instance may make another
   conflict attempt; it must not modify the row.
2. **Training:** start an exercise, solve it, earn additional stars where the
   test account has room for improvement, then retry/replay once. Check gameplay
   state, stars and existing completion events. Replay may legitimately emit
   no `training_stars_earned` if best stars do not improve. All original telemetry
   emissions remain eligible; this is not a volume-reduction test.
3. **Arena:** enter via the ordinary hub flow, start a game, make a first move,
   finish via a normal terminal action, and use Play Again if offered. Check
   new-game state and ordinary persistence/error UI. Verify existing start,
   first-move and persistence telemetry; aborted requests need not have an
   outcome event. Arena's mount/reset emitters remain untouched.
4. **Economy/persistence:** confirm Peones balance loads, record an exercise
   result through the normal score-save path, and confirm its saved result and
   leaderboard behavior. The test account must have an authorized signing
   session for an actual save; an intentional `session_required` defer is a
   separate known state. Verify replay/save outcomes use existing quotas and
   deduplication. Use a preview chain/test account if a flow requires a wallet
   transaction; no mainnet payment is required to smoke this containment.
5. **Stats before refresh:** visit the **landing preview URL** `/stats` five
   times, reload twice, then visit `?locale=es`, `?locale=en` and
   `?surface=learn&container=minipay`. If no value exists, expect unavailable
   state and no DB fallback. If a value exists, expect stable metrics and
   `generatedAt` across these reads; locale only changes presentation and
   filters are unavailable. Capture stats statement counters around these
   accesses using `io-capture.sql` in the isolated preview DB: every stats RPC
   call delta must be zero without an overlapping internal refresh.
6. **One authorized refresh:** use an existing secure client/secret reference
   to POST `/api/internal/stats/refresh` on landing preview with the configured
   bearer secret. Do not paste its value into shell history or logs. Expect
   200 `{refreshed:true,refreshedAt:<ISO>}`. Verify the stored version-1 snapshot
   and all metric fields keep their existing shape, the five attempted RPCs
   succeeded, and the omitted three/other blocks are explicitly unavailable.
   Reload `/stats`; it now reads the new timestamp without another computation.
7. **Cooldown/lock:** POST again immediately with the same secure client. Expect
   429 `{refreshed:false,reason:"refresh_cooldown"}` and `Retry-After: 900`, with
   no added stats calls. A separate request arriving during an active build
   instead gets 409 `refresh_in_progress`; the unit tests exercise that
   concurrency without an extra production load test. After 900 seconds from
   publication, the next intended refresh may succeed. For a failed refresh
   in an isolated fault-injection test, expect 503 and the prior readable
   timestamp/data; do not induce a production DB outage to prove this.

## 12. Production measurement SQL and acceptance signals

Use [io-capture.sql](2026-09-16-phase-1-io-capture.sql) at the start/end of a
matched 15-minute BEFORE window, then at the start/end of a matched 15-minute
AFTER window once an eventual production deployment is serving fresh bundles.
Store four aggregate JSON captures locally; do not create tables or reset
`pg_stat_statements` on production. Keep telemetry enablement, deployment
variant mix, traffic and cron-refresh overlap comparable. A disabled-before /
enabled-after comparison cannot attribute the IO difference to this code.

Use [io-compare.sql](2026-09-16-phase-1-io-compare.sql) as a parameterized
read-only query, supplying the four JSON objects in order. Query fingerprints
are serialized as strings to avoid JavaScript numeric precision loss. The
comparison groups all fingerprints per write target / stats function and
rejects windows containing a reset, eviction or negative delta.

Output includes interval calls, `shared_blks_dirtied`, `shared_blks_written`,
`shared_blks_read`, `temp_blks_read`, `temp_blks_written`, `total_exec_time`, and
`mean_exec_time = delta(total_exec_time) / delta(calls)` in milliseconds. The
capture includes the lifetime mean for reference, but never subtract those
means or label a lifetime mean as an interval mean. A function with no interval
calls has no measured interval mean.

Primary signal: `account_first_seen_per_analytics_call` and its percentage.
The observed baseline is `77124 / 78625 = approximately 0.9809` (98.09%).
Expect a substantial drop under similar traffic/runtime reuse, not zero:
new identities, cold starts, multiple instances and FIFO eviction remain safe
sources of cohort attempts. Analytics calls measure INSERT statements rather
than event rows; batching is unchanged, and the independent Duel server writer
may contribute analytics INSERTs without cohort writes.

Stats acceptance: repeated public reads alone add zero `stats_*` calls. One
successful protected refresh normally adds one call per enabled RPC (five
total); omitted RPCs add zero. Record the scheduler's actual execution times
when interpreting a production 15-minute window. Keep mean execution cost and
total interval temp IO separate: this phase does not promise that individual
queries become faster or stop spilling.

At both window endpoints, record Supabase Disk IO Budget chart values and
timestamp, compute the observed budget change per minute, and compare the
slopes under similar traffic. Budget charts can lag the statement captures.
Also record CPU/memory/connections as context; do not use cumulative lifetime
counters to claim an improvement from this deployment.

## 13. Recommended commit boundary

One reviewable commit, `fix: contain first-seen writes and protect stats refresh`,
should contain exactly the eleven A/B review files in the section 5 table.
Keep the eighteen pre-existing untracked documents out of automatic staging.
The existing investigation audit can be a separate reviewed documentation
commit; older snapshot runbooks need historical labeling if included.
Before any later commit, inspect the exact staged diff for scope/secrets and
use the repository's required `Wolfcito 🐾 @akawolfcito` signature convention.
This task stages nothing and commits nothing.
