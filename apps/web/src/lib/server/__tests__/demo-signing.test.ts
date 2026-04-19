import { describe, it, beforeEach, afterEach, expect } from "vitest";

import {
  enforceOrigin,
  parseAddress,
  parseInteger,
  getRequestIp,
  createNonce,
  createDeadline,
} from "../demo-signing.js";

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
  const ENV_KEYS = ["NEXT_PUBLIC_APP_URL", "VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL"] as const;
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
    withEnv({ VERCEL_PROJECT_PRODUCTION_URL: "chesscito.vercel.app" }, () => {
      expect(() => enforceOrigin(fakeRequest())).not.toThrow();
    });
  });

  it("allows requests when no allowed hosts are configured (dev)", () => {
    expect(() =>
      enforceOrigin(fakeRequest({ origin: "http://localhost:3000" }))).not.toThrow();
  });

  it("allows matching origin with VERCEL_PROJECT_PRODUCTION_URL", () => {
    withEnv({ VERCEL_PROJECT_PRODUCTION_URL: "chesscito.vercel.app" }, () => {
      expect(() =>
        enforceOrigin(fakeRequest({ origin: "https://chesscito.vercel.app" }))).not.toThrow();
    });
  });

  it("allows matching origin with NEXT_PUBLIC_APP_URL (with protocol)", () => {
    withEnv({ NEXT_PUBLIC_APP_URL: "https://chesscito.vercel.app" }, () => {
      expect(() =>
        enforceOrigin(fakeRequest({ origin: "https://chesscito.vercel.app" }))).not.toThrow();
    });
  });

  it("allows matching origin with VERCEL_URL (deployment URL)", () => {
    withEnv({ VERCEL_URL: "chesscito-abc123.vercel.app" }, () => {
      expect(() =>
        enforceOrigin(fakeRequest({ origin: "https://chesscito-abc123.vercel.app" }))).not.toThrow();
    });
  });

  it("rejects mismatched origin", () => {
    withEnv({ VERCEL_PROJECT_PRODUCTION_URL: "chesscito.vercel.app" }, () => {
      expect(() => enforceOrigin(fakeRequest({ origin: "https://evil.com" }))).toThrow("Forbidden");
    });
  });

  it("rejects subdomain spoofing (e.g. chesscito.vercel.app.evil.com)", () => {
    withEnv({ VERCEL_PROJECT_PRODUCTION_URL: "chesscito.vercel.app" }, () => {
      expect(() => enforceOrigin(fakeRequest({ origin: "https://chesscito.vercel.app.evil.com" }))).toThrow("Forbidden");
    });
  });

  it("falls back to referer when origin is absent", () => {
    withEnv({ VERCEL_PROJECT_PRODUCTION_URL: "chesscito.vercel.app" }, () => {
      expect(() =>
        enforceOrigin(fakeRequest({ referer: "https://chesscito.vercel.app/" }))).not.toThrow();
    });
  });

  it("rejects malformed URLs", () => {
    withEnv({ VERCEL_PROJECT_PRODUCTION_URL: "chesscito.vercel.app" }, () => {
      expect(() => enforceOrigin(fakeRequest({ origin: "not-a-url" }))).toThrow("Forbidden");
    });
  });

  it("allows when any of multiple env vars match", () => {
    withEnv({
      VERCEL_URL: "chesscito-deploy123.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "chesscito.vercel.app",
    }, () => {
      // Production alias
      expect(() =>
        enforceOrigin(fakeRequest({ origin: "https://chesscito.vercel.app" }))).not.toThrow();
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
