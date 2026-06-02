import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
  parseAddress: vi.fn(),
  createNonce: vi.fn(() => 42n),
  createDeadline: vi.fn(() => 1234567890n),
  getDemoConfig: vi.fn(),
}));

vi.mock("@/lib/game/labyrinth-mint-policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/game/labyrinth-mint-policy")>();
  return {
    ...actual,
    resolveLabyrinthMintPolicy: vi.fn(actual.resolveLabyrinthMintPolicy),
  };
});

import { POST } from "../route";
import {
  enforceOrigin,
  enforceRateLimit,
  parseAddress,
  getDemoConfig,
} from "@/lib/server/demo-signing";
import { resolveLabyrinthMintPolicy } from "@/lib/game/labyrinth-mint-policy";

const mockedOrigin = vi.mocked(enforceOrigin);
const mockedRate = vi.mocked(enforceRateLimit);
const mockedAddress = vi.mocked(parseAddress);
const mockedConfig = vi.mocked(getDemoConfig);
const mockedPolicy = vi.mocked(resolveLabyrinthMintPolicy);

const VALID_ADDRESS = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd" as const;
// pawn-lab-1: optimalMoves = 3
const KNOWN_LAB_ID = "pawn-lab-1";
const KNOWN_LAB_OPTIMAL = 3;

function goodConfig() {
  const signTypedData = vi.fn().mockResolvedValue("0xlabsig");
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
  return new Request("http://localhost/api/sign-labyrinth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/sign-labyrinth", () => {
  beforeEach(() => {
    mockedOrigin.mockReset();
    mockedRate.mockReset();
    mockedAddress.mockReset();
    mockedConfig.mockReset();
    mockedPolicy.mockReset();
    mockedOrigin.mockImplementation(() => {});
    mockedRate.mockResolvedValue(undefined);
    mockedAddress.mockReturnValue(VALID_ADDRESS);
    // Default policy: mintable, no campaign, 1 star floor.
    mockedPolicy.mockReturnValue({
      mintable: true,
      leaderboardEligible: false,
      rewardEligible: false,
      campaignEligible: false,
      minStarsToMint: 1,
      minStarsForReward: null,
      seasonId: null,
      campaignId: null,
      partnerId: null,
      rewardTier: "none",
    });
  });

  it("returns 200 with labyrinth signature payload at optimal moves (3 stars)", async () => {
    const signFn = goodConfig();
    const res = await POST(
      makeRequest({
        player: VALID_ADDRESS,
        labyrinthId: KNOWN_LAB_ID,
        moves: KNOWN_LAB_OPTIMAL,
      }),
    );
    expect(res.status).toEqual(200);
    const body = await res.json();
    expect(body.signature).toEqual("0xlabsig");
    expect(body.labyrinthId).toEqual(KNOWN_LAB_ID);
    expect(body.moves).toEqual(String(KNOWN_LAB_OPTIMAL));
    expect(body.stars).toEqual(3);
    expect(body.campaignId).toBeNull();
    expect(body.nonce).toEqual("42");
    expect(body.deadline).toEqual("1234567890");
    expect(signFn).toHaveBeenCalledOnce();
  });

  it("returns 200 when campaignId matches resolved policy campaignId", async () => {
    const signFn = goodConfig();
    mockedPolicy.mockReturnValue({
      mintable: true,
      leaderboardEligible: false,
      rewardEligible: false,
      campaignEligible: true,
      minStarsToMint: 1,
      minStarsForReward: null,
      seasonId: null,
      campaignId: "rook-week-2026-06",
      partnerId: null,
      rewardTier: "none",
    });
    const res = await POST(
      makeRequest({
        player: VALID_ADDRESS,
        labyrinthId: KNOWN_LAB_ID,
        moves: KNOWN_LAB_OPTIMAL,
        campaignId: "rook-week-2026-06",
      }),
    );
    expect(res.status).toEqual(200);
    const body = await res.json();
    expect(body.campaignId).toEqual("rook-week-2026-06");
    expect(signFn).toHaveBeenCalledOnce();
  });

  it("returns 400 when labyrinthId is unknown", async () => {
    goodConfig();
    const res = await POST(
      makeRequest({
        player: VALID_ADDRESS,
        labyrinthId: "not-a-real-lab",
        moves: 3,
      }),
    );
    expect(res.status).toEqual(400);
  });

  it("returns 400 when moves < optimalMoves", async () => {
    goodConfig();
    const res = await POST(
      makeRequest({
        player: VALID_ADDRESS,
        labyrinthId: KNOWN_LAB_ID,
        moves: KNOWN_LAB_OPTIMAL - 1,
      }),
    );
    expect(res.status).toEqual(400);
  });

  it("returns 400 when moves > optimalMoves * 5", async () => {
    goodConfig();
    const res = await POST(
      makeRequest({
        player: VALID_ADDRESS,
        labyrinthId: KNOWN_LAB_ID,
        moves: KNOWN_LAB_OPTIMAL * 5 + 1,
      }),
    );
    expect(res.status).toEqual(400);
  });

  it("returns 400 when policy mintable is false", async () => {
    goodConfig();
    mockedPolicy.mockReturnValue({
      mintable: false,
      leaderboardEligible: false,
      rewardEligible: false,
      campaignEligible: false,
      minStarsToMint: 1,
      minStarsForReward: null,
      seasonId: null,
      campaignId: null,
      partnerId: null,
      rewardTier: "none",
    });
    const res = await POST(
      makeRequest({
        player: VALID_ADDRESS,
        labyrinthId: KNOWN_LAB_ID,
        moves: KNOWN_LAB_OPTIMAL,
      }),
    );
    expect(res.status).toEqual(400);
  });

  it("returns 400 when stars < minStarsToMint", async () => {
    goodConfig();
    mockedPolicy.mockReturnValue({
      mintable: true,
      leaderboardEligible: false,
      rewardEligible: false,
      campaignEligible: false,
      minStarsToMint: 3,
      minStarsForReward: null,
      seasonId: null,
      campaignId: null,
      partnerId: null,
      rewardTier: "none",
    });
    // moves = optimal + 3 → 1 star, below the 3-star floor.
    const res = await POST(
      makeRequest({
        player: VALID_ADDRESS,
        labyrinthId: KNOWN_LAB_ID,
        moves: KNOWN_LAB_OPTIMAL + 3,
      }),
    );
    expect(res.status).toEqual(400);
  });

  it("returns 400 when campaignId is provided but policy has no campaign", async () => {
    goodConfig();
    // Default policy from beforeEach has campaignId: null.
    const res = await POST(
      makeRequest({
        player: VALID_ADDRESS,
        labyrinthId: KNOWN_LAB_ID,
        moves: KNOWN_LAB_OPTIMAL,
        campaignId: "rook-week-2026-06",
      }),
    );
    expect(res.status).toEqual(400);
  });

  it("returns 403 when enforceOrigin throws Forbidden", async () => {
    mockedOrigin.mockImplementation(() => {
      throw new Error("Forbidden");
    });
    const res = await POST(
      makeRequest({
        player: VALID_ADDRESS,
        labyrinthId: KNOWN_LAB_ID,
        moves: KNOWN_LAB_OPTIMAL,
      }),
    );
    expect(res.status).toEqual(403);
  });

  it("returns 429 when enforceRateLimit throws Rate limit exceeded", async () => {
    goodConfig();
    mockedRate.mockRejectedValue(new Error("Rate limit exceeded"));
    const res = await POST(
      makeRequest({
        player: VALID_ADDRESS,
        labyrinthId: KNOWN_LAB_ID,
        moves: KNOWN_LAB_OPTIMAL,
      }),
    );
    expect(res.status).toEqual(429);
  });
});
