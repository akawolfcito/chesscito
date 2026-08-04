/**
 * Read-path rate limiting: per-endpoint buckets, honest outcomes, explicit
 * failure policy. (D0.1 + D0.3 of the 2026-08-03 invocations hotfix.)
 *
 * ── What was wrong ────────────────────────────────────────────────────────
 *
 * 1. ONE bucket for FOURTEEN routes. `demo-signing.ts` built a single
 *    `rl:read:ip` limiter at 60 req/min/IP and every read endpoint shared it.
 *    Behind carrier-grade NAT — the normal case for MiniPay on mobile data —
 *    many players share one egress IP, and a six-request bootstrap × a handful
 *    of players drains the minute's budget for everyone on that IP. The limit
 *    was never the problem; the SHARING was.
 *
 * 2. Every failure looked like a rate limit. Call sites did
 *    `try { await enforceReadRateLimit(ip) } catch { return 429 }`, which
 *    conflates "this identifier exceeded the limit" with "Upstash is
 *    unreachable". Both arrive as a thrown error; both left as 429.
 *
 *    The masking mechanism is real, and verified against the installed SDKs:
 *    `@upstash/ratelimit@2.0.8` races the Redis call against its own `timeout`
 *    (default 5000 ms) and, on expiry, RESOLVES with
 *    `{ success: true, reason: "timeout" }` — it fails open silently. But
 *    `@upstash/redis@1.37.0` defaults to six attempts with `Math.exp(n) * 50`
 *    backoff, so a hard transport error finishes at ~4.3 s — just under that
 *    5 s race — and REJECTS instead. The rejection reached the call site's
 *    catch and became a 429.
 *
 *    IMPORTANT (founder checked the Upstash console, 2026-08-03): that path is
 *    a latent defect, NOT the cause of the observed 17% error rate. Upstash is
 *    at 140K/500K monthly commands, ~2–5 cmd/s, service latency ~0 ms, no
 *    connection exhaustion. So the 429s in the panel are REAL rate limits —
 *    a shared bucket plus CGNAT, i.e. cause (1) above. This module fixes (1)
 *    and closes (2) as defense, in that order of importance.
 *
 * ── The limiter's actual cost, per call ───────────────────────────────────
 *
 * `Ratelimit.slidingWindow(60, "60s")`, single region. One `limit()` is ONE
 * HTTP round-trip — an `EVALSHA` of the sliding-window Lua script (`EVAL`
 * only on the NOSCRIPT fallback, i.e. after a Redis restart). Inside that
 * script, server-side:
 *
 *   allowed  → GET current, GET previous, INCRBY current, and PEXPIRE current
 *              ONLY on the first request of a window          (1 round-trip)
 *   blocked  → GET current, GET previous, then early return   (1 round-trip)
 *   cached   → 0 round-trips: `ephemeralCache` answers in-process for an
 *              identifier already blocked on this instance
 *
 * That matches the command mix on the console (GET / INCRBY / EVALSHA /
 * PEXPIRE / EVAL) and means the guard is NOT what makes Redis expensive —
 * one command per request, and zero for a repeat offender.
 *
 * ── Key shape and expiry ──────────────────────────────────────────────────
 *
 *   rl:read:{route}:ip:{sha256(ip + LOG_SALT)[0..16]}:{windowNumber}
 *
 * The script sets `PEXPIRE currentKey, window*2 + 1000` (121 s for a 60 s
 * window) on the window's first increment, so every `rl:*` key expires; a
 * blocked request returns before `INCRBY` and never creates a key at all.
 * `__tests__/rate-limit.test.ts` reads the installed script and fails if that
 * PEXPIRE ever disappears — an SDK bump that dropped it would grow the
 * keyspace forever, silently.
 *
 * ── What this module guarantees ───────────────────────────────────────────
 *
 *   - one Redis key space per route (`rl:read:{route}:ip`);
 *   - four distinguishable outcomes: allowed | limited | redis_error |
 *     redis_timeout;
 *   - the caller states its failure policy, and the policy is what decides
 *     whether a backend fault lets the request through. Nothing is implicit.
 *
 * `checkRateLimit` never throws. `enforceReadRateLimit` throws typed errors
 * for the fail-closed call sites that still prefer try/catch.
 */

import { Ratelimit } from "@upstash/ratelimit";

import { createLogger, hashIp } from "./logger";
import { getRedis, isRedisTimeout } from "./redis";

/**
 * Every read endpoint that takes the lenient limiter, as a closed union.
 *
 * Deliberately not `string`: the slug is what separates the buckets, so a typo
 * would silently recreate the shared-bucket bug this module exists to kill.
 * Adding a route here is a conscious act.
 */
export type RateLimitRoute =
  | "pro-status"
  | "peones-balance"
  | "peones-earn"
  | "peones-spend"
  | "welcome-pack-status"
  | "founder-status"
  | "shields-me"
  | "coach-credits"
  | "coach-history"
  | "games-detail"
  | "verify-payment"
  | "get-peones-canary"
  | "payment-intent-get-peones"
  | "payment-intent-submission";

/** What actually happened inside the guard. */
export type GuardOutcome = "allowed" | "limited" | "redis_error" | "redis_timeout";

/**
 * What to do when the LIMITER ITSELF fails (not when the user is over quota).
 *
 *  - "fail-open"   : serve the request. Only for low-risk reads, where the
 *                    worst case of an Upstash outage is unmetered reads.
 *  - "fail-closed" : refuse. For writes, purchases, claims, spends and rewards,
 *                    where serving unmetered is a real risk.
 */
export type BackendFailurePolicy = "fail-open" | "fail-closed";

export type RateLimitDecision = {
  allowed: boolean;
  outcome: GuardOutcome;
  /** Populated for `limited`; useful for a Retry-After if a caller wants one. */
  resetAt: number | null;
};

/** The identifier genuinely exceeded its budget. The ONLY error that may
 *  become a 429. */
export class RateLimitExceededError extends Error {
  readonly outcome = "limited" as const;
  constructor(readonly route: RateLimitRoute) {
    super(`Rate limit exceeded (${route})`);
    this.name = "RateLimitExceededError";
  }
}

/** The limiter could not reach a verdict. NOT a rate limit — do not report it
 *  as one. */
export class RateLimitBackendError extends Error {
  constructor(
    readonly route: RateLimitRoute,
    readonly outcome: "redis_error" | "redis_timeout",
  ) {
    super(`Rate limit backend unavailable (${route}: ${outcome})`);
    this.name = "RateLimitBackendError";
  }
}

/** Unchanged from the previous implementation — this hotfix does not relax
 *  any limit, it only stops fourteen routes from sharing one. */
const MAX_READ_REQUESTS_PER_IP = 60;

/** Backstop race inside the limiter. Above the Redis per-command budget
 *  (1.5 s) on purpose: the client's own abort should normally fire first, so a
 *  stall is classified as `redis_timeout` by name rather than by this race. */
const GUARD_TIMEOUT_MS = 2_000;

const log = createLogger({ route: "server/rate-limit" });

type Bucket = { limiter: Ratelimit; cache: Map<string, number> };
const buckets = new Map<RateLimitRoute, Bucket>();

function bucketFor(route: RateLimitRoute): Bucket {
  const cached = buckets.get(route);
  if (cached) return cached;

  // Its own Map per route. The SDK keys the ephemeral cache by the prefixed
  // key, so one shared Map would probably be fine — "probably" is not a good
  // enough answer for the isolation property this module is asserting.
  const cache = new Map<string, number>();
  const limiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(MAX_READ_REQUESTS_PER_IP, "60s"),
    prefix: `rl:read:${route}:ip`,
    // In-instance memory of already-blocked identifiers. During a storm this
    // answers without a Redis round-trip at all, which is both cheaper and one
    // less chance to hang.
    ephemeralCache: cache,
    timeout: GUARD_TIMEOUT_MS,
  });

  const bucket = { limiter, cache };
  buckets.set(route, bucket);
  return bucket;
}

let unsaltedIdentifierWarned = false;

/**
 * The value that actually becomes part of the Redis key.
 *
 * Until now the raw client IP was written into the key space, so Upstash held
 * a live list of the IPs that used the app. A salted digest buckets exactly as
 * well — the limiter only needs equality, never the address itself.
 *
 * The fallback matters: `hashIp` returns the literal `"unsalted"` when
 * LOG_SALT is missing, and using that here would collapse EVERY client into a
 * single bucket — a far worse version of the bug this module exists to fix. So
 * correctness does not depend on an env var: without a salt we keep bucketing
 * by the raw identifier and make the privacy regression loud instead of
 * trading availability for it.
 */
function rateLimitIdentifier(ip: string): string {
  const hashed = hashIp(ip);
  if (hashed !== "unsalted") return hashed;
  if (!unsaltedIdentifierWarned) {
    unsaltedIdentifierWarned = true;
    log.error("rate_limit_identifier_unsalted", {
      detail:
        "LOG_SALT is missing — rate-limit keys fall back to the raw IP so buckets stay separate. Set LOG_SALT to stop writing addresses into Redis.",
    });
  }
  return ip;
}

/**
 * Sampling for the `allowed` case only.
 *
 * `limited` and the two backend outcomes are ALWAYS logged — they are the
 * signal. Logging every allowed request too would mean ~82K lines per 12 h,
 * which is the same kind of per-event cost we are here to remove. Set
 * `RATE_LIMIT_LOG_SAMPLE` (0..1) to widen the window while measuring.
 */
function allowedSampleRate(): number {
  const raw = Number.parseFloat(process.env.RATE_LIMIT_LOG_SAMPLE ?? "");
  if (!Number.isFinite(raw) || raw < 0 || raw > 1) return 0;
  return raw;
}

function emitGuardLine(input: {
  route: RateLimitRoute;
  identifier: string;
  outcome: GuardOutcome;
  durationMs: number;
  policy: BackendFailurePolicy;
  allowed: boolean;
}): void {
  if (input.outcome === "allowed" && Math.random() >= allowedSampleRate()) return;

  // Deliberately absent: full IP, wallet, tokens, cookies, signatures. The
  // identifier travels only as a salted 64-bit digest.
  log.info("rate_limit_guard", {
    endpoint: input.route,
    outcome: input.outcome,
    duration_ms: input.durationMs,
    policy: input.policy,
    guard_status: input.allowed ? 200 : 429,
    identifier_hash: hashIp(input.identifier),
    deployment: process.env.VERCEL_DEPLOYMENT_ID ?? "local",
    env: process.env.VERCEL_ENV ?? "development",
    mode: process.env.NEXT_PUBLIC_CHESSCITO_MODE ?? "unknown",
  });
}

/**
 * The guard. Never throws — the decision, including a backend fault, comes
 * back as data.
 */
export async function checkRateLimit(input: {
  identifier: string;
  route: RateLimitRoute;
  policy: BackendFailurePolicy;
}): Promise<RateLimitDecision> {
  const { identifier, route, policy } = input;
  const startedAt = Date.now();

  let outcome: GuardOutcome;
  let allowed: boolean;
  let resetAt: number | null = null;

  try {
    // Hashed, never the raw address — see `rateLimitIdentifier`.
    const result = await bucketFor(route).limiter.limit(
      rateLimitIdentifier(identifier),
    );

    if (result.reason === "timeout") {
      // The SDK's own race won. It resolves `success: true` in this case —
      // i.e. it has already decided to fail open. We overrule it when the
      // caller asked for fail-closed: a purchase endpoint must not be served
      // unmetered just because the limiter gave up.
      outcome = "redis_timeout";
      allowed = policy === "fail-open";
    } else if (!result.success) {
      outcome = "limited";
      allowed = false;
      resetAt = result.reset ?? null;
    } else {
      outcome = "allowed";
      allowed = true;
    }
  } catch (error) {
    outcome = isRedisTimeout(error) ? "redis_timeout" : "redis_error";
    allowed = policy === "fail-open";
  }

  emitGuardLine({
    route,
    identifier,
    outcome,
    durationMs: Date.now() - startedAt,
    policy,
    allowed,
  });

  return { allowed, outcome, resetAt };
}

/**
 * Fail-closed wrapper for the call sites that keep a try/catch shape.
 *
 * Throws {@link RateLimitExceededError} for a real overflow and
 * {@link RateLimitBackendError} for an outage, so a handler that wants to tell
 * them apart can, and one that does not keeps refusing both — which is the
 * correct default for a write.
 */
export async function enforceReadRateLimit(
  identifier: string,
  route: RateLimitRoute,
): Promise<void> {
  const decision = await checkRateLimit({
    identifier,
    route,
    policy: "fail-closed",
  });
  if (decision.allowed) return;
  if (decision.outcome === "limited") throw new RateLimitExceededError(route);
  throw new RateLimitBackendError(
    route,
    decision.outcome === "redis_timeout" ? "redis_timeout" : "redis_error",
  );
}

/** Test hook — drops the per-route limiters and their ephemeral caches. */
export function __resetRateLimitBuckets(): void {
  buckets.clear();
}
