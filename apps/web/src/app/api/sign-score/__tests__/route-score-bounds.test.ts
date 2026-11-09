/**
 * Bounds coverage for /api/sign-score.
 *
 * `route.test.ts` mocks `parseInteger` wholesale, so it proves the route
 * maps a thrown "Invalid score" to a 400 — but never exercises the actual
 * ceiling. That blind spot is how the 1500 cap survived the catalog growing
 * to 3000-point pools. This suite keeps `parseInteger` and `parseAddress`
 * real and only stubs the env-dependent signing seams.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { MAX_SUBMITTABLE_SCORE } from "@/lib/game/score";

vi.mock("@/lib/server/demo-signing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/demo-signing")>();
  return {
    ...actual,
    enforceOrigin: vi.fn(),
    enforceRateLimit: vi.fn().mockResolvedValue(undefined),
    getRequestIp: vi.fn(() => "127.0.0.1"),
    createNonce: vi.fn(() => 123n),
    createDeadline: vi.fn(() => 9999999999n),
    getDemoConfig: vi.fn(),
  };
});

import { POST } from "../route";
import { getDemoConfig } from "@/lib/server/demo-signing";

const VALID_ADDRESS = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd" as const;

function stubSigner() {
  vi.mocked(getDemoConfig).mockReturnValue({
    chainId: 11142220,
    badgesAddress: "0xf92759E52aA5EC5d6fDb6CE03b9AC9Cd9f000001",
    scoreboardAddress: "0x1681aAA12aA5EC5d6fDb6CE03b9AC9Cd9f000002",
    victoryNFTAddress: "0x87cC9fe03E76A5894De2FE1372E85D6f5Bb922A9",
    signer: {
      signTypedData: vi.fn().mockResolvedValue("0xsig"),
    } as unknown as ReturnType<typeof getDemoConfig>["signer"],
  });
}

function submit(score: number) {
  return POST(
    new Request("http://localhost/api/sign-score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ player: VALID_ADDRESS, levelId: 1, score, timeMs: 12000 }),
    }),
  );
}

describe("POST /api/sign-score — score bounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubSigner();
  });

  it("signs a score of 1800 (18★, the progress that was being rejected)", async () => {
    expect((await submit(1800)).status).toEqual(200);
  });

  it("signs a score above today's pools, as the content builder will produce", async () => {
    // 11 exercises × 3★ × 100 — a pool the deployed baseline does not have.
    // The route must not consult the live catalog to accept this.
    expect((await submit(3300)).status).toEqual(200);
  });

  it("signs at the ceiling", async () => {
    expect((await submit(MAX_SUBMITTABLE_SCORE)).status).toEqual(200);
  });

  it("rejects a score one point above the ceiling", async () => {
    const res = await submit(MAX_SUBMITTABLE_SCORE + 1);

    expect(res.status).toEqual(400);
    expect((await res.json()).error).toEqual("Invalid score");
  });

  it("still rejects a negative score", async () => {
    expect((await submit(-1)).status).toEqual(400);
  });
});
