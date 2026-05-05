import { describe, it, expect, vi, beforeEach } from "vitest";

// Redis from upstash — the route imports it at module load. Mock it
// before importing the route so the real Redis.fromEnv() doesn't fire.
// Use vi.hoisted so the ref exists when the mock factory runs.
const redisMock = vi.hoisted(() => ({
  eval: vi.fn(),
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

const mockedOrigin = vi.mocked(enforceOrigin);
const mockedRate = vi.mocked(enforceReadRateLimit);

const VALID_WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";

function makeRequest(url: string) {
  return new Request(url, { method: "GET" });
}

describe("GET /api/coach/credits", () => {
  beforeEach(() => {
    mockedOrigin.mockReset();
    mockedRate.mockReset();
    redisMock.eval.mockReset();
    redisMock.get.mockReset();

    mockedOrigin.mockImplementation(() => {});
    mockedRate.mockResolvedValue(undefined);
    redisMock.eval.mockResolvedValue(1);
    redisMock.get.mockResolvedValue(3);
  });

  it("returns 200 with the credits count on a valid wallet query", async () => {
    const res = await GET(makeRequest(`http://localhost/api/coach/credits?wallet=${VALID_WALLET}`));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ credits: 3 });
  });

  it("seeds the free-credits Lua script on first query", async () => {
    await GET(makeRequest(`http://localhost/api/coach/credits?wallet=${VALID_WALLET}`));
    expect(redisMock.eval).toHaveBeenCalledOnce();
    // ARGV[1] must be the free-credit seed amount
    const argv = redisMock.eval.mock.calls[0][2];
    expect(argv).toEqual([3]);
  });

  it("returns 0 credits when the Redis key is absent", async () => {
    redisMock.get.mockResolvedValue(null);
    const res = await GET(makeRequest(`http://localhost/api/coach/credits?wallet=${VALID_WALLET}`));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ credits: 0 });
  });

  it("returns 403 when enforceOrigin rejects", async () => {
    mockedOrigin.mockImplementation(() => { throw new Error("Forbidden"); });
    const res = await GET(makeRequest(`http://localhost/api/coach/credits?wallet=${VALID_WALLET}`));
    expect(res.status).toEqual(403);
  });

  it("returns 403 when rate limit is exceeded", async () => {
    mockedRate.mockRejectedValue(new Error("Rate limit exceeded"));
    const res = await GET(makeRequest(`http://localhost/api/coach/credits?wallet=${VALID_WALLET}`));
    expect(res.status).toEqual(403);
  });

  it("returns 400 when the wallet query param is missing", async () => {
    const res = await GET(makeRequest("http://localhost/api/coach/credits"));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when the wallet address is malformed", async () => {
    const res = await GET(makeRequest("http://localhost/api/coach/credits?wallet=0xnope"));
    expect(res.status).toEqual(400);
  });
});
