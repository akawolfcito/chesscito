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
  getBlockNumber: vi.fn(),
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
const DEPLOY_BLOCK = 37_800_000n;
// Latest just above deploy so the full range fits in 2 chunks (range=10001).
const LATEST_BLOCK = DEPLOY_BLOCK + 10_001n;

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
    // Default: a small range so tests don't need many chunks.
    clientMock.getBlockNumber.mockResolvedValue(LATEST_BLOCK);
    clientMock.getLogs.mockResolvedValue([]);
  });

  it("returns ownsFounder=true when Shop logs match in the first chunk", async () => {
    clientMock.getLogs.mockResolvedValueOnce([
      { blockNumber: 37_809_000n },
      { blockNumber: 37_810_000n },
    ]);

    const res = await GET(makeRequest(VALID_WALLET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ownsFounder).toBe(true);
    expect(body.since).toBe(37_809_000); // earliest block
    expect(redisMock.set).toHaveBeenCalledWith(
      `founder:${VALID_WALLET}`,
      JSON.stringify({ ownsFounder: true, since: 37_809_000 }),
      { ex: 24 * 60 * 60 },
    );
  });

  it("returns ownsFounder=false when no matching logs are found in any chunk", async () => {
    // All getLogs calls return empty (default mock).
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

  it("invokes enforceReadRateLimit (lenient, 60/min) not the strict limiter", async () => {
    await GET(makeRequest(VALID_WALLET));
    expect(enforceReadRateLimit).toHaveBeenCalledTimes(1);
  });

  // The pagination always respects the deploy block as the lower scan floor.
  describe("fromBlock / deploy block", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("never scans below SHOP_DEPLOY_BLOCK_FALLBACK (default)", async () => {
      vi.stubEnv("SHOP_DEPLOY_BLOCK_CELO", "");
      await GET(makeRequest(VALID_WALLET));
      // Every getLogs call must have fromBlock >= deployBlock.
      for (const call of clientMock.getLogs.mock.calls) {
        expect(call[0].fromBlock >= DEPLOY_BLOCK).toBe(true);
      }
    });

    it("falls back to hardcoded bigint when SHOP_DEPLOY_BLOCK_CELO is invalid", async () => {
      vi.stubEnv("SHOP_DEPLOY_BLOCK_CELO", "not-a-number");
      await GET(makeRequest(VALID_WALLET));
      for (const call of clientMock.getLogs.mock.calls) {
        expect(call[0].fromBlock >= DEPLOY_BLOCK).toBe(true);
      }
    });

    it("honors a valid SHOP_DEPLOY_BLOCK_CELO override as the scan floor", async () => {
      const customDeploy = 12345n;
      vi.stubEnv("SHOP_DEPLOY_BLOCK_CELO", "12345");
      // Latest still just above the default deploy — the custom deploy is lower,
      // so all chunks should still be >= 12345.
      await GET(makeRequest(VALID_WALLET));
      for (const call of clientMock.getLogs.mock.calls) {
        expect(call[0].fromBlock >= customDeploy).toBe(true);
      }
    });

    it("stops paginating at deployBlock (does not scan below it)", async () => {
      await GET(makeRequest(VALID_WALLET));
      // With LATEST=DEPLOY+10001 and CHUNK=5000, we need 3 chunks max.
      // Last chunk must have fromBlock = deployBlock.
      const calls = clientMock.getLogs.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.fromBlock).toBe(DEPLOY_BLOCK);
    });
  });

  // The route now uses FOUNDER_STATUS_RPC_URL (or Forno) — not CELO_RPC_URL.
  describe("FOUNDER_STATUS_RPC_URL transport", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("passes FOUNDER_STATUS_RPC_URL to viem.http() when set", async () => {
      vi.resetModules();
      vi.stubEnv("FOUNDER_STATUS_RPC_URL", "https://custom-founder-rpc.example.com");
      httpMock.mockClear();
      await import("../route");
      expect(httpMock).toHaveBeenCalledWith("https://custom-founder-rpc.example.com");
    });

    it("falls back to Forno when FOUNDER_STATUS_RPC_URL is unset", async () => {
      vi.resetModules();
      vi.stubEnv("FOUNDER_STATUS_RPC_URL", "");
      httpMock.mockClear();
      await import("../route");
      expect(httpMock).toHaveBeenCalledWith("https://forno.celo.org");
    });
  });
});
