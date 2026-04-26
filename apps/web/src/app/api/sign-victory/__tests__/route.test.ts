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

/** Real chess transcripts used as test fixtures. We rely on the actual
 *  chess.js engine — no mock — so the route's replay path is exercised
 *  end-to-end. */
const SCHOLARS_MATE_BY_WHITE = ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"];
const FOOLS_MATE_BY_BLACK = ["f3", "e5", "g4", "Qh4#"];

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

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    player: VALID_ADDRESS,
    difficulty: 1,
    moveHistory: SCHOLARS_MATE_BY_WHITE,
    playerColor: "w",
    timeMs: 11583,
    ...overrides,
  };
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

  describe("happy path", () => {
    it("returns 200 with signature when scholar's mate by white is verified", async () => {
      const signFn = goodConfig();
      const res = await POST(makeRequest(validBody()));
      expect(res.status).toEqual(200);
      const body = await res.json();
      expect(body).toEqual({
        nonce: "123",
        deadline: "9999999999",
        signature: "0xsig",
        totalMoves: "7",
      });
      expect(signFn).toHaveBeenCalledOnce();
    });

    it("derives totalMoves from moveHistory.length and signs that value (not a client-provided value)", async () => {
      const signFn = goodConfig();
      // Even if a client tries to smuggle a totalMoves field, the route
      // ignores it — derived value comes from chess.js replay.
      const body = validBody({ totalMoves: 999 });
      const res = await POST(makeRequest(body));
      expect(res.status).toEqual(200);
      const signedPayload = signFn.mock.calls[0][2] as { totalMoves: bigint };
      expect(signedPayload.totalMoves).toBe(BigInt(SCHOLARS_MATE_BY_WHITE.length));
    });

    it("accepts fool's mate by black", async () => {
      goodConfig();
      const res = await POST(
        makeRequest(validBody({ moveHistory: FOOLS_MATE_BY_BLACK, playerColor: "b" })),
      );
      expect(res.status).toEqual(200);
      expect((await res.json()).totalMoves).toBe("4");
    });
  });

  describe("transcript validation", () => {
    it("returns 400 when moveHistory contains an illegal SAN", async () => {
      goodConfig();
      const res = await POST(
        makeRequest(validBody({ moveHistory: ["e4", "ZZZ"] })),
      );
      expect(res.status).toEqual(400);
      expect((await res.json()).error).toEqual("Illegal move in transcript");
    });

    it("returns 400 when the transcript does not end in checkmate", async () => {
      goodConfig();
      const res = await POST(
        makeRequest(validBody({ moveHistory: ["e4"] })),
      );
      expect(res.status).toEqual(400);
      expect((await res.json()).error).toEqual("Transcript does not end in checkmate");
    });

    it("returns 400 when the player did not deliver the mating move (wrong color claim)", async () => {
      goodConfig();
      // Scholar's mate is delivered by white, but client claims they were black.
      const res = await POST(
        makeRequest(validBody({ playerColor: "b" })),
      );
      expect(res.status).toEqual(400);
      expect((await res.json()).error).toEqual("Player did not deliver the mating move");
    });

    it("returns 400 when moveHistory exceeds the 300-move cap", async () => {
      goodConfig();
      const oversized = Array.from({ length: 301 }, () => "e4");
      const res = await POST(makeRequest(validBody({ moveHistory: oversized })));
      expect(res.status).toEqual(400);
      expect((await res.json()).error).toMatch(/exceeds 300/);
    });

    it("returns 400 when moveHistory is empty", async () => {
      goodConfig();
      const res = await POST(makeRequest(validBody({ moveHistory: [] })));
      expect(res.status).toEqual(400);
      expect((await res.json()).error).toMatch(/at least one move/);
    });

    it("returns 400 when moveHistory is not an array", async () => {
      goodConfig();
      const res = await POST(makeRequest(validBody({ moveHistory: "e4 e5 Bc4" })));
      expect(res.status).toEqual(400);
      expect((await res.json()).error).toMatch(/must be an array/);
    });

    it("returns 400 when a SAN entry is not a string", async () => {
      goodConfig();
      const res = await POST(
        makeRequest(validBody({ moveHistory: ["e4", 42] })),
      );
      expect(res.status).toEqual(400);
      expect((await res.json()).error).toMatch(/Invalid SAN/);
    });

    it("returns 400 when a SAN entry exceeds the 12-char cap", async () => {
      goodConfig();
      const res = await POST(
        makeRequest(validBody({ moveHistory: ["e4", "x".repeat(13)] })),
      );
      expect(res.status).toEqual(400);
      expect((await res.json()).error).toMatch(/Invalid SAN/);
    });

    it("returns 400 when playerColor is missing", async () => {
      goodConfig();
      const res = await POST(makeRequest(validBody({ playerColor: undefined })));
      expect(res.status).toEqual(400);
      expect((await res.json()).error).toMatch(/playerColor/);
    });

    it("returns 400 when playerColor is invalid", async () => {
      goodConfig();
      const res = await POST(makeRequest(validBody({ playerColor: "x" })));
      expect(res.status).toEqual(400);
      expect((await res.json()).error).toMatch(/playerColor/);
    });
  });

  describe("preserved guards", () => {
    it("returns 403 when enforceOrigin throws Forbidden", async () => {
      mockedOrigin.mockImplementation(() => {
        throw new Error("Forbidden");
      });
      const res = await POST(makeRequest(validBody()));
      expect(res.status).toEqual(403);
      expect((await res.json()).error).toEqual("Forbidden");
    });

    it("returns 429 when rate limit is exceeded", async () => {
      goodConfig();
      mockedRate.mockRejectedValue(new Error("Rate limit exceeded"));
      const res = await POST(makeRequest(validBody()));
      expect(res.status).toEqual(429);
      expect((await res.json()).error).toEqual("Rate limit exceeded");
    });

    it("returns 400 when parseAddress throws on an invalid player", async () => {
      mockedAddress.mockImplementation(() => {
        throw new Error("Invalid player address");
      });
      const res = await POST(makeRequest(validBody({ player: "0xnot-an-address" })));
      expect(res.status).toEqual(400);
      expect((await res.json()).error).toEqual("Invalid player address");
    });

    it("returns 400 when parseInteger rejects an out-of-range timeMs", async () => {
      goodConfig();
      mockedInteger
        .mockImplementationOnce((v) => BigInt(v as number)) // difficulty ok
        .mockImplementationOnce(() => { throw new Error("timeMs must be between 1 and 3600000"); });
      const res = await POST(makeRequest(validBody({ timeMs: 99_999_999 })));
      expect(res.status).toEqual(400);
      expect((await res.json()).error).toEqual("timeMs must be between 1 and 3600000");
    });

    it("returns 400 with a generic message on unexpected non-Error throws", async () => {
      goodConfig();
      mockedRate.mockRejectedValue("boom" as unknown as Error);
      const res = await POST(makeRequest(validBody()));
      expect(res.status).toEqual(400);
      expect((await res.json()).error).toEqual("Could not sign victory claim");
    });
  });
});
