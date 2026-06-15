import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Supabase query layer so no network/DB is touched.
vi.mock("@/lib/supabase/queries", () => ({
  fetchLeaderboardFromDb: vi.fn(),
  fetchPlayerRankFromDb: vi.fn(),
}));

import { fetchLeaderboard, fetchPlayerRank } from "../leaderboard";
import {
  fetchLeaderboardFromDb,
  fetchPlayerRankFromDb,
} from "@/lib/supabase/queries";
import { deriveAvatarVariant, deriveRowId } from "@/lib/identity/identity-lite";

const mockedFetch = vi.mocked(fetchLeaderboardFromDb);
const mockedRank = vi.mocked(fetchPlayerRankFromDb);

const WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";

describe("fetchLeaderboard", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it("derives rowId + variant from the full wallet and emits NO wallet", async () => {
    mockedFetch.mockResolvedValue([
      { rank: 1, player: WALLET, total_score: 3000, is_verified: false },
    ]);

    const rows = await fetchLeaderboard();
    expect(rows).toEqual([
      {
        rank: 1,
        rowId: deriveRowId(WALLET),
        variant: deriveAvatarVariant(WALLET),
        score: 3000,
        isVerified: false,
        hasOnchain: false,
      },
    ]);
    // Privacy: no wallet substring leaks on foreign rows.
    expect(JSON.stringify(rows)).not.toContain("0x");
    expect("player" in rows[0]).toBe(false);
    expect("walletShort" in rows[0]).toBe(false);
  });

  it("maps total_score → score and preserves rank/flags", async () => {
    mockedFetch.mockResolvedValue([
      { rank: 2, player: WALLET, total_score: 1500, is_verified: true, has_onchain: true },
    ]);
    const rows = await fetchLeaderboard();
    expect(rows[0].rank).toBe(2);
    expect(rows[0].score).toBe(1500);
    expect(rows[0].isVerified).toBe(true);
    expect(rows[0].hasOnchain).toBe(true);
  });

  it("returns an empty array when the DB returns no rows", async () => {
    mockedFetch.mockResolvedValue([]);
    expect(await fetchLeaderboard()).toEqual([]);
  });

  it("propagates the underlying error so the route maps it to 500", async () => {
    mockedFetch.mockRejectedValue(new Error("supabase is down"));
    await expect(fetchLeaderboard()).rejects.toThrow("supabase is down");
  });
});

describe("fetchPlayerRank (own row)", () => {
  beforeEach(() => {
    mockedRank.mockReset();
  });

  it("includes walletShort for the caller's OWN row", async () => {
    mockedRank.mockResolvedValue({
      rank: 7,
      player: WALLET,
      total_score: 900,
      is_verified: false,
    });
    const row = await fetchPlayerRank(WALLET);
    expect(row).not.toBeNull();
    expect(row!.rowId).toBe(deriveRowId(WALLET));
    expect(row!.variant).toEqual(deriveAvatarVariant(WALLET));
    expect(row!.walletShort).toBe("0xcc41…c2dd");
  });

  it("returns null when the player has no row", async () => {
    mockedRank.mockResolvedValue(null);
    expect(await fetchPlayerRank(WALLET)).toBeNull();
  });
});
