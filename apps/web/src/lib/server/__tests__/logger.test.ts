import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { createLogger, hashWallet, __setLoggerSink, __resetLoggerSink } from "../logger.js";

type Sink = (line: string) => void;

let captured: string[];
let mockSink: Sink;

beforeEach(() => {
  captured = [];
  mockSink = (line: string) => captured.push(line);
  __setLoggerSink(mockSink);
});

afterEach(() => {
  __resetLoggerSink();
  vi.unstubAllEnvs();
});

describe("createLogger", () => {
  it("emits a single JSON line per call with level + msg + route + iso timestamp", () => {
    const log = createLogger({ route: "/api/test" });
    log.error("boom");

    expect(captured).toHaveLength(1);
    const parsed = JSON.parse(captured[0]);
    expect(parsed.level).toBe("error");
    expect(parsed.msg).toBe("boom");
    expect(parsed.route).toBe("/api/test");
    expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("supports info / warn / error levels", () => {
    const log = createLogger({ route: "/api/test" });
    log.info("a");
    log.warn("b");
    log.error("c");

    expect(captured).toHaveLength(3);
    expect(JSON.parse(captured[0]).level).toBe("info");
    expect(JSON.parse(captured[1]).level).toBe("warn");
    expect(JSON.parse(captured[2]).level).toBe("error");
  });

  it("merges allow-listed ctx fields into the JSON line", () => {
    const log = createLogger({ route: "/api/verify-pro" });
    log.warn("decode failed", { logIndex: 2, dataSize: 128, txHash: "0xabc" });

    const parsed = JSON.parse(captured[0]);
    expect(parsed.logIndex).toBe(2);
    expect(parsed.dataSize).toBe(128);
    expect(parsed.txHash).toBe("0xabc");
  });

  it("redacts ctx keys whose names match secret-shaped patterns", () => {
    const log = createLogger({ route: "/api/test" });
    log.error("x", {
      signerKey: "0xprivate",
      DRAGON: "secret",
      torrePrincesa: "secret",
      service_role_key: "abc",
      apiToken: "xyz",
      walletAddress: "0xpublic",
    });

    const parsed = JSON.parse(captured[0]);
    expect(parsed.signerKey).toBe("[REDACTED]");
    expect(parsed.DRAGON).toBe("[REDACTED]");
    expect(parsed.torrePrincesa).toBe("[REDACTED]");
    expect(parsed.service_role_key).toBe("[REDACTED]");
    expect(parsed.apiToken).toBe("[REDACTED]");
    expect(parsed.walletAddress).toBe("0xpublic");
  });

  it("serializes BigInt values as strings", () => {
    const log = createLogger({ route: "/api/test" });
    log.info("x", { itemId: 6n, big: 12345678901234567890n });

    const parsed = JSON.parse(captured[0]);
    expect(parsed.itemId).toBe("6");
    expect(parsed.big).toBe("12345678901234567890");
  });

  it("does not crash on circular references; emits fallback line", () => {
    const log = createLogger({ route: "/api/test" });
    const a: Record<string, unknown> = { name: "a" };
    const b: Record<string, unknown> = { name: "b", a };
    a.b = b;

    expect(() => log.error("circular", { a: a as never })).not.toThrow();
    expect(captured).toHaveLength(1);
    const parsed = JSON.parse(captured[0]);
    expect(parsed.msg).toBe("circular");
    expect(parsed.level).toBe("error");
    expect(parsed.ctxError).toBeDefined();
  });

  it("is a no-op when VITEST is set and sink is the real default (regression guard)", () => {
    __resetLoggerSink();
    vi.stubEnv("VITEST", "1");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createLogger({ route: "/api/test" });
    log.error("should-not-emit");
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe("hashWallet", () => {
  beforeEach(() => {
    vi.stubEnv("LOG_SALT", "test-salt-do-not-ship");
  });

  it("returns the same hash for the same wallet", () => {
    const a = hashWallet("0xabc");
    const b = hashWallet("0xabc");
    expect(a).toBe(b);
  });

  it("returns different hashes for different wallets", () => {
    expect(hashWallet("0xabc")).not.toBe(hashWallet("0xdef"));
  });

  it("returns exactly 16 hex chars (red-team P1-8: 64-bit prefix)", () => {
    const out = hashWallet("0x1234567890abcdef1234567890abcdef12345678");
    expect(out).toMatch(/^[0-9a-f]{16}$/);
    expect(out).toHaveLength(16);
  });

  it("throws when LOG_SALT is missing — no silent unsalted fallback", () => {
    vi.stubEnv("LOG_SALT", "");
    expect(() => hashWallet("0xabc")).toThrowError(/LOG_SALT/);
  });
});
