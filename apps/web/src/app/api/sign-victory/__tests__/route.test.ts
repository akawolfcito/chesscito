import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
  parseAddress: vi.fn(),
  parseInteger: vi.fn(),
  createNonce: vi.fn(() => 123n),
  createDeadline: vi.fn(() => 9999999999n),
  getDemoConfig: vi.fn(),
}));

import { POST } from "../route";
import {
  enforceOrigin,
  enforceRateLimit,
  parseAddress,
  parseInteger,
  getDemoConfig,
} from "@/lib/server/demo-signing";

const mockedOrigin = vi.mocked(enforceOrigin);
const mockedRate = vi.mocked(enforceRateLimit);
const mockedAddress = vi.mocked(parseAddress);
const mockedInteger = vi.mocked(parseInteger);
const mockedConfig = vi.mocked(getDemoConfig);

const VALID_ADDRESS = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd" as const;

function goodConfig() {
  const signTypedData = vi.fn().mockResolvedValue("0xsig");
  mockedConfig.mockReturnValue({
    chainId: 11142220,
    badgesAddress: "0xf92759E52aA5EC5d6fDb6CE03b9AC9Cd9f000001",
    scoreboardAddress: "0x1681aAA12aA5EC5d6fDb6CE03b9AC9Cd9f000002",
    victoryNFTAddress: "0x87cC9fe03E76A5894De2FE1372E85D6f5Bb922A9",
    signer: { signTypedData } as unknown as ReturnType<typeof getDemoConfig>["signer"],
  });
  return signTypedData;
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/sign-victory", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/sign-victory", () => {
  beforeEach(() => {
    mockedOrigin.mockReset();
    mockedRate.mockReset();
    mockedAddress.mockReset();
    mockedInteger.mockReset();
    mockedConfig.mockReset();
    // Defaults: allow
    mockedOrigin.mockImplementation(() => {});
    mockedRate.mockResolvedValue(undefined);
    mockedAddress.mockReturnValue(VALID_ADDRESS);
    mockedInteger.mockImplementation((v) => BigInt(v as number));
  });

  it("returns 200 with a signature payload on a valid request", async () => {
    const signFn = goodConfig();
    const req = makeRequest({ player: VALID_ADDRESS, difficulty: 1, totalMoves: 13, timeMs: 11583 });
    const res = await POST(req);
    expect(res.status).toEqual(200);
    const body = await res.json();
    expect(body).toEqual({
      nonce: "123",
      deadline: "9999999999",
      signature: "0xsig",
    });
    expect(signFn).toHaveBeenCalledOnce();
  });

  it("returns 403 when enforceOrigin throws Forbidden", async () => {
    mockedOrigin.mockImplementation(() => {
      throw new Error("Forbidden");
    });
    const res = await POST(makeRequest({ player: VALID_ADDRESS, difficulty: 1, totalMoves: 13, timeMs: 11583 }));
    expect(res.status).toEqual(403);
    expect((await res.json()).error).toEqual("Forbidden");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    goodConfig();
    mockedRate.mockRejectedValue(new Error("Rate limit exceeded"));
    const res = await POST(makeRequest({ player: VALID_ADDRESS, difficulty: 1, totalMoves: 13, timeMs: 11583 }));
    expect(res.status).toEqual(429);
    expect((await res.json()).error).toEqual("Rate limit exceeded");
  });

  it("returns 400 when parseAddress throws on an invalid player", async () => {
    mockedAddress.mockImplementation(() => {
      throw new Error("Invalid player address");
    });
    const res = await POST(makeRequest({ player: "0xnot-an-address", difficulty: 1, totalMoves: 13, timeMs: 11583 }));
    expect(res.status).toEqual(400);
    expect((await res.json()).error).toEqual("Invalid player address");
  });

  it("returns 400 when parseInteger rejects an out-of-range field", async () => {
    goodConfig();
    mockedInteger.mockImplementationOnce((v) => BigInt(v as number)) // difficulty ok
      .mockImplementationOnce(() => { throw new Error("totalMoves must be between 1 and 10000"); });
    const res = await POST(makeRequest({ player: VALID_ADDRESS, difficulty: 1, totalMoves: 99999, timeMs: 11583 }));
    expect(res.status).toEqual(400);
    expect((await res.json()).error).toEqual("totalMoves must be between 1 and 10000");
  });

  it("returns 400 with a generic message on unexpected non-Error throws", async () => {
    goodConfig();
    mockedRate.mockRejectedValue("boom" as unknown as Error);
    const res = await POST(makeRequest({ player: VALID_ADDRESS, difficulty: 1, totalMoves: 13, timeMs: 11583 }));
    expect(res.status).toEqual(400);
    expect((await res.json()).error).toEqual("Could not sign victory claim");
  });
});
