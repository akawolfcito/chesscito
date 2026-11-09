import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/queries", () => ({
  fetchHallOfFame: vi.fn(),
  fetchPlayerVictories: vi.fn(),
}));

import { getHallOfFame, getPlayerVictories } from "../hof";
import { fetchHallOfFame, fetchPlayerVictories } from "@/lib/supabase/queries";

const mockedHof = vi.mocked(fetchHallOfFame);
const mockedPlayer = vi.mocked(fetchPlayerVictories);

const SAMPLE_DB_ROW = {
  token_id: 7,
  player: "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd",
  difficulty: 1,
  total_moves: 13,
  time_ms: 11583,
  tx_hash: "0xdead",
  minted_at: "2026-03-20T12:00:00.000Z",
};

describe("getHallOfFame", () => {
  beforeEach(() => {
    mockedHof.mockReset();
  });

  it("transforms token_id → string, total_moves → totalMoves, minted_at → unix seconds", async () => {
    mockedHof.mockResolvedValue([SAMPLE_DB_ROW]);

    const rows = await getHallOfFame();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      tokenId: "7",
      player: "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd",
      difficulty: 1,
      totalMoves: 13,
      timeMs: 11583,
      timestamp: Math.floor(new Date(SAMPLE_DB_ROW.minted_at).getTime() / 1000),
    });
  });

  it("returns an empty array when no victories exist", async () => {
    mockedHof.mockResolvedValue([]);
    expect(await getHallOfFame()).toEqual([]);
  });
});

describe("getPlayerVictories", () => {
  beforeEach(() => {
    mockedPlayer.mockReset();
  });

  it("forwards the player address to the query layer", async () => {
    mockedPlayer.mockResolvedValue([]);
    await getPlayerVictories("0xABC123");
    expect(mockedPlayer).toHaveBeenCalledWith("0xABC123");
  });

  it("returns transformed rows for the player", async () => {
    mockedPlayer.mockResolvedValue([SAMPLE_DB_ROW, { ...SAMPLE_DB_ROW, token_id: 8 }]);
    const rows = await getPlayerVictories(SAMPLE_DB_ROW.player);
    expect(rows).toHaveLength(2);
    expect(rows[0].tokenId).toEqual("7");
    expect(rows[1].tokenId).toEqual("8");
  });
});
