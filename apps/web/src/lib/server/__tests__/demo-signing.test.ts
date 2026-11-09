import { describe, it, beforeEach, afterEach, expect } from "vitest";

import {
  enforceOrigin,
  parseAddress,
  parseInteger,
  getRequestIp,
  createNonce,
  createDeadline,
} from "../demo-signing.js";
import { __setLoggerSink, __resetLoggerSink } from "../logger.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fakeRequest(headers: Record<string, string> = {}): Request {
  return { headers: new Headers(headers) } as unknown as Request;
}

/** Save and restore env vars touched by enforceOrigin */
function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
  const keys = Object.keys(overrides);
  const saved: Record<string, string | undefined> = {};
  for (const k of keys) saved[k] = process.env[k];
  Object.assign(process.env, overrides);
  try {
    fn();
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

// ─── enforceOrigin ──────────────────────────────────────────────────────────

describe("enforceOrigin", () => {
  const ENV_KEYS = [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_PREVIEW_URL",
    "VERCEL_URL",
    "VERCEL_BRANCH_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
  ] as const;
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {};
    for (const k of ENV_KEYS) {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  it("allows requests with no origin/referer (MiniPay WebView)", () => {
    withEnv({ VERCEL_PROJECT_PRODUCTION_URL: "chesscito.com" }, () => {
      expect(() => enforceOrigin(fakeRequest())).not.toThrow();
    });
  });

  it("allows requests when no allowed hosts are configured (dev)", () => {
    expect(() =>
      enforceOrigin(fakeRequest({ origin: "http://localhost:3000" }))).not.toThrow();
  });

  it("allows matching origin with VERCEL_PROJECT_PRODUCTION_URL", () => {
    withEnv({ VERCEL_PROJECT_PRODUCTION_URL: "chesscito.com" }, () => {
      expect(() =>
        enforceOrigin(fakeRequest({ origin: "https://chesscito.com" }))).not.toThrow();
    });
  });

  it("allows matching origin with NEXT_PUBLIC_APP_URL (with protocol)", () => {
    withEnv({ NEXT_PUBLIC_APP_URL: "https://chesscito.com" }, () => {
      expect(() =>
        enforceOrigin(fakeRequest({ origin: "https://chesscito.com" }))).not.toThrow();
    });
  });

  it("preserves host-only semantics when protocols differ", () => {
    withEnv({ NEXT_PUBLIC_APP_URL: "https://localhost:3002" }, () => {
      expect(() =>
        enforceOrigin(fakeRequest({ origin: "http://localhost:3002" }))).not.toThrow();
    });
  });

  it("rejects a matching hostname on a different port", () => {
    withEnv({ NEXT_PUBLIC_APP_URL: "https://localhost:3002" }, () => {
      expect(() =>
        enforceOrigin(fakeRequest({ origin: "http://localhost:3000" }))).toThrow("Forbidden");
    });
  });

  it("allows matching origin with VERCEL_URL (deployment URL)", () => {
    withEnv({ VERCEL_URL: "chesscito-abc123.vercel.app" }, () => {
      expect(() =>
        enforceOrigin(fakeRequest({ origin: "https://chesscito-abc123.vercel.app" }))).not.toThrow();
    });
  });

  it("allows matching origin with NEXT_PUBLIC_PREVIEW_URL (custom preview alias)", () => {
    withEnv({ NEXT_PUBLIC_PREVIEW_URL: "preview.chesscito.com" }, () => {
      expect(() =>
        enforceOrigin(fakeRequest({ origin: "https://preview.chesscito.com" }))).not.toThrow();
    });
  });

  it("allows matching origin with VERCEL_BRANCH_URL (branch alias)", () => {
    withEnv({ VERCEL_BRANCH_URL: "chesscito-git-main-wolfcito.vercel.app" }, () => {
      expect(() =>
        enforceOrigin(fakeRequest({ origin: "https://chesscito-git-main-wolfcito.vercel.app" }))).not.toThrow();
    });
  });

  it("rejects mismatched origin", () => {
    withEnv({ VERCEL_PROJECT_PRODUCTION_URL: "chesscito.com" }, () => {
      expect(() => enforceOrigin(fakeRequest({ origin: "https://evil.com" }))).toThrow("Forbidden");
    });
  });

  it("rejects subdomain spoofing (e.g. chesscito.com.evil.com)", () => {
    withEnv({ VERCEL_PROJECT_PRODUCTION_URL: "chesscito.com" }, () => {
      expect(() => enforceOrigin(fakeRequest({ origin: "https://chesscito.com.evil.com" }))).toThrow("Forbidden");
    });
  });

  it("falls back to referer when origin is absent", () => {
    withEnv({ VERCEL_PROJECT_PRODUCTION_URL: "chesscito.com" }, () => {
      expect(() =>
        enforceOrigin(fakeRequest({ referer: "https://chesscito.com/" }))).not.toThrow();
    });
  });

  it("rejects malformed URLs", () => {
    withEnv({ VERCEL_PROJECT_PRODUCTION_URL: "chesscito.com" }, () => {
      expect(() => enforceOrigin(fakeRequest({ origin: "not-a-url" }))).toThrow("Forbidden");
    });
  });

  it("allows when any of multiple env vars match", () => {
    withEnv({
      VERCEL_URL: "chesscito-deploy123.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "chesscito.com",
    }, () => {
      // Production alias
      expect(() =>
        enforceOrigin(fakeRequest({ origin: "https://chesscito.com" }))).not.toThrow();
      // Deployment URL
      expect(() =>
        enforceOrigin(fakeRequest({ origin: "https://chesscito-deploy123.vercel.app" }))).not.toThrow();
    });
  });
});

// ─── enforceRateLimit ───────────────────────────────────────────────────────
// Rate limiting now uses Upstash Redis (persistent across cold starts).
// Tests require live Redis connection — validated in production, not unit tests.

// ─── parseAddress ───────────────────────────────────────────────────────────

describe("parseAddress", () => {
  it("accepts valid checksummed address", () => {
    const result = parseAddress("0xCc4179A22b473Ea2eB2B9b9b210458d0F60Fc2dD");
    expect(result).toEqual("0xCc4179A22b473Ea2eB2B9b9b210458d0F60Fc2dD");
  });

  it("accepts valid lowercase address and checksums it", () => {
    const result = parseAddress("0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd");
    expect(result).toEqual("0xCc4179A22b473Ea2eB2B9b9b210458d0F60Fc2dD");
  });

  it("rejects non-string input", () => {
    expect(() => parseAddress(123)).toThrow("Invalid player address");
    expect(() => parseAddress(null)).toThrow("Invalid player address");
    expect(() => parseAddress(undefined)).toThrow("Invalid player address");
  });

  it("rejects invalid address string", () => {
    expect(() => parseAddress("not-an-address")).toThrow();
  });
});

// ─── parseInteger ───────────────────────────────────────────────────────────

describe("parseInteger", () => {
  it("accepts valid integer within range", () => {
    expect(parseInteger(5, "test", 1, 10)).toEqual(5n);
  });

  it("accepts boundary values", () => {
    expect(parseInteger(1, "test", 1, 10)).toEqual(1n);
    expect(parseInteger(10, "test", 1, 10)).toEqual(10n);
  });

  it("rejects value below min", () => {
    expect(() => parseInteger(0, "score", 1, 1500)).toThrow("Invalid score");
  });

  it("rejects value above max", () => {
    expect(() => parseInteger(1501, "score", 1, 1500)).toThrow("Invalid score");
  });

  it("rejects non-integer", () => {
    expect(() => parseInteger(1.5, "test", 1, 10)).toThrow("Invalid test");
  });

  it("rejects non-number types", () => {
    expect(() => parseInteger("5", "test", 1, 10)).toThrow("Invalid test");
    expect(() => parseInteger(null, "test", 1, 10)).toThrow("Invalid test");
  });

  it("validates score range matches game structure (1-1500)", () => {
    // 1 star minimum × 100 pts
    expect(parseInteger(100, "score", 0, 1500)).toEqual(100n);
    // 15 stars maximum × 100 pts
    expect(parseInteger(1500, "score", 0, 1500)).toEqual(1500n);
    // Over max
    expect(() => parseInteger(1501, "score", 0, 1500)).toThrow("Invalid score");
  });
});

// ─── getRequestIp ───────────────────────────────────────────────────────────

describe("getRequestIp", () => {
  it("extracts IP from x-forwarded-for (first entry)", () => {
    expect(getRequestIp(fakeRequest({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toEqual("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    expect(getRequestIp(fakeRequest({ "x-real-ip": "9.8.7.6" }))).toEqual("9.8.7.6");
  });

  it("returns 'unknown' when no IP headers present", () => {
    expect(getRequestIp(fakeRequest())).toEqual("unknown");
  });
});

// ─── createNonce / createDeadline ───────────────────────────────────────────

describe("createNonce", () => {
  it("returns a bigint", () => {
    expect(typeof createNonce()).toEqual("bigint");
  });

  it("returns unique values", () => {
    const a = createNonce();
    const b = createNonce();
    expect(a).not.toEqual(b);
  });
});

describe("createDeadline", () => {
  it("returns a timestamp ~10 minutes in the future", () => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const deadline = createDeadline();
    const diff = deadline - now;
    // Should be between 9 and 11 minutes (account for execution time)
    expect(diff >= 540n && diff <= 660n).toBeTruthy();
  });
});

// ─── enforceOrigin telemetry rollout (red-team P0-W2) ───────────────────────

describe("enforceOrigin telemetry rollout", () => {
  let captured: string[];
  const savedVercelEnv = process.env.VERCEL_ENV;

  beforeEach(() => {
    captured = [];
    __setLoggerSink((line) => captured.push(line));
  });

  afterEach(() => {
    __resetLoggerSink();
    if (savedVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = savedVercelEnv;
  });

  function makeReq(url: string, method: string, headers: Record<string, string> = {}): Request {
    return new Request(url, { method, headers });
  }

  it("logs origin_bypass_triggered when bypass fires in production-like env", () => {
    process.env.VERCEL_ENV = "production";
    // Bypass: no origin AND no referer.
    enforceOrigin(makeReq("https://chesscito.com/api/sign-victory", "POST", { "user-agent": "MiniPay-WebView/1.0" }));

    expect(captured).toHaveLength(1);
    const parsed = JSON.parse(captured[0]);
    expect(parsed.level).toBe("warn");
    expect(parsed.msg).toBe("origin_bypass_triggered");
    expect(parsed.route).toBe("demo-signing.enforceOrigin");
    expect(parsed.method).toBe("POST");
    expect(parsed.path).toBe("/api/sign-victory");
    expect(parsed.user_agent).toBe("MiniPay-WebView/1.0");
  });

  it("does NOT log when bypass fires in local dev (no VERCEL_ENV)", () => {
    delete process.env.VERCEL_ENV;
    enforceOrigin(makeReq("http://localhost:3000/api/anything", "POST"));
    expect(captured).toHaveLength(0);
  });

  it("does NOT log when origin is present (no bypass)", () => {
    process.env.VERCEL_ENV = "production";
    // Allowlist NOT configured, so the request is admitted via the dev-fallback
    // path — but still NOT via the bypass branch. Telemetry must stay silent.
    enforceOrigin(makeReq("https://chesscito.com/api/x", "POST", { origin: "https://chesscito.com" }));
    expect(captured).toHaveLength(0);
  });

  it("bypass STILL admits the request (behavior unchanged — observability only)", () => {
    process.env.VERCEL_ENV = "production";
    expect(() =>
      enforceOrigin(makeReq("https://chesscito.com/api/sign-victory", "POST")),
    ).not.toThrow();
  });

  it("caps user_agent at 200 chars to keep log lines bounded", () => {
    process.env.VERCEL_ENV = "production";
    const longUa = "A".repeat(500);
    enforceOrigin(makeReq("https://chesscito.com/api/x", "POST", { "user-agent": longUa }));
    const parsed = JSON.parse(captured[0]);
    expect(parsed.user_agent.length).toBe(200);
  });
});
