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

    /**
     * Save Later contract (2026-05-31): the route signs ANY transcript
     * that replays into a valid mate by the claimed colour. No
     * timestamp / freshness / age field exists in the body schema, so
     * a user can sign a victory from a match they played yesterday or
     * months ago. Documents-as-code regression guard for the Save Later
     * cluster — if a `gameAge`/`maxAge` field is ever added that
     * rejects past matches, this assertion fails and forces a deliberate
     * cluster revisit.
     */
    it("Save Later: accepts arbitrary past games (no time-window guard in body schema)", async () => {
      const signFn = goodConfig();
      const res = await POST(makeRequest(validBody()));
      expect(res.status).toEqual(200);
      const signedPayload = signFn.mock.calls[0][2] as Record<string, unknown>;
      // The signed EIP-712 payload exposes the public surface; no
      // freshness field should leak in. If a new freshness key appears,
      // confirm intentionally by updating this allowlist.
      expect(Object.keys(signedPayload).sort()).toEqual(
        [
          "player",
          "difficulty",
          "totalMoves",
          "timeMs",
          "nonce",
          "deadline",
        ].sort(),
      );
    });
  });

  // F8 phase (a) — any legal outcome is saveable, not just wins. The route
  // replays for LEGALITY only; the checkmate / mate-by-player asserts are gone.
  describe("F8 — any-outcome saving", () => {
    const LEGAL_NON_MATE = ["e4", "e5", "Nf3", "Nc6"]; // legal, no checkmate

    it("signs a legal NON-checkmate transcript (draw/lose/resign games)", async () => {
      const signFn = goodConfig();
      const res = await POST(makeRequest(validBody({ moveHistory: LEGAL_NON_MATE })));
      expect(res.status).toEqual(200);
      expect((await res.json()).totalMoves).toBe("4");
      expect(signFn).toHaveBeenCalledOnce();
    });

    it("still rejects an illegal move in a non-win transcript", async () => {
      goodConfig();
      const res = await POST(
        makeRequest(validBody({ moveHistory: ["e4", "e5", "ZZZ"] })),
      );
      expect(res.status).toEqual(400);
      expect((await res.json()).error).toEqual("Illegal move in transcript");
    });

    it("rejects an implausibly fast cadence (heuristic #1)", async () => {
      goodConfig();
      // 4 moves in 500ms → < 4 * 250ms floor → refused before signing.
      const res = await POST(
        makeRequest(validBody({ moveHistory: LEGAL_NON_MATE, timeMs: 500 })),
      );
      expect(res.status).toEqual(400);
      expect((await res.json()).error).toMatch(/cadence/i);
    });

    it("accepts a plausible cadence at the floor", async () => {
      goodConfig();
      // 4 moves, 4 * 250 = 1000ms is exactly the floor → allowed.
      const res = await POST(
        makeRequest(validBody({ moveHistory: LEGAL_NON_MATE, timeMs: 1000 })),
      );
      expect(res.status).toEqual(200);
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

    // F8 (2026-06-14): the checkmate requirement was removed — a legal
    // non-mate transcript now signs (was 400 "does not end in checkmate").
    it("signs a legal non-mate transcript (no longer requires checkmate)", async () => {
      goodConfig();
      const res = await POST(
        makeRequest(validBody({ moveHistory: ["e4", "e5"], timeMs: 11583 })),
      );
      expect(res.status).toEqual(200);
      expect((await res.json()).totalMoves).toBe("2");
    });

    // F8: playerColor is no longer asserted against the mating side (it stays
    // in the body for API compat). Scholar's mate by white with a "b" claim
    // now signs — the token encodes no outcome, so the mismatch is moot.
    it("signs regardless of the playerColor claim (mate-by-player check removed)", async () => {
      goodConfig();
      const res = await POST(makeRequest(validBody({ playerColor: "b" })));
      expect(res.status).toEqual(200);
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
