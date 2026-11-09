import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/queries", () => ({
  getProfileStats: vi.fn(async (_address: string) => ({
    trophies: 12,
    arenaWins: 5,
    nftsMinted: 4,
    dailyStreak: 14,
    puzzlesSolved: 87,
  })),
}));

import { GET } from "../route";

function makeRequest(url: string) {
  return new Request(url);
}

describe("GET /api/profile/stats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when address param missing", async () => {
    const res = await GET(makeRequest("http://localhost/api/profile/stats"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when address is malformed", async () => {
    const res = await GET(makeRequest("http://localhost/api/profile/stats?address=notahex"));
    expect(res.status).toBe(400);
  });

  it("returns 200 with stats payload for valid address", async () => {
    const res = await GET(
      makeRequest("http://localhost/api/profile/stats?address=0x0924abcdef1234567890abcdef1234567890eba4"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      trophies: 12,
      arenaWins: 5,
      nftsMinted: 4,
      dailyStreak: 14,
      puzzlesSolved: 87,
    });
  });

  it("sets no-store cache header (per-user data)", async () => {
    const res = await GET(
      makeRequest("http://localhost/api/profile/stats?address=0x0924abcdef1234567890abcdef1234567890eba4"),
    );
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
