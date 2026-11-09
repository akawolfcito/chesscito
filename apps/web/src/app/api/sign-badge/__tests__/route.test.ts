import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
  parseAddress: vi.fn(),
  parseInteger: vi.fn(),
  createNonce: vi.fn(() => 42n),
  createDeadline: vi.fn(() => 1234567890n),
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
  const signTypedData = vi.fn().mockResolvedValue("0xbadgesig");
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
  return new Request("http://localhost/api/sign-badge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/sign-badge", () => {
  beforeEach(() => {
    mockedOrigin.mockReset();
    mockedRate.mockReset();
    mockedAddress.mockReset();
    mockedInteger.mockReset();
    mockedConfig.mockReset();
    mockedOrigin.mockImplementation(() => {});
    mockedRate.mockResolvedValue(undefined);
    mockedAddress.mockReturnValue(VALID_ADDRESS);
    mockedInteger.mockImplementation((v) => BigInt(v as number));
  });

  it("returns 200 with badge signature payload", async () => {
    const signFn = goodConfig();
    const res = await POST(makeRequest({ player: VALID_ADDRESS, levelId: 2 }));
    expect(res.status).toEqual(200);
    const body = await res.json();
    expect(body.signature).toEqual("0xbadgesig");
    expect(body.levelId).toEqual("2");
    expect(body.nonce).toEqual("42");
    expect(signFn).toHaveBeenCalledOnce();
  });

  it("returns 403 when enforceOrigin throws", async () => {
    mockedOrigin.mockImplementation(() => { throw new Error("Forbidden"); });
    const res = await POST(makeRequest({ player: VALID_ADDRESS, levelId: 2 }));
    expect(res.status).toEqual(403);
  });

  it("returns 429 on rate limit", async () => {
    goodConfig();
    mockedRate.mockRejectedValue(new Error("Rate limit exceeded"));
    const res = await POST(makeRequest({ player: VALID_ADDRESS, levelId: 2 }));
    expect(res.status).toEqual(429);
  });

  it("returns 400 when levelId is out of range", async () => {
    goodConfig();
    mockedInteger.mockImplementation(() => { throw new Error("Invalid levelId"); });
    const res = await POST(makeRequest({ player: VALID_ADDRESS, levelId: 99999 }));
    expect(res.status).toEqual(400);
  });
});
