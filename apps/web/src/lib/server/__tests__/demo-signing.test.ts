import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

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
      assert.doesNotThrow(() => enforceOrigin(fakeRequest()));
    });
  });

  it("allows requests when no allowed hosts are configured (dev)", () => {
    assert.doesNotThrow(() =>
      enforceOrigin(fakeRequest({ origin: "http://localhost:3000" }))
    );
  });

  it("allows matching origin with VERCEL_PROJECT_PRODUCTION_URL", () => {
    withEnv({ VERCEL_PROJECT_PRODUCTION_URL: "chesscito.vercel.app" }, () => {
      assert.doesNotThrow(() =>
        enforceOrigin(fakeRequest({ origin: "https://chesscito.vercel.app" }))
      );
    });
  });

  it("allows matching origin with NEXT_PUBLIC_APP_URL (with protocol)", () => {
    withEnv({ NEXT_PUBLIC_APP_URL: "https://chesscito.vercel.app" }, () => {
      assert.doesNotThrow(() =>
        enforceOrigin(fakeRequest({ origin: "https://chesscito.vercel.app" }))
      );
    });
  });

  it("allows matching origin with VERCEL_URL (deployment URL)", () => {
    withEnv({ VERCEL_URL: "chesscito-abc123.vercel.app" }, () => {
      assert.doesNotThrow(() =>
        enforceOrigin(fakeRequest({ origin: "https://chesscito-abc123.vercel.app" }))
      );
    });
  });

  it("rejects mismatched origin", () => {
    withEnv({ VERCEL_PROJECT_PRODUCTION_URL: "chesscito.vercel.app" }, () => {
      assert.throws(
        () => enforceOrigin(fakeRequest({ origin: "https://evil.com" })),
        { message: "Forbidden" }
      );
    });
  });

  it("rejects subdomain spoofing (e.g. chesscito.vercel.app.evil.com)", () => {
    withEnv({ VERCEL_PROJECT_PRODUCTION_URL: "chesscito.vercel.app" }, () => {
      assert.throws(
        () => enforceOrigin(fakeRequest({ origin: "https://chesscito.vercel.app.evil.com" })),
        { message: "Forbidden" }
      );
    });
  });

  it("falls back to referer when origin is absent", () => {
    withEnv({ VERCEL_PROJECT_PRODUCTION_URL: "chesscito.vercel.app" }, () => {
      assert.doesNotThrow(() =>
        enforceOrigin(fakeRequest({ referer: "https://chesscito.vercel.app/" }))
      );
    });
  });

  it("rejects malformed URLs", () => {
    withEnv({ VERCEL_PROJECT_PRODUCTION_URL: "chesscito.vercel.app" }, () => {
      assert.throws(
        () => enforceOrigin(fakeRequest({ origin: "not-a-url" })),
        { message: "Forbidden" }
      );
    });
  });

  it("allows when any of multiple env vars match", () => {
    withEnv({
      VERCEL_URL: "chesscito-deploy123.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "chesscito.vercel.app",
    }, () => {
      // Production alias
      assert.doesNotThrow(() =>
        enforceOrigin(fakeRequest({ origin: "https://chesscito.vercel.app" }))
      );
      // Deployment URL
      assert.doesNotThrow(() =>
        enforceOrigin(fakeRequest({ origin: "https://chesscito-deploy123.vercel.app" }))
      );
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
    assert.equal(result, "0xCc4179A22b473Ea2eB2B9b9b210458d0F60Fc2dD");
  });

  it("accepts valid lowercase address and checksums it", () => {
    const result = parseAddress("0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd");
    assert.equal(result, "0xCc4179A22b473Ea2eB2B9b9b210458d0F60Fc2dD");
  });

  it("rejects non-string input", () => {
    assert.throws(() => parseAddress(123), { message: "Invalid player address" });
    assert.throws(() => parseAddress(null), { message: "Invalid player address" });
    assert.throws(() => parseAddress(undefined), { message: "Invalid player address" });
  });

  it("rejects invalid address string", () => {
    assert.throws(() => parseAddress("not-an-address"));
  });
});

// ─── parseInteger ───────────────────────────────────────────────────────────

describe("parseInteger", () => {
  it("accepts valid integer within range", () => {
    assert.equal(parseInteger(5, "test", 1, 10), 5n);
  });

  it("accepts boundary values", () => {
    assert.equal(parseInteger(1, "test", 1, 10), 1n);
    assert.equal(parseInteger(10, "test", 1, 10), 10n);
  });

  it("rejects value below min", () => {
    assert.throws(() => parseInteger(0, "score", 1, 1500), { message: "Invalid score" });
  });

  it("rejects value above max", () => {
    assert.throws(() => parseInteger(1501, "score", 1, 1500), { message: "Invalid score" });
  });

  it("rejects non-integer", () => {
    assert.throws(() => parseInteger(1.5, "test", 1, 10), { message: "Invalid test" });
  });

  it("rejects non-number types", () => {
    assert.throws(() => parseInteger("5", "test", 1, 10), { message: "Invalid test" });
    assert.throws(() => parseInteger(null, "test", 1, 10), { message: "Invalid test" });
  });

  it("validates score range matches game structure (1-1500)", () => {
    // 1 star minimum × 100 pts
    assert.equal(parseInteger(100, "score", 0, 1500), 100n);
    // 15 stars maximum × 100 pts
    assert.equal(parseInteger(1500, "score", 0, 1500), 1500n);
    // Over max
    assert.throws(() => parseInteger(1501, "score", 0, 1500), { message: "Invalid score" });
  });
});

// ─── getRequestIp ───────────────────────────────────────────────────────────

describe("getRequestIp", () => {
  it("extracts IP from x-forwarded-for (first entry)", () => {
    assert.equal(getRequestIp(fakeRequest({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })), "1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    assert.equal(getRequestIp(fakeRequest({ "x-real-ip": "9.8.7.6" })), "9.8.7.6");
  });

  it("returns 'unknown' when no IP headers present", () => {
    assert.equal(getRequestIp(fakeRequest()), "unknown");
  });
});

// ─── createNonce / createDeadline ───────────────────────────────────────────

describe("createNonce", () => {
  it("returns a bigint", () => {
    assert.equal(typeof createNonce(), "bigint");
  });

  it("returns unique values", () => {
    const a = createNonce();
    const b = createNonce();
    assert.notEqual(a, b);
  });
});

describe("createDeadline", () => {
  it("returns a timestamp ~10 minutes in the future", () => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const deadline = createDeadline();
    const diff = deadline - now;
    // Should be between 9 and 11 minutes (account for execution time)
    assert.ok(diff >= 540n && diff <= 660n, `Deadline diff ${diff}s not in expected range`);
  });
});
