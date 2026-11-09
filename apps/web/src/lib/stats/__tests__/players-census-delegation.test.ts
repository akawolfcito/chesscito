/**
 * The census does not know how the population is counted.
 *
 * The Leaders hero says "17". This table exists so that number can be counted
 * by hand, which only holds if both come from the same domain function over the
 * same relation. Two equivalent-looking queries would drift the first time
 * anyone changes the relation, an implicit filter, the error handling, or what
 * "ranked player" means — and the drift would surface as two screens
 * contradicting each other, not as a failing test.
 *
 * ⚠️ Deliberately NOT tested here: that the two numbers match at the same
 * instant. They cannot. The hero is served live per request and this page from
 * an hourly snapshot, so a comparison test would either pass over mocks that
 * hide the cache, or fail on a truth that is expected (§5.2). The guarantee is
 * the delegation, so the delegation is what gets pinned.
 *
 * Spec: docs/specs/2026-07-30-stats-full-players-table.md §6, §7 stage 7
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/supabase/queries", () => ({
  PLAYERS_TABLE_CEILING: 500,
  fetchFullLeaderboardFromDb: vi.fn(),
  fetchLeaderboardTotalFromDb: vi.fn(),
  fetchLeaderboardFromDb: vi.fn(),
}));

import { readPlayersCensus } from "../players-census";
import {
  fetchFullLeaderboardFromDb,
  fetchLeaderboardFromDb,
  fetchLeaderboardTotalFromDb,
} from "@/lib/supabase/queries";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchFullLeaderboardFromDb).mockResolvedValue([]);
  vi.mocked(fetchLeaderboardTotalFromDb).mockResolvedValue(17);
});

describe("delegation", () => {
  it("gets the population from fetchLeaderboardTotalFromDb", async () => {
    await readPlayersCensus();

    expect(fetchLeaderboardTotalFromDb).toHaveBeenCalledTimes(1);
  });

  it("returns exactly what that function returned", async () => {
    vi.mocked(fetchLeaderboardTotalFromDb).mockResolvedValue(43);

    expect((await readPlayersCensus()).total).toBe(43);
  });

  it("propagates its null rather than reinterpreting it", async () => {
    // `null` means "unknown" in that function's contract. Turning it into 0
    // here would claim an empty board; turning it into rows.length would claim
    // the page is the population.
    vi.mocked(fetchLeaderboardTotalFromDb).mockResolvedValue(null);
    vi.mocked(fetchFullLeaderboardFromDb).mockResolvedValue([
      {
        rank: 1,
        player: "0x1111111111111111111111111111111111111111",
        total_score: 10,
        is_verified: false,
        has_onchain: false,
      },
    ]);

    expect((await readPlayersCensus()).total).toBeNull();
  });

  it("never reaches for the podium's reader", async () => {
    // `fetchLeaderboardFromDb` is the top-10 cut. Counting or listing from it
    // would answer 10 forever.
    await readPlayersCensus();

    expect(fetchLeaderboardFromDb).not.toHaveBeenCalled();
  });
});

describe("source guard: the census owns no query of its own", () => {
  // ⚠️ This reads raw source, so COMMENT PROSE COUNTS. A docblock that spells
  // out `leaderboard_full_v` fails this suite even though the code is clean.
  // That is the same tradeoff the overlay geometry guard makes, and it is
  // accepted for the same reason: the alternative is parsing, and a guard
  // nobody can read is a guard nobody maintains. Refer to the relation
  // indirectly in prose here.
  const source = readFileSync(
    join(__dirname, "..", "players-census.ts"),
    "utf8",
  );

  it("does not open a Supabase client", () => {
    // The moment this module can query, someone can add a second count here
    // that looks equivalent and is not. Delegation has to be the only path.
    expect(source).not.toContain("getSupabaseServer");
  });

  it("names no relation and builds no query", () => {
    for (const forbidden of [
      "leaderboard_full_v",
      "leaderboard_combined_v",
      ".from(",
      "count: ",
    ]) {
      expect(source, `census must not contain ${forbidden}`).not.toContain(
        forbidden,
      );
    }
  });
});
