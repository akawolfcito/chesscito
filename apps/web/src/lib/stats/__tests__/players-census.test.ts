/**
 * `readPlayersCensus` — rows + population, composed into one unit.
 *
 * Two independent reads feed this: the uncut ranking and the count. They fail
 * separately, so all four combinations are real and none of them may collapse
 * into another. In particular `[]` from an empty board and `[]` from a failed
 * read are NOT the same fact, and the census keeps a signal that says which
 * one happened even though the UI may hide both.
 *
 * Spec: docs/specs/2026-07-30-stats-full-players-table.md §4, §7 stage 2
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/queries", () => ({
  PLAYERS_TABLE_CEILING: 500,
  fetchFullLeaderboardFromDb: vi.fn(),
  fetchLeaderboardTotalFromDb: vi.fn(),
}));

import { readPlayersCensus } from "../players-census";
import {
  fetchFullLeaderboardFromDb,
  fetchLeaderboardTotalFromDb,
} from "@/lib/supabase/queries";

const rowsFn = vi.mocked(fetchFullLeaderboardFromDb);
const totalFn = vi.mocked(fetchLeaderboardTotalFromDb);

/** A view row, wallet included — exactly what Supabase hands back. */
function viewRow(rank: number, player: string, score = 1000 - rank) {
  return {
    rank,
    player,
    total_score: score,
    is_verified: false,
    has_onchain: false,
  };
}

const WALLET_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const WALLET_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

beforeEach(() => {
  vi.clearAllMocks();
  rowsFn.mockResolvedValue([]);
  totalFn.mockResolvedValue(0);
});

describe("availability matrix — four independent outcomes", () => {
  it("rows ok + count ok → rows and total", async () => {
    rowsFn.mockResolvedValue([viewRow(1, WALLET_A), viewRow(2, WALLET_B)]);
    totalFn.mockResolvedValue(17);

    const census = await readPlayersCensus();

    expect(census.rows).toHaveLength(2);
    expect(census.total).toBe(17);
    expect(census.rowsRead).toBe("ok");
  });

  it("rows ok + count failed → rows kept, total null", async () => {
    rowsFn.mockResolvedValue([viewRow(1, WALLET_A)]);
    totalFn.mockResolvedValue(null);

    const census = await readPlayersCensus();

    expect(census.rows).toHaveLength(1);
    expect(census.total).toBeNull();
    expect(census.rowsRead).toBe("ok");
  });

  it("never substitutes rows.length for a failed count", async () => {
    // rows.length is the exact defect this replaces: it once announced
    // "10 players" to a player ranked 13th.
    rowsFn.mockResolvedValue([viewRow(1, WALLET_A), viewRow(2, WALLET_B)]);
    totalFn.mockResolvedValue(null);

    expect((await readPlayersCensus()).total).toBeNull();
  });

  it("rows failed + count ok → empty rows, total still available", async () => {
    rowsFn.mockResolvedValue(null);
    totalFn.mockResolvedValue(17);

    const census = await readPlayersCensus();

    expect(census.rows).toEqual([]);
    expect(census.total).toBe(17);
    expect(census.rowsRead).toBe("unavailable");
  });

  it("rows failed + count failed → empty rows, total null", async () => {
    rowsFn.mockResolvedValue(null);
    totalFn.mockResolvedValue(null);

    const census = await readPlayersCensus();

    expect(census.rows).toEqual([]);
    expect(census.total).toBeNull();
    expect(census.rowsRead).toBe("unavailable");
  });

  it("an empty board and a failed read are not the same fact", async () => {
    rowsFn.mockResolvedValue([]);
    totalFn.mockResolvedValue(0);
    const emptyBoard = await readPlayersCensus();

    rowsFn.mockResolvedValue(null);
    totalFn.mockResolvedValue(null);
    const failedRead = await readPlayersCensus();

    // Both carry rows: [], and that is why the signal has to exist.
    expect(emptyBoard.rows).toEqual(failedRead.rows);
    expect(emptyBoard.rowsRead).toBe("ok");
    expect(failedRead.rowsRead).toBe("unavailable");
  });

  it("survives a read that rejects rather than resolving", async () => {
    rowsFn.mockRejectedValue(new Error("boom"));
    totalFn.mockResolvedValue(17);

    const census = await readPlayersCensus();

    expect(census.rowsRead).toBe("unavailable");
    expect(census.total).toBe(17);
  });
});

describe("Identity Lite", () => {
  it("carries no wallet into the payload", async () => {
    rowsFn.mockResolvedValue([viewRow(1, WALLET_A), viewRow(2, WALLET_B)]);

    const census = await readPlayersCensus();

    expect(JSON.stringify(census)).not.toContain("0x");
  });

  it("gives every row an opaque rowId to key on", async () => {
    rowsFn.mockResolvedValue([viewRow(1, WALLET_A), viewRow(2, WALLET_B)]);

    const census = await readPlayersCensus();

    expect(census.rows.every((r) => r.rowId.length > 0)).toBe(true);
    expect(census.rows[0].rowId).not.toBe(census.rows[1].rowId);
  });

  it("preserves the view's order exactly", async () => {
    rowsFn.mockResolvedValue([
      viewRow(1, WALLET_A),
      viewRow(2, WALLET_B),
      viewRow(3, "0xcccccccccccccccccccccccccccccccccccccccc"),
    ]);

    const census = await readPlayersCensus();

    expect(census.rows.map((r) => r.totalScore)).toEqual([999, 998, 997]);
  });

  it("takes rank from the view, never from the array index", async () => {
    // A page of the census can start anywhere; renumbering from the index
    // would quietly relabel ranks on a truncated read.
    rowsFn.mockResolvedValue([viewRow(11, WALLET_A), viewRow(12, WALLET_B)]);

    const census = await readPlayersCensus();

    expect(census.rows.map((r) => r.rank)).toEqual([11, 12]);
  });

  it("does not deduplicate, even when two rows would render alike", async () => {
    // aggregateTopMinters dedupes by rowId on purpose; copying that here would
    // delete players from a census. Two distinct wallets are two rows, always.
    rowsFn.mockResolvedValue([
      viewRow(1, WALLET_A, 500),
      viewRow(2, WALLET_B, 500),
    ]);

    expect((await readPlayersCensus()).rows).toHaveLength(2);
  });

  it("asks for the full ceiling of rows", async () => {
    await readPlayersCensus();

    expect(rowsFn).toHaveBeenCalledWith(500);
  });
});
