/**
 * D0.1 + D0.3 — the guard tells the truth, and the buckets are separate.
 *
 * The incident these tests exist for: fourteen routes shared one `rl:read:ip`
 * bucket, and every failure mode — user over quota, Upstash unreachable,
 * Upstash slow — came out of the handler as the same `429 rate_limited`. The
 * error column in the Vercel panel was therefore unreadable.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { beforeEach, describe, expect, it, vi } from "vitest";

type LimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  pending: Promise<unknown>;
  reason?: "timeout" | "cacheBlock" | "denyList";
};

const rl = vi.hoisted(() => ({
  /** Every config the Ratelimit constructor saw, in order. */
  configs: [] as Array<Record<string, unknown>>,
  /** Per-prefix behaviour, so bucket isolation can be exercised for real. */
  limit: vi.fn(
    async (_prefix: string, _identifier: string): Promise<LimitResult> => ({
      success: true,
      limit: 60,
      remaining: 59,
      reset: 0,
      pending: Promise.resolve(),
    }),
  ),
}));

vi.mock("@upstash/ratelimit", () => {
  class FakeRatelimit {
    prefix: string;
    constructor(config: Record<string, unknown>) {
      rl.configs.push(config);
      this.prefix = String(config.prefix);
    }
    limit = (identifier: string) => rl.limit(this.prefix, identifier);
    static slidingWindow = (tokens: number, window: string) => ({
      tokens,
      window,
    });
  }
  return { Ratelimit: FakeRatelimit };
});

vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => ({ __client: true }) },
}));

import {
  RateLimitBackendError,
  RateLimitExceededError,
  __resetRateLimitBuckets,
  checkRateLimit,
  enforceReadRateLimit,
  type RateLimitRoute,
} from "../rate-limit";
import { __resetLoggerSink, __setLoggerSink } from "../logger";

const ALL_ROUTES: RateLimitRoute[] = [
  "pro-status",
  "peones-balance",
  "peones-earn",
  "peones-spend",
  "welcome-pack-status",
  "founder-status",
  "shields-me",
  "coach-credits",
  "coach-history",
  "games-detail",
  "verify-payment",
  "get-peones-canary",
  "payment-intent-get-peones",
  "payment-intent-submission",
];

function ok(): LimitResult {
  return {
    success: true,
    limit: 60,
    remaining: 59,
    reset: 0,
    pending: Promise.resolve(),
  };
}

function denied(): LimitResult {
  return {
    success: false,
    limit: 60,
    remaining: 0,
    reset: 1_700_000_000_000,
    pending: Promise.resolve(),
  };
}

beforeEach(() => {
  __resetRateLimitBuckets();
  rl.configs.length = 0;
  rl.limit.mockReset();
  rl.limit.mockImplementation(async () => ok());
  vi.unstubAllEnvs();
});

describe("outcomes are distinguishable (D0.1)", () => {
  it("a real overflow is `limited` and is refused under BOTH policies", async () => {
    rl.limit.mockImplementation(async () => denied());

    for (const policy of ["fail-open", "fail-closed"] as const) {
      const decision = await checkRateLimit({
        identifier: "1.2.3.4",
        route: "peones-balance",
        policy,
      });
      expect(decision).toMatchObject({ allowed: false, outcome: "limited" });
    }
  });

  it("an Upstash rejection is NOT reported as a rate limit", async () => {
    rl.limit.mockImplementation(async () => {
      throw new Error("ECONNREFUSED");
    });

    const decision = await checkRateLimit({
      identifier: "1.2.3.4",
      route: "peones-balance",
      policy: "fail-open",
    });

    // The whole bug in one assertion: this used to be indistinguishable from
    // the `limited` case above.
    expect(decision.outcome).toBe("redis_error");
    expect(decision.outcome).not.toBe("limited");
    expect(decision.allowed).toBe(true);
  });

  it("an aborted command is `redis_timeout`, separate from `redis_error`", async () => {
    rl.limit.mockImplementation(async () => {
      const err = new Error("The operation was aborted due to timeout");
      err.name = "TimeoutError";
      throw err;
    });

    const decision = await checkRateLimit({
      identifier: "1.2.3.4",
      route: "peones-balance",
      policy: "fail-open",
    });
    expect(decision.outcome).toBe("redis_timeout");
  });

  it("overrules the SDK's silent fail-open when the caller asked fail-closed", async () => {
    // @upstash/ratelimit races Redis against its own timeout and RESOLVES
    // `{ success: true, reason: "timeout" }` on expiry — it decides to fail
    // open on our behalf. A payment route must not inherit that decision.
    rl.limit.mockImplementation(async () => ({ ...ok(), reason: "timeout" }));

    const write = await checkRateLimit({
      identifier: "1.2.3.4",
      route: "verify-payment",
      policy: "fail-closed",
    });
    expect(write).toMatchObject({ allowed: false, outcome: "redis_timeout" });

    const read = await checkRateLimit({
      identifier: "1.2.3.4",
      route: "peones-balance",
      policy: "fail-open",
    });
    expect(read).toMatchObject({ allowed: true, outcome: "redis_timeout" });
  });
});

describe("failure policy", () => {
  it("a low-risk read is served when the limiter cannot answer", async () => {
    rl.limit.mockImplementation(async () => {
      throw new Error("upstash down");
    });

    for (const route of ["peones-balance", "welcome-pack-status", "pro-status"] as const) {
      const decision = await checkRateLimit({
        identifier: "1.2.3.4",
        route,
        policy: "fail-open",
      });
      expect(decision.allowed).toBe(true);
    }
  });

  it("a protected mutation NEVER becomes fail-open on a backend fault", async () => {
    rl.limit.mockImplementation(async () => {
      throw new Error("upstash down");
    });

    const mutations: RateLimitRoute[] = [
      "peones-earn",
      "peones-spend",
      "verify-payment",
      "get-peones-canary",
      "payment-intent-get-peones",
      "payment-intent-submission",
      "coach-credits",
    ];

    for (const route of mutations) {
      const decision = await checkRateLimit({
        identifier: "1.2.3.4",
        route,
        policy: "fail-closed",
      });
      expect(decision.allowed).toBe(false);
      await expect(enforceReadRateLimit("1.2.3.4", route)).rejects.toBeInstanceOf(
        RateLimitBackendError,
      );
    }
  });

  it("enforceReadRateLimit throws types a handler can tell apart", async () => {
    rl.limit.mockImplementation(async () => denied());
    await expect(
      enforceReadRateLimit("1.2.3.4", "peones-earn"),
    ).rejects.toBeInstanceOf(RateLimitExceededError);

    rl.limit.mockImplementation(async () => {
      throw new Error("boom");
    });
    await expect(
      enforceReadRateLimit("1.2.3.4", "peones-earn"),
    ).rejects.toBeInstanceOf(RateLimitBackendError);
  });
});

describe("bucket isolation (D0.3)", () => {
  it("gives every route its own Redis key space", async () => {
    for (const route of ALL_ROUTES) {
      await checkRateLimit({ identifier: "1.2.3.4", route, policy: "fail-open" });
    }

    const prefixes = rl.configs.map((c) => String(c.prefix));
    expect(prefixes).toHaveLength(ALL_ROUTES.length);
    expect(new Set(prefixes).size).toBe(ALL_ROUTES.length);
    // The regression this replaces: a single global `rl:read:ip`.
    expect(prefixes).not.toContain("rl:read:ip");
    for (const route of ALL_ROUTES) {
      expect(prefixes).toContain(`rl:read:${route}:ip`);
    }
  });

  it("MiniPay under CGNAT: fourteen routes do not share one global bucket", async () => {
    // One shared egress IP, one request to each route. Fourteen distinct
    // buckets must be consulted, not fourteen hits on one.
    const sharedIp = "100.64.0.1"; // RFC 6598 carrier-grade NAT space
    for (const route of ALL_ROUTES) {
      await checkRateLimit({ identifier: sharedIp, route, policy: "fail-open" });
    }

    const consulted = rl.limit.mock.calls.map(([prefix]) => prefix);
    expect(new Set(consulted).size).toBe(ALL_ROUTES.length);
  });

  it("exhausting /api/pro/status does not block /api/peones/balance", async () => {
    // Only the pro-status bucket is out of budget.
    rl.limit.mockImplementation(async (prefix) =>
      prefix === "rl:read:pro-status:ip" ? denied() : ok(),
    );

    const pro = await checkRateLimit({
      identifier: "100.64.0.1",
      route: "pro-status",
      policy: "fail-open",
    });
    const balance = await checkRateLimit({
      identifier: "100.64.0.1",
      route: "peones-balance",
      policy: "fail-open",
    });

    expect(pro.allowed).toBe(false);
    expect(balance.allowed).toBe(true);
  });

  it("keeps one limiter instance per route across calls", async () => {
    await checkRateLimit({ identifier: "a", route: "pro-status", policy: "fail-open" });
    await checkRateLimit({ identifier: "b", route: "pro-status", policy: "fail-open" });
    expect(rl.configs).toHaveLength(1);
  });

  it("gives each bucket its own ephemeral cache", async () => {
    await checkRateLimit({ identifier: "a", route: "pro-status", policy: "fail-open" });
    await checkRateLimit({ identifier: "a", route: "peones-balance", policy: "fail-open" });

    const caches = rl.configs.map((c) => c.ephemeralCache);
    expect(caches[0]).toBeInstanceOf(Map);
    expect(caches[0]).not.toBe(caches[1]);
  });

  it("does not relax the limit while separating the buckets", async () => {
    await checkRateLimit({ identifier: "a", route: "pro-status", policy: "fail-open" });
    expect(rl.configs[0]?.limiter).toMatchObject({ tokens: 60, window: "60s" });
  });
});

describe("key shape and expiry", () => {
  beforeEach(() => {
    vi.stubEnv("LOG_SALT", "test-salt");
  });

  it("buckets by a salted digest, never by the raw IP", async () => {
    await checkRateLimit({
      identifier: "203.0.113.7",
      route: "peones-balance",
      policy: "fail-open",
    });

    const [, identifier] = rl.limit.mock.calls[0] ?? [];
    // Upstash used to hold a live list of the addresses that used the app.
    expect(identifier).not.toBe("203.0.113.7");
    expect(identifier).toMatch(/^[0-9a-f]{16}$/);
  });

  it("keeps distinct IPs in distinct buckets after hashing", async () => {
    for (const ip of ["203.0.113.7", "203.0.113.8"]) {
      await checkRateLimit({ identifier: ip, route: "peones-balance", policy: "fail-open" });
    }
    const identifiers = rl.limit.mock.calls.map(([, id]) => id);
    expect(new Set(identifiers).size).toBe(2);
  });

  it("does NOT collapse every client into one bucket when LOG_SALT is absent", async () => {
    // hashIp returns the literal "unsalted" with no salt. Using that as the
    // identifier would put every MiniPay user on the planet in one bucket —
    // strictly worse than the shared-bucket bug being fixed here.
    vi.stubEnv("LOG_SALT", "");
    for (const ip of ["203.0.113.7", "203.0.113.8"]) {
      await checkRateLimit({ identifier: ip, route: "peones-balance", policy: "fail-open" });
    }
    const identifiers = rl.limit.mock.calls.map(([, id]) => id);
    expect(new Set(identifiers).size).toBe(2);
    expect(identifiers).not.toContain("unsalted");
  });

  it("GUARD: the installed limiter script still expires its keys", () => {
    // Not a behavioural test — a source guard over the SDK. `rl:*` keys are
    // only bounded because the sliding-window Lua does PEXPIRE on the first
    // increment of each window. An SDK bump that dropped it would grow the
    // keyspace forever and nothing else here would notice.
    const entry = createRequire(import.meta.url).resolve("@upstash/ratelimit");
    const source = readFileSync(entry, "utf8");

    const start = source.indexOf("var slidingWindowLimitScript");
    expect(start).toBeGreaterThan(-1);
    const script = source.slice(
      start,
      source.indexOf("var slidingWindowRemainingTokensScript"),
    );

    expect(script).toContain("INCRBY");
    expect(script).toContain("PEXPIRE");
    // window * 2 + 1000 — long enough to overlap the next window, finite.
    expect(script).toMatch(/PEXPIRE["\s,]+currentKey/);
  });
});

describe("instrumentation", () => {
  const lines: Array<Record<string, unknown>> = [];

  beforeEach(() => {
    lines.length = 0;
    __setLoggerSink((line) => lines.push(JSON.parse(line)));
    vi.stubEnv("LOG_SALT", "test-salt");
  });

  it("emits endpoint, outcome, duration, deployment and guard status", async () => {
    rl.limit.mockImplementation(async () => denied());
    await checkRateLimit({
      identifier: "203.0.113.7",
      route: "peones-balance",
      policy: "fail-open",
    });

    __resetLoggerSink();
    const line = lines.find((l) => l.msg === "rate_limit_guard");
    expect(line).toBeDefined();
    expect(line).toMatchObject({
      endpoint: "peones-balance",
      outcome: "limited",
      policy: "fail-open",
      guard_status: 429,
    });
    expect(typeof line?.duration_ms).toBe("number");
    expect(line).toHaveProperty("deployment");
  });

  it("never writes the raw identifier — only a salted digest", async () => {
    rl.limit.mockImplementation(async () => denied());
    await checkRateLimit({
      identifier: "203.0.113.7",
      route: "peones-balance",
      policy: "fail-open",
    });
    __resetLoggerSink();

    const serialized = JSON.stringify(lines);
    expect(serialized).not.toContain("203.0.113.7");
    const line = lines.find((l) => l.msg === "rate_limit_guard");
    expect(String(line?.identifier_hash)).toMatch(/^[0-9a-f]{16}$/);
  });

  it("does not log the allowed case by default", async () => {
    await checkRateLimit({
      identifier: "203.0.113.7",
      route: "peones-balance",
      policy: "fail-open",
    });
    __resetLoggerSink();
    expect(lines.filter((l) => l.msg === "rate_limit_guard")).toHaveLength(0);
  });

  it("logs the allowed case when the sample rate is opened up", async () => {
    vi.stubEnv("RATE_LIMIT_LOG_SAMPLE", "1");
    await checkRateLimit({
      identifier: "203.0.113.7",
      route: "peones-balance",
      policy: "fail-open",
    });
    __resetLoggerSink();
    expect(
      lines.find((l) => l.msg === "rate_limit_guard"),
    ).toMatchObject({ outcome: "allowed", guard_status: 200 });
  });

  it("logs a backend fault, so an outage is visible as an outage", async () => {
    rl.limit.mockImplementation(async () => {
      throw new Error("upstash down");
    });
    await checkRateLimit({
      identifier: "203.0.113.7",
      route: "peones-balance",
      policy: "fail-open",
    });
    __resetLoggerSink();

    expect(lines.find((l) => l.msg === "rate_limit_guard")).toMatchObject({
      outcome: "redis_error",
      guard_status: 200,
    });
  });
});
