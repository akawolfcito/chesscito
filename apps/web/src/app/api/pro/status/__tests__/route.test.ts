import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const redisMock = vi.hoisted(() => ({
  get: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => redisMock },
}));

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceRateLimit: vi.fn(),
  enforceReadRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));

import { GET } from "../route";
import { enforceOrigin, enforceReadRateLimit } from "@/lib/server/demo-signing";
import { __setLoggerSink, __resetLoggerSink } from "@/lib/server/logger";

const mockedOrigin = vi.mocked(enforceOrigin);
const mockedRate = vi.mocked(enforceReadRateLimit);

let logLines: Array<{ level: string; record: Record<string, unknown> }>;

const VALID_WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";

function makeRequest(query: string) {
  return new Request(`http://localhost/api/pro/status${query}`, {
    method: "GET",
  });
}

describe("GET /api/pro/status", () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    mockedOrigin.mockReset();
    mockedRate.mockReset();
    redisMock.get.mockReset();

    mockedOrigin.mockImplementation(() => {});
    mockedRate.mockResolvedValue(undefined);
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    logLines = [];
    __setLoggerSink((line, level) => {
      logLines.push({ level, record: JSON.parse(line) });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    __resetLoggerSink();
  });

  it("returns active=true with expiresAt when PRO is in the future", async () => {
    const expiresAt = NOW + 7 * 24 * 60 * 60 * 1000;
    redisMock.get.mockResolvedValue(String(expiresAt));

    const res = await GET(makeRequest(`?wallet=${VALID_WALLET}`));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ active: true, expiresAt });
  });

  it("returns active=false with expiresAt=null when PRO key does not exist", async () => {
    redisMock.get.mockResolvedValue(null);

    const res = await GET(makeRequest(`?wallet=${VALID_WALLET}`));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ active: false, expiresAt: null });
  });

  it("returns active=false with the past expiresAt when PRO has lapsed (Redis still serving stale value)", async () => {
    const expiresAt = NOW - 1;
    redisMock.get.mockResolvedValue(String(expiresAt));

    const res = await GET(makeRequest(`?wallet=${VALID_WALLET}`));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ active: false, expiresAt });
  });

  it("returns 400 when the wallet query param is missing", async () => {
    const res = await GET(makeRequest(""));
    expect(res.status).toEqual(400);
    expect(await res.json()).toEqual({ error: "Invalid wallet" });
  });

  it("returns 400 when the wallet is malformed", async () => {
    const res = await GET(makeRequest(`?wallet=0xnope`));
    expect(res.status).toEqual(400);
    expect(await res.json()).toEqual({ error: "Invalid wallet" });
  });

  it("returns 403 when enforceOrigin throws (unknown origin)", async () => {
    mockedOrigin.mockImplementation(() => { throw new Error("forbidden"); });

    const res = await GET(makeRequest(`?wallet=${VALID_WALLET}`));
    expect(res.status).toEqual(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("logs a warn line with errName when auth is rejected (intended security control)", async () => {
    mockedOrigin.mockImplementation(() => { throw new Error("origin-mismatch"); });

    const res = await GET(makeRequest(`?wallet=${VALID_WALLET}`));
    expect(res.status).toEqual(403);

    const warn = logLines.find((l) => l.level === "warn" && l.record.msg === "auth rejected");
    expect(warn).toBeDefined();
    expect(warn?.record.errMessage).toBe("origin-mismatch");
  });

  it("returns 500 and logs an error line when isProActive (Redis) throws", async () => {
    redisMock.get.mockRejectedValue(new Error("redis-down"));

    const res = await GET(makeRequest(`?wallet=${VALID_WALLET}`));
    expect(res.status).toEqual(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });

    const err = logLines.find((l) => l.level === "error" && l.record.msg === "isProActive threw");
    expect(err).toBeDefined();
    expect(err?.record.errMessage).toBe("redis-down");
    expect(err?.record.wallet).toBe(VALID_WALLET);
  });
});
