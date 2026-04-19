import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Supabase query layer so no network/DB is touched.
vi.mock("@/lib/supabase/queries", () => ({
  fetchLeaderboardFromDb: vi.fn(),
}));

import { fetchLeaderboard } from "../leaderboard";
import { fetchLeaderboardFromDb } from "@/lib/supabase/queries";

const mockedFetch = vi.mocked(fetchLeaderboardFromDb);

describe("fetchLeaderboard", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it("truncates each player address to 0xXXXX...XXXX", async () => {
    mockedFetch.mockResolvedValue([
      {
        rank: 1,
        player: "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd",
        total_score: 3000,
        is_verified: false,
      },
    ]);

    const rows = await fetchLeaderboard();
    expect(rows).toHaveLength(1);
    expect(rows[0].player).toEqual("0xcc41...c2dd");
  });

  it("maps total_score → score and preserves rank", async () => {
    mockedFetch.mockResolvedValue([
      {
        rank: 2,
        player: "0xabcdef0123456789abcdef0123456789abcdef01",
        total_score: 1500,
        is_verified: true,
      },
    ]);

    const rows = await fetchLeaderboard();
    expect(rows[0]).toEqual({
      rank: 2,
      player: "0xabcd...ef01",
      score: 1500,
      isVerified: true,
    });
  });

  it("returns an empty array when the DB returns no rows", async () => {
    mockedFetch.mockResolvedValue([]);
    const rows = await fetchLeaderboard();
    expect(rows).toEqual([]);
  });

  it("propagates the underlying error so the route handler can map it to 500", async () => {
    mockedFetch.mockRejectedValue(new Error("supabase is down"));
    await expect(fetchLeaderboard()).rejects.toThrow("supabase is down");
  });
});
