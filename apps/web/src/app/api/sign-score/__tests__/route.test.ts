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
  return new Request("http://localhost/api/sign-score", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/sign-score", () => {
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

  it("returns 200 with the full signature payload on a valid score submission", async () => {
    const signFn = goodConfig();
    const res = await POST(makeRequest({ player: VALID_ADDRESS, levelId: 1, score: 750, timeMs: 12000 }));
    expect(res.status).toEqual(200);
    const body = await res.json();
    expect(body.signature).toEqual("0xsig");
    expect(body.nonce).toEqual("123");
    expect(body.deadline).toEqual("9999999999");
    expect(signFn).toHaveBeenCalledOnce();
  });

  it("returns 403 when enforceOrigin throws Forbidden", async () => {
    mockedOrigin.mockImplementation(() => { throw new Error("Forbidden"); });
    const res = await POST(makeRequest({ player: VALID_ADDRESS, levelId: 1, score: 750, timeMs: 12000 }));
    expect(res.status).toEqual(403);
  });

  it("returns 429 on rate limit", async () => {
    goodConfig();
    mockedRate.mockRejectedValue(new Error("Rate limit exceeded"));
    const res = await POST(makeRequest({ player: VALID_ADDRESS, levelId: 1, score: 750, timeMs: 12000 }));
    expect(res.status).toEqual(429);
  });

  it("returns 400 when the score is out of range", async () => {
    goodConfig();
    mockedInteger
      .mockImplementationOnce((v) => BigInt(v as number)) // levelId OK
      .mockImplementationOnce(() => { throw new Error("Invalid score"); });
    const res = await POST(makeRequest({ player: VALID_ADDRESS, levelId: 1, score: 99999, timeMs: 12000 }));
    expect(res.status).toEqual(400);
    expect((await res.json()).error).toEqual("Invalid score");
  });
});
