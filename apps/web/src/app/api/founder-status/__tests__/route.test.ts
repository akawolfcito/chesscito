import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// SHOP_ADDRESS captured at module import — set before route loads.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SHOP_ADDRESS = "0x1234567890123456789012345678901234567890";
});

const redisMock = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => redisMock },
}));

const clientMock = vi.hoisted(() => ({
  getLogs: vi.fn(),
}));
const httpMock = vi.hoisted(() => vi.fn(() => ({})));
vi.mock("viem", async () => {
  const actual = await vi.importActual<typeof import("viem")>("viem");
  return {
    ...actual,
    createPublicClient: () => clientMock,
    http: httpMock,
  };
});

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

const VALID_WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";

function makeRequest(wallet: string | null) {
  const url = wallet
    ? `https://chesscito.com/api/founder-status?wallet=${wallet}`
    : `https://chesscito.com/api/founder-status`;
  return new Request(url, { method: "GET" });
}

describe("/api/founder-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.get.mockResolvedValue(null);
    redisMock.set.mockResolvedValue("OK");
  });

  it("returns ownsFounder=true when Shop logs match the wallet + founder itemId", async () => {
    clientMock.getLogs.mockResolvedValueOnce([
      { blockNumber: 50_000_000n },
      { blockNumber: 51_000_000n },
    ]);

    const res = await GET(makeRequest(VALID_WALLET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ownsFounder).toBe(true);
    expect(body.since).toBe(50_000_000); // earliest block
    expect(redisMock.set).toHaveBeenCalledWith(
      `founder:${VALID_WALLET}`,
      JSON.stringify({ ownsFounder: true, since: 50_000_000 }),
      { ex: 24 * 60 * 60 },
    );
  });

  it("returns ownsFounder=false when no matching logs are found", async () => {
    clientMock.getLogs.mockResolvedValueOnce([]);

    const res = await GET(makeRequest(VALID_WALLET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ownsFounder).toBe(false);
    expect(body.since).toBeNull();
  });

  it("short-circuits the chain read when the Redis cache holds a prior result", async () => {
    redisMock.get.mockResolvedValueOnce({
      ownsFounder: true,
      since: 49_900_000,
    });

    const res = await GET(makeRequest(VALID_WALLET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ownsFounder: true, since: 49_900_000 });
    expect(clientMock.getLogs).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid wallet input", async () => {
    const res = await GET(makeRequest("not-a-wallet"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid wallet");
    expect(clientMock.getLogs).not.toHaveBeenCalled();
  });

  it("returns 403 when origin check throws", async () => {
    vi.mocked(enforceOrigin).mockImplementationOnce(() => {
      throw new Error("Forbidden");
    });

    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toBe(403);
    expect(clientMock.getLogs).not.toHaveBeenCalled();
  });

  it("returns 200 + stale=true and caches for 5min when getLogs throws", async () => {
    clientMock.getLogs.mockRejectedValueOnce(new Error("rpc down"));

    const res = await GET(makeRequest(VALID_WALLET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ownsFounder: false, since: null, stale: true });
    expect(redisMock.set).toHaveBeenCalledWith(
      `founder:${VALID_WALLET}`,
      JSON.stringify({ ownsFounder: false, since: null, stale: true }),
      { ex: 5 * 60 },
    );
  });

  // Ensure the rate-limiter is exercised — defense against a regression
  // that swaps `enforceReadRateLimit` for the strict (5/min) variant.
  it("invokes enforceReadRateLimit (lenient, 60/min) not the strict limiter", async () => {
    clientMock.getLogs.mockResolvedValueOnce([]);
    await GET(makeRequest(VALID_WALLET));
    expect(enforceReadRateLimit).toHaveBeenCalledTimes(1);
  });

  // Forno rejects unbounded ranges; the route MUST send a bigint
  // fromBlock derived from SHOP_DEPLOY_BLOCK_CELO or the hardcoded
  // fallback, never the previous "earliest" string.
  describe("fromBlock fallback", () => {
    const SHOP_DEPLOY_BLOCK_FALLBACK = 37_800_000n;

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("uses the hardcoded bigint fallback when SHOP_DEPLOY_BLOCK_CELO is unset", async () => {
      vi.stubEnv("SHOP_DEPLOY_BLOCK_CELO", "");
      clientMock.getLogs.mockResolvedValueOnce([]);
      await GET(makeRequest(VALID_WALLET));
      const call = clientMock.getLogs.mock.calls[0][0];
      expect(call.fromBlock).not.toBe("earliest");
      expect(typeof call.fromBlock).toBe("bigint");
      expect(call.fromBlock).toBe(SHOP_DEPLOY_BLOCK_FALLBACK);
    });

    it("falls back to the hardcoded bigint when SHOP_DEPLOY_BLOCK_CELO is invalid", async () => {
      vi.stubEnv("SHOP_DEPLOY_BLOCK_CELO", "not-a-number");
      clientMock.getLogs.mockResolvedValueOnce([]);
      await GET(makeRequest(VALID_WALLET));
      const call = clientMock.getLogs.mock.calls[0][0];
      expect(typeof call.fromBlock).toBe("bigint");
      expect(call.fromBlock).toBe(SHOP_DEPLOY_BLOCK_FALLBACK);
    });

    it("honors a valid SHOP_DEPLOY_BLOCK_CELO override", async () => {
      vi.stubEnv("SHOP_DEPLOY_BLOCK_CELO", "12345");
      clientMock.getLogs.mockResolvedValueOnce([]);
      await GET(makeRequest(VALID_WALLET));
      const call = clientMock.getLogs.mock.calls[0][0];
      expect(call.fromBlock).toBe(12345n);
    });
  });

  // The route reads CELO_RPC_URL at module load to build its viem
  // transport. `vi.resetModules()` + re-import lets us assert on the
  // env-driven branch without polluting the top-level `GET` import the
  // rest of the suite relies on.
  describe("CELO_RPC_URL transport", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("passes CELO_RPC_URL to viem.http() when the env var is set", async () => {
      vi.resetModules();
      vi.stubEnv("CELO_RPC_URL", "https://custom-rpc.example.com");
      httpMock.mockClear();
      await import("../route");
      expect(httpMock).toHaveBeenCalledWith("https://custom-rpc.example.com");
    });

    it("falls back to viem.http(undefined) (default Forno) when unset", async () => {
      vi.resetModules();
      vi.stubEnv("CELO_RPC_URL", "");
      httpMock.mockClear();
      await import("../route");
      expect(httpMock).toHaveBeenCalledWith(undefined);
    });
  });
});
