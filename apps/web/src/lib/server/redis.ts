/**
 * Shared Upstash Redis clients with an EXPLICIT per-command time budget.
 *
 * Why this module exists (incidente 2026-08-03, D0.2):
 * 21 modules were each doing `Redis.fromEnv()` with default options. Those
 * defaults are the direct cause of the timeout column in the Vercel panel.
 * Verified against the INSTALLED SDK (`@upstash/redis@1.37.0`,
 * `node_modules/.pnpm/@upstash+redis@1.37.0/.../chunk-IH7W44G6.mjs`), not from
 * memory:
 *
 *   1. `retry` defaults to `{ attempts: 5, backoff: (n) => Math.exp(n) * 50 }`
 *      and the loop is `for (i = 0; i <= attempts; i++)` → SIX fetch attempts
 *      with ~4.3 s of cumulative sleep. With no timeout, a hung Upstash keeps
 *      the whole function alive until the platform kills it.
 *
 *   2. `signal` accepts `AbortSignal | (() => AbortSignal)` and the client
 *      resolves it as `isSignalFunction ? signal() : signal` ONCE per
 *      `request()`, before the retry loop. Two consequences we depend on:
 *        - the FACTORY form gives a fresh signal per command, so a bounded
 *          budget covers the command *including its retries*. A bare
 *          `AbortSignal` would be shared for the client's whole lifetime and
 *          would permanently poison it after the first abort.
 *        - on abort the client does `if (signal.aborted && isSignalFunction)
 *          throw` — it rethrows. With the NON-factory form it instead
 *          fabricates a `200` response whose body is `{ result: "Aborted" }`,
 *          i.e. a timeout would be indistinguishable from a real value. The
 *          factory form is the only one that fails honestly.
 *
 * So: always the factory form, never a bare signal.
 *
 * Two profiles, because a 1.5 s budget is right for a request handler and
 * wrong for a nightly batch:
 *   - "request" (default) — anything on a user request path.
 *   - "batch"             — cron / backfill, where a slow command is fine and
 *                           an aborted one costs a whole run.
 */

import { Redis } from "@upstash/redis";

/** Hard ceiling for one command on a request path, retries included. Sized to
 *  leave room under the rate-limiter's own 2 s race (see `rate-limit.ts`) so
 *  the abort wins and the failure is classifiable as a timeout. */
export const REDIS_REQUEST_TIMEOUT_MS = 1_500;
/** Cron / backfill budget. Generous on purpose. */
export const REDIS_BATCH_TIMEOUT_MS = 10_000;

/** `retries: 1` → the SDK loop runs at most twice. Kept low deliberately: the
 *  timeout above is the real bound, and a retry ladder is what turned a dead
 *  Upstash into a 4.3 s stall. Not `false`, because a single transient socket
 *  error on a healthy backend should still be absorbed. */
export const REDIS_REQUEST_RETRIES = 1;
export const REDIS_BATCH_RETRIES = 2;

export type RedisProfile = "request" | "batch";

/** One command's abort budget. Extracted so the abort behaviour can be tested
 *  for real at a millisecond scale — `AbortSignal.timeout` is backed by a Node
 *  internal timer that fake timers do not drive. */
export function createTimeoutSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

function buildClient(profile: RedisProfile): Redis {
  const timeoutMs =
    profile === "batch" ? REDIS_BATCH_TIMEOUT_MS : REDIS_REQUEST_TIMEOUT_MS;
  const retries =
    profile === "batch" ? REDIS_BATCH_RETRIES : REDIS_REQUEST_RETRIES;

  return Redis.fromEnv({
    // Factory form — see the module header. Do not "simplify" this to a bare
    // AbortSignal: it would be created once for the client's lifetime and the
    // first timeout would abort every later command forever.
    signal: () => createTimeoutSignal(timeoutMs),
    retry: {
      retries,
      // Flat-ish and capped. The default `Math.exp(n) * 50` is what produced
      // the multi-second stalls.
      backoff: (retryCount: number) => Math.min(100 * 2 ** retryCount, 500),
    },
  });
}

const clients = new Map<RedisProfile, Redis>();

/** Process-wide client for the given profile. Cached so Fluid Compute reuses
 *  the keep-alive pool across concurrent requests on the same instance. */
export function getRedis(profile: RedisProfile = "request"): Redis {
  const cached = clients.get(profile);
  if (cached) return cached;
  const client = buildClient(profile);
  clients.set(profile, client);
  return client;
}

/** An aborted command surfaces as a DOMException named `TimeoutError`
 *  (`AbortSignal.timeout`) or `AbortError`. Everything else is a genuine
 *  backend/transport failure. Callers use this to keep "Upstash was slow"
 *  separate from "Upstash said no". */
export function isRedisTimeout(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name;
  return name === "TimeoutError" || name === "AbortError";
}

/** Test hook. */
export function __resetRedisClients(): void {
  clients.clear();
}
