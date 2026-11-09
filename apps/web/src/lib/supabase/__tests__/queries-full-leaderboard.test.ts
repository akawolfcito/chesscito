/**
 * `fetchFullLeaderboardFromDb` — the uncut ranking behind the /stats census.
 *
 * The whole point of the table this feeds is to make the Leaders hero's "17"
 * countable, so it MUST read the same relation that count comes from
 * (`leaderboard_full_v`, what `countRankedPlayers` counts). Reading
 * `leaderboard_combined_v` instead would answer 10 forever and the census
 * would quietly contradict the number it exists to audit.
 *
 * Spec: docs/specs/2026-07-30-stats-full-players-table.md §3, §4, §7 stage 1
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const chain = vi.hoisted(() => ({
  select: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
}));

const fromMock = vi.hoisted(() => vi.fn(() => chain));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(() => ({ from: fromMock })),
}));

import {
  fetchFullLeaderboardFromDb,
  PLAYERS_TABLE_CEILING,
} from "../queries";
import { getSupabaseServer } from "@/lib/supabase/server";

type Row = {
  rank: number;
  player: string;
  total_score: number;
  is_verified: boolean;
  has_onchain: boolean;
};

function row(rank: number): Row {
  return {
    rank,
    player: `0x${String(rank).padStart(40, "0")}`,
    total_score: 1000 - rank,
    is_verified: false,
    has_onchain: false,
  };
}

/** Resolve the chain at `.limit(...)`, the last link in the query. */
function resolveWith(rows: Row[] | null, error: unknown = null) {
  chain.select.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockResolvedValue({ data: rows, error });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSupabaseServer).mockImplementation(
    () => ({ from: fromMock }) as never,
  );
  resolveWith([]);
});

describe("fetchFullLeaderboardFromDb", () => {
  it("reads the uncut relation, not the top-10 cut", async () => {
    await fetchFullLeaderboardFromDb(PLAYERS_TABLE_CEILING);

    expect(fromMock).toHaveBeenCalledWith("leaderboard_full_v");
    // The census must never be fed by the podium's source.
    expect(fromMock).not.toHaveBeenCalledWith("leaderboard_combined_v");
  });

  it("orders by the view's rank ascending", async () => {
    // Rank comes from the view, never from an array index — a client-side
    // index would silently renumber a truncated or paginated read.
    await fetchFullLeaderboardFromDb(PLAYERS_TABLE_CEILING);

    expect(chain.order).toHaveBeenCalledWith("rank", { ascending: true });
  });

  it("applies the row ceiling it was given", async () => {
    await fetchFullLeaderboardFromDb(25);

    expect(chain.limit).toHaveBeenCalledWith(25);
  });

  it("returns the rows the view produced, in order", async () => {
    resolveWith([row(1), row(2), row(3)]);

    const rows = await fetchFullLeaderboardFromDb(PLAYERS_TABLE_CEILING);

    expect(rows?.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("returns null when Supabase is unconfigured", async () => {
    vi.mocked(getSupabaseServer).mockReturnValue(null as never);

    await expect(
      fetchFullLeaderboardFromDb(PLAYERS_TABLE_CEILING),
    ).resolves.toBeNull();
  });

  it("returns null on a query error instead of throwing", async () => {
    resolveWith(null, { message: "relation does not exist" });

    await expect(
      fetchFullLeaderboardFromDb(PLAYERS_TABLE_CEILING),
    ).resolves.toBeNull();
  });

  it("distinguishes a genuinely empty board from a failed read", async () => {
    // This is the whole reason the return type is nullable. `[]` for a failure
    // would announce "there are no ranked players" on a visibly populated
    // board — the same lie fetchLeaderboardTotalFromDb refuses to tell with 0.
    resolveWith([]);

    await expect(fetchFullLeaderboardFromDb(PLAYERS_TABLE_CEILING)).resolves.toEqual(
      [],
    );
  });
});

describe("PLAYERS_TABLE_CEILING", () => {
  it("is a transport cap, deliberately unrelated to the Leaders podium cut", () => {
    // BOARD_CUT (10) mirrors a SQL LIMIT in the leaderboard views. This is how
    // many rows the snapshot will carry. They must never be shared: tying them
    // would bind the podium to this table's transport budget forever.
    expect(PLAYERS_TABLE_CEILING).toBe(500);
  });
});
