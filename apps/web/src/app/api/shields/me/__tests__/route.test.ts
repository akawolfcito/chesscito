import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redisMock = vi.hoisted(() => ({
  get: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => redisMock },
}));

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceReadRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));

import { GET } from "../route";
import {
  enforceOrigin,
  enforceReadRateLimit,
} from "@/lib/server/demo-signing";

const mockedOrigin = vi.mocked(enforceOrigin);
const mockedRate = vi.mocked(enforceReadRateLimit);

const VALID_WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";

function makeRequest(query: string) {
  return new Request(`http://localhost/api/shields/me?${query}`);
}

describe("GET /api/shields/me", () => {
  beforeEach(() => {
    mockedOrigin.mockReset();
    mockedRate.mockReset();
    redisMock.get.mockReset();

    mockedOrigin.mockImplementation(() => {});
    mockedRate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("AC10: unknown wallet returns credited: 0", async () => {
    redisMock.get.mockResolvedValue(null);
    const res = await GET(makeRequest(`wallet=${VALID_WALLET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, credited: 0 });
  });

  it("AC11: returns the stored credited count for a known wallet", async () => {
    redisMock.get.mockResolvedValue("33");
    const res = await GET(makeRequest(`wallet=${VALID_WALLET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, credited: 33 });
    expect(redisMock.get).toHaveBeenCalledWith(
      `coach:shields:credited:${VALID_WALLET}`,
    );
  });

  it("AC12: uses the read rate-limit bucket (independent from write bucket)", async () => {
    redisMock.get.mockResolvedValue("3");
    await GET(makeRequest(`wallet=${VALID_WALLET}`));
    expect(mockedRate).toHaveBeenCalledTimes(1);
  });

  it("returns 400 missing_params when wallet query is absent", async () => {
    const res = await GET(makeRequest(""));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: "missing_params",
    });
  });

  it("returns 400 invalid_wallet when wallet is malformed", async () => {
    const res = await GET(makeRequest("wallet=0xnope"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: "invalid_wallet",
    });
  });

  it("returns 403 origin_blocked when enforceOrigin throws", async () => {
    mockedOrigin.mockImplementation(() => {
      throw new Error("Forbidden");
    });
    const res = await GET(makeRequest(`wallet=${VALID_WALLET}`));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      ok: false,
      error: "origin_blocked",
    });
  });

  it("returns 429 rate_limited when enforceReadRateLimit throws", async () => {
    mockedRate.mockRejectedValue(new Error("Rate limit exceeded"));
    const res = await GET(makeRequest(`wallet=${VALID_WALLET}`));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      ok: false,
      error: "rate_limited",
    });
  });

  it("returns 500 internal on unexpected redis failure", async () => {
    redisMock.get.mockRejectedValue(new Error("redis down"));
    const res = await GET(makeRequest(`wallet=${VALID_WALLET}`));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "internal" });
  });

  it("normalizes wallet to lowercase before redis lookup (checksummed input)", async () => {
    redisMock.get.mockResolvedValue("5");
    // EIP-55 checksummed form of VALID_WALLET — viem isAddress accepts
    // it; route must still hit the lowercase redis key.
    const checksummed = "0xCc4179A22b473Ea2eB2B9b9b210458d0F60Fc2dD";
    await GET(makeRequest(`wallet=${checksummed}`));
    expect(redisMock.get).toHaveBeenCalledWith(
      `coach:shields:credited:${VALID_WALLET}`,
    );
  });

  it("returns 0 when stored value is corrupted (non-numeric)", async () => {
    redisMock.get.mockResolvedValue("garbage");
    const res = await GET(makeRequest(`wallet=${VALID_WALLET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, credited: 0 });
  });
});
