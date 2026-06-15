import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/server/leaderboard", () => ({
  fetchLeaderboard: vi.fn(),
  fetchPlayerRank: vi.fn(),
}));

import { GET } from "../route";
import { fetchLeaderboard, fetchPlayerRank } from "@/lib/server/leaderboard";

const mocked = vi.mocked(fetchLeaderboard);
const mockedPlayer = vi.mocked(fetchPlayerRank);

function makeRequest(url = "http://localhost/api/leaderboard") {
  return new Request(url);
}

describe("GET /api/leaderboard", () => {
  beforeEach(() => {
    mocked.mockReset();
    mockedPlayer.mockReset();
  });

  const variant = { piece: "knight", style: "golden", number: 1 } as const;

  it("returns 200 with the leaderboard JSON array on success (no wallet leaked)", async () => {
    const rows = [
      { rank: 1, rowId: "id_abc", variant, score: 3000, isVerified: false, hasOnchain: true },
    ];
    mocked.mockResolvedValue(rows);

    const res = await GET(makeRequest());
    expect(res.status).toEqual(200);
    const body = await res.json();
    expect(body).toEqual(rows);
    // Foreign rows carry NO wallet substring (Identity Lite P0-1).
    expect(JSON.stringify(body)).not.toContain("0x");
    expect(mockedPlayer).not.toHaveBeenCalled();
  });

  it("with ?player= returns { rows, player } including the caller's own rank", async () => {
    const rows = [
      { rank: 1, rowId: "id_abc", variant, score: 3000, isVerified: false, hasOnchain: true },
    ];
    const own = {
      rank: 42,
      rowId: "id_own",
      variant,
      score: 120,
      isVerified: false,
      hasOnchain: false,
      walletShort: "0xabcd…ef01",
    };
    mocked.mockResolvedValue(rows);
    mockedPlayer.mockResolvedValue(own);

    const res = await GET(
      makeRequest("http://localhost/api/leaderboard?player=0xABCD000000000000000000000000000000-EF01"),
    );
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ rows, player: own });
  });

  it("with ?player= and no saves yet, player is null", async () => {
    mocked.mockResolvedValue([]);
    mockedPlayer.mockResolvedValue(null);

    const res = await GET(
      makeRequest("http://localhost/api/leaderboard?player=0xabc"),
    );
    expect(await res.json()).toEqual({ rows: [], player: null });
  });

  it("returns 500 with a sanitized error message when the service throws", async () => {
    mocked.mockRejectedValue(new Error("supabase connection refused"));

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(makeRequest());
    expect(res.status).toEqual(500);
    const body = await res.json();
    expect(body.error).toEqual("Failed to fetch leaderboard");
    expect(body.error).not.toContain("supabase"); // raw error not leaked to client
    errorSpy.mockRestore();
  });
});
