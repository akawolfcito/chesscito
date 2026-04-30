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
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));

import { GET } from "../route";
import { enforceOrigin, enforceRateLimit } from "@/lib/server/demo-signing";

const mockedOrigin = vi.mocked(enforceOrigin);
const mockedRate = vi.mocked(enforceRateLimit);

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
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
});
