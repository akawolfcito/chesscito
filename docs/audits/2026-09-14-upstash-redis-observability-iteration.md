# Upstash Redis — Observability Iteration

**Date:** 2026-09-14
**Scope:** production measurement only. No Redis optimization, limiter algorithm, TTL, atomicity, idempotency, API response, or data-model behaviour was changed.

## Existing infrastructure reused

- `apps/web/src/lib/server/logger.ts` is the structured server logger. It emits JSON runtime logs in Vercel, redacts secret-shaped field names, never throws, and has a test sink.
- Client telemetry is intentionally not used. It is batched product analytics that persists to the application analytics store; infrastructure accounting belongs in server runtime logs and must not add client requests.

## Implementation

`apps/web/src/lib/server/redis-observability.ts` defines a narrow, aggregate-only event shape. It cannot accept a Redis key, IP, wallet, request, token, or session identifier. Events use the existing `createLogger` sink with `msg=redis_usage`.

Healthy observations are sampled at 10% by default. Configure `REDIS_OBSERVABILITY_SAMPLE_RATE` in the range `0..1` to adjust it. Rate-limit denials and backend failures are retained regardless of sampling. No Redis command, network request, database write, or external analytics event is added.

For `@upstash/ratelimit` sliding windows, estimated command counts use the official Regional cost model: allowed/new window = 5; allowed/existing window = 4; limited = 3. Rate-limit observations are emitted separately from feature observations, so a route can be grouped by limiter cost or its own Redis workload without double-counting them.

## Querying results

In Vercel Runtime Logs, filter for `msg=redis_usage`. Group or filter on `redis_feature`, `redis_logical_operation`, `endpoint`, `rate_limit_outcome`, and `scopes`.

For sampled healthy traffic, sum `redis_estimated_commands` and divide by `redis_observability_sample_rate`. Do **not** scale limited/error rows: they are always retained. This is an estimate for feature attribution, not a replacement for the Upstash account total.

## Measurement table

| Feature | Endpoint | What is measured | Estimated commands | How to interpret |
|---|---|---:|---:|---|
| `rate_limit` | Read-path routes | Sliding-window branch, result and IP scope | 3–5 | Compare endpoint sums to identify the largest limiter cost. |
| `rate_limit` | `/api/coach/analyze`, `/api/games` | Strict write limiter, IP scope | 3–5 | Separate from feature work; IP+wallet callers can incur two observations. |
| `coach_history` | `/api/coach/history` | List hydration, item counts, aggregate cache result | `1 + 2N` ES; `1 + 3N` EN | High values with `N≈20` identify bounded N+1 read amplification. |
| `games_list` | `/api/games` | List hydration and returned games | `1 + N` | Compare with Coach History mounts; both are requested together by the history surface. |
| `coach_credits` | `/api/coach/credits` | Atomic seed plus balance read | 4 first seed; 3 thereafter | `miss` means seed creation; `hit` means marker existed. |
| `coach_analyze` | `/api/coach/analyze` | Idempotency hit or generate/persist path | 1–2 hit; ~18–20 persist | Read with its separate rate-limit row. |
| `coach_analyze` | `/api/coach/job/[id]` | Poll outcome, client poll attempt, terminal state | 1 | High attempts without a terminal state suggest slow/abandoned jobs. |
| `entitlement` | `/api/pro/status` | PRO entitlement lookup | 1 | `miss` normally means no PRO entitlement, not a defect. |

## Privacy contract

`redis_usage` contains only categorical feature/operation/route fields, integer estimates, and aggregate item counts. It does not contain addresses, IPs, Redis keys, tokens, session IDs, request headers, request bodies, or credentials.

## What to observe for 24–72 hours

1. Rank `rate_limit` by `endpoint` and compare estimated totals with Upstash's command total. Look for a small set of endpoints that accounts for most allowed traffic.
2. Compare `coach_history` and `games_list` request count and command estimate. A near 1:1 ratio with both lists near their maximum item count is the strongest case for a future batching decision.
3. Measure Coach History hit/miss and returned-item counts. Do not remove legacy/locale reads until actual fallback use is negligible.
4. Track `coach_credits` misses. A high hit rate with high call volume can justify evaluating a future combined atomic seed/read script; it does not justify weakening the seed guarantee.
5. Track Coach Job `poll_attempt` and terminal state. Optimise polling only if it is a material sustained contributor after its one-GET cost is measured.
6. Keep rate-limit `limited`, `redis_error`, and `redis_timeout` separate. Lower command count is not valid if it broadens abuse, breaks a fail-closed path, or loses IP/wallet scope distinction.

## Verification

Focused Vitest suite passed: 38 tests across the observability helper, rate-limit behaviour, Coach credits route, and Coach job route. TypeScript completed with no errors.
