/**
 * D0.2 — the Redis client must have an EXPLICIT, bounded time budget.
 *
 * These tests pin the two SDK behaviours the fix depends on. Both were read
 * out of the installed `@upstash/redis@1.37.0` bundle, not assumed, and both
 * are silent if they regress — a bare signal or a restored default retry
 * ladder produces no type error and no test failure anywhere else.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const fromEnv = vi.hoisted(() =>
  vi.fn((_config?: unknown) => ({ __client: true })),
);
vi.mock("@upstash/redis", () => ({ Redis: { fromEnv } }));

import {
  REDIS_BATCH_TIMEOUT_MS,
  REDIS_REQUEST_RETRIES,
  REDIS_REQUEST_TIMEOUT_MS,
  __resetRedisClients,
  createTimeoutSignal,
  getRedis,
  isRedisTimeout,
} from "../redis";

type Config = {
  signal?: unknown;
  retry?: { retries?: number; backoff?: (n: number) => number };
};

function configOfLastClient(): Config {
  const call = fromEnv.mock.calls.at(-1);
  if (!call) throw new Error("Redis.fromEnv was never called");
  return call[0] as Config;
}

beforeEach(() => {
  __resetRedisClients();
  fromEnv.mockClear();
});

describe("getRedis — bounded per-command budget", () => {
  it("passes a signal FACTORY, not a bare AbortSignal", () => {
    getRedis();
    // Not cosmetic. The SDK resolves `isSignalFunction ? signal() : signal`
    // once per request: a bare signal is created once for the client's whole
    // lifetime, so the first timeout would abort every later command forever.
    // The factory form also rethrows on abort, where the bare form fabricates
    // a 200 response with body `{ result: "Aborted" }` — a timeout that reads
    // as a value.
    expect(typeof configOfLastClient().signal).toBe("function");
  });

  it("hands out a FRESH signal on every call", () => {
    getRedis();
    const factory = configOfLastClient().signal as () => AbortSignal;

    const first = factory();
    const second = factory();

    // Distinct instances, both live. A shared signal would abort the client
    // permanently the first time any command timed out.
    expect(first).not.toBe(second);
    expect(first).toBeInstanceOf(AbortSignal);
    expect(first.aborted).toBe(false);
    expect(second.aborted).toBe(false);
  });

  it("the signal really does abort, bounding the command", async () => {
    // Real timers on purpose: AbortSignal.timeout is driven by a Node internal
    // timer that vitest's fake timers do not advance, so a fake-timer version
    // of this test would pass while asserting nothing.
    const signal = createTimeoutSignal(5);
    expect(signal.aborted).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(signal.aborted).toBe(true);
    // Named so callers can separate "Upstash was slow" from "Upstash said no".
    expect((signal.reason as Error)?.name).toBe("TimeoutError");
    expect(isRedisTimeout(signal.reason)).toBe(true);
  });

  it("bounds retries — no unbounded ladder, and a capped backoff", () => {
    getRedis();
    const { retry } = configOfLastClient();

    // The SDK default is `attempts: 5` with `Math.exp(n) * 50`, i.e. six
    // fetches and ~4.3 s of sleep before it gives up. That ladder is what
    // turned an unreachable Upstash into a stalled function.
    expect(retry?.retries).toBe(REDIS_REQUEST_RETRIES);
    expect(REDIS_REQUEST_RETRIES).toBeLessThanOrEqual(2);

    const backoff = retry?.backoff;
    expect(backoff).toBeTypeOf("function");
    for (const attempt of [0, 1, 2, 5, 10]) {
      expect(backoff?.(attempt)).toBeLessThanOrEqual(500);
    }
  });

  it("gives cron/backfill a longer budget without touching the request one", () => {
    getRedis("batch");
    const batch = configOfLastClient();
    expect(typeof batch.signal).toBe("function");
    expect(REDIS_BATCH_TIMEOUT_MS).toBeGreaterThan(REDIS_REQUEST_TIMEOUT_MS);
  });

  it("caches one client per profile", () => {
    const a = getRedis();
    const b = getRedis();
    const batch = getRedis("batch");

    expect(a).toBe(b);
    expect(a).not.toBe(batch);
    expect(fromEnv).toHaveBeenCalledTimes(2);
  });
});

describe("isRedisTimeout", () => {
  it("recognises an aborted command", () => {
    expect(isRedisTimeout({ name: "TimeoutError" })).toBe(true);
    expect(isRedisTimeout({ name: "AbortError" })).toBe(true);
  });

  it("does not swallow genuine backend errors as timeouts", () => {
    expect(isRedisTimeout(new Error("ECONNREFUSED"))).toBe(false);
    expect(isRedisTimeout(null)).toBe(false);
    expect(isRedisTimeout(undefined)).toBe(false);
  });
});
