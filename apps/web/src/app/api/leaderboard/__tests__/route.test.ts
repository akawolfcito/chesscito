import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/server/leaderboard", () => ({
  fetchLeaderboard: vi.fn(),
  fetchLeaderboardTotal: vi.fn(),
  fetchPlayerRank: vi.fn(),
  fetchWeeklyLeaderboard: vi.fn(),
  fetchWeeklyLeaderboardTotal: vi.fn(),
  fetchWeeklyPlayerRank: vi.fn(),
}));

import * as routeModule from "../route";
import { GET } from "../route";
import {
  fetchLeaderboard,
  fetchLeaderboardTotal,
  fetchPlayerRank,
  fetchWeeklyLeaderboard,
  fetchWeeklyLeaderboardTotal,
  fetchWeeklyPlayerRank,
} from "@/lib/server/leaderboard";

const mocked = vi.mocked(fetchLeaderboard);
const mockedPlayer = vi.mocked(fetchPlayerRank);
const mockedWeekly = vi.mocked(fetchWeeklyLeaderboard);
const mockedWeeklyPlayer = vi.mocked(fetchWeeklyPlayerRank);
const mockedTotal = vi.mocked(fetchLeaderboardTotal);
const mockedWeeklyTotal = vi.mocked(fetchWeeklyLeaderboardTotal);

function makeRequest(url = "http://localhost/api/leaderboard") {
  return new Request(url);
}

describe("GET /api/leaderboard", () => {
  beforeEach(() => {
    mocked.mockReset();
    mockedPlayer.mockReset();
    mockedTotal.mockReset();
    mockedTotal.mockResolvedValue(13);
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

  // The population count is a WINDOWED-ONLY field. A legacy client gets the
  // shape it has always got, and pays for no extra query to do it.
  it("adds no total, and takes no count, on the bare legacy shape", async () => {
    const rows = [
      { rank: 1, rowId: "id_abc", variant, score: 3000, isVerified: false, hasOnchain: true },
    ];
    mocked.mockResolvedValue(rows);

    const body = await (await GET(makeRequest())).json();

    expect(body).toEqual(rows);
    expect(mockedTotal).not.toHaveBeenCalled();
  });

  it("adds no total, and takes no count, on the legacy { rows, player } shape", async () => {
    const rows = [
      { rank: 1, rowId: "id_abc", variant, score: 3000, isVerified: false, hasOnchain: true },
    ];
    mocked.mockResolvedValue(rows);
    mockedPlayer.mockResolvedValue(null);

    const body = await (
      await GET(makeRequest("http://localhost/api/leaderboard?player=0xabc"))
    ).json();

    expect(body).toEqual({ rows, player: null });
    expect(Object.keys(body)).toEqual(["rows", "player"]);
    expect(mockedTotal).not.toHaveBeenCalled();
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

// ---------------------------------------------------------------------------
// Slice 2B — the weekly window (API-5, API-6, API-7, API-9, API-14, API-16).
//
// Spec: docs/specs/2026-07-29-leaders-weekly-api.md
//
// The four tests above are the legacy contract and must keep passing untouched:
// they are what proves a client that never sends `window` cannot tell this
// slice shipped.
// ---------------------------------------------------------------------------

describe("GET /api/leaderboard — weekly", () => {
  const variant = { piece: "rook", style: "golden", number: 2 } as const;
  const WALLET = "0xAAAAbbbbccccddddeeeeffff0000111122223333";
  const ORIGINAL_MODE = process.env.NEXT_PUBLIC_CHESSCITO_MODE;

  const weeklyRow = {
    rank: 1,
    rowId: "id_weekly",
    variant,
    score: 300,
    isVerified: false,
  };
  const allTimeRow = {
    rank: 1,
    rowId: "id_all",
    variant,
    score: 900,
    isVerified: true,
    hasOnchain: true,
  };

  const call = (qs = "") =>
    GET(new Request(`http://localhost/api/leaderboard${qs}`));

  beforeEach(() => {
    mocked.mockReset();
    mockedPlayer.mockReset();
    mockedWeekly.mockReset();
    mockedWeeklyPlayer.mockReset();
    mockedTotal.mockReset();
    mockedWeeklyTotal.mockReset();
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "learn";
    delete process.env.NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED;
    mocked.mockResolvedValue([allTimeRow]);
    mockedPlayer.mockResolvedValue(allTimeRow);
    mockedWeekly.mockResolvedValue([weeklyRow]);
    mockedWeeklyPlayer.mockResolvedValue(weeklyRow);
    mockedTotal.mockResolvedValue(13);
    mockedWeeklyTotal.mockResolvedValue(3);
  });

  afterEach(() => {
    if (ORIGINAL_MODE === undefined) {
      delete process.env.NEXT_PUBLIC_CHESSCITO_MODE;
    } else {
      process.env.NEXT_PUBLIC_CHESSCITO_MODE = ORIGINAL_MODE;
    }
  });

  it("serves the weekly board with its window and its surface", async () => {
    const res = await call("?window=weekly");
    expect(res.status).toEqual(200);
    const body = await res.json();
    expect(body.window).toEqual("weekly");
    expect(body.rows).toEqual([weeklyRow]);
    expect(body.player).toBeNull();
    expect(body.surface).toEqual("learn");
    expect(typeof body.weekStart).toEqual("string");
    expect(typeof body.weekEnd).toEqual("string");
  });

  it("includes the caller's own weekly row when asked", async () => {
    const body = await (await call(`?window=weekly&player=${WALLET}`)).json();
    expect(body.player).toEqual(weeklyRow);
    expect(mockedWeeklyPlayer).toHaveBeenCalledWith(
      WALLET,
      "learn",
      expect.objectContaining({ start: expect.any(Date), end: expect.any(Date) }),
    );
  });

  it("serves the all-time board in the new envelope on request", async () => {
    const body = await (await call("?window=alltime")).json();
    expect(body.window).toEqual("alltime");
    expect(body.rows).toEqual([allTimeRow]);
    // All-time is not surface-scoped, so it must not claim a surface or a week.
    expect(body.surface).toBeUndefined();
    expect(body.weekStart).toBeUndefined();
  });

  it("rejects an unknown window instead of guessing (API-14)", async () => {
    expect((await call("?window=monthly")).status).toEqual(400);
  });

  it("rejects an empty window (API-14)", async () => {
    // Absent is null; empty is the empty string, which is a client bug. Falling
    // back to all-time would hide the typo behind a plausible board.
    expect((await call("?window=")).status).toEqual(400);
  });

  it("ignores a surface query parameter (API-5)", async () => {
    const body = await (await call("?window=weekly&surface=play")).json();
    expect(body.surface).toEqual("learn");
    expect(mockedWeekly).toHaveBeenCalledWith("learn", expect.anything());
  });

  it("serves the play board on a play deployment (API-5)", async () => {
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "play";
    const body = await (await call("?window=weekly")).json();
    expect(body.surface).toEqual("play");
  });

  it("serves a learn-scoped board on an internal full build (API-8)", async () => {
    // `full` is not a shipped surface; it behaves as Learn for the exercises
    // flow. What matters here is that the RESPONSE says learn, so a client
    // asserting the surface it expects does not reject its own board.
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "full";
    const body = await (await call("?window=weekly")).json();
    expect(body.surface).toEqual("learn");
    expect(mockedWeekly).toHaveBeenCalledWith("learn", expect.anything());
  });

  it("answers 500 for weekly when the mode is unset (API-6)", async () => {
    delete process.env.NEXT_PUBLIC_CHESSCITO_MODE;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call("?window=weekly")).status).toEqual(500);
    errorSpy.mockRestore();
  });

  it("answers 500 for weekly on an unrecognised mode (API-7)", async () => {
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "lean";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call("?window=weekly")).status).toEqual(500);
    errorSpy.mockRestore();
  });

  it("STILL answers 200 on the legacy paths with the mode unset (API-6)", async () => {
    // The ordering trap: resolving the surface at the top of the handler is the
    // natural way to write this, and it would break every already-shipped
    // client the moment the variable went missing.
    delete process.env.NEXT_PUBLIC_CHESSCITO_MODE;
    expect((await call()).status).toEqual(200);
    expect((await call(`?player=${WALLET}`)).status).toEqual(200);
    expect((await call("?window=alltime")).status).toEqual(200);
  });

  it("ignores the UI kill switch — the flag gates the sheet, not the endpoint (API-9)", async () => {
    process.env.NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED = "false";
    const res = await call("?window=weekly");
    expect(res.status).toEqual(200);
    expect((await res.json()).window).toEqual("weekly");
  });

  // -------------------------------------------------------------------------
  // The ranked population (backlog §2, device 2026-07-29).
  //
  // The board is a top-10 cut, so a field derived from it can never describe a
  // population larger than 10. These assert the number comes from the count,
  // and that a broken count says nothing rather than something false.
  // -------------------------------------------------------------------------

  it("carries the all-time population, larger than the board", async () => {
    const body = await (await call("?window=alltime")).json();
    expect(body.rows).toHaveLength(1);
    expect(body.total).toEqual(13);
  });

  it("carries the weekly population for the resolved surface", async () => {
    const body = await (await call("?window=weekly")).json();
    expect(body.total).toEqual(3);
    expect(mockedWeeklyTotal).toHaveBeenCalledWith("learn");
  });

  it("counts play's population on a play deployment", async () => {
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "play";
    await call("?window=weekly");
    expect(mockedWeeklyTotal).toHaveBeenCalledWith("play");
  });

  it("OMITS total when the all-time count fails, and still answers 200", async () => {
    mockedTotal.mockResolvedValue(null);

    const res = await call("?window=alltime");
    const body = await res.json();

    expect(res.status).toEqual(200);
    // Absent, not null and not 1: a present value here is a claim, and the
    // count is the only thing entitled to make it.
    expect("total" in body).toBe(false);
    expect(body.rows).toHaveLength(1);
  });

  it("OMITS total when the weekly count fails, and still answers 200", async () => {
    mockedWeeklyTotal.mockResolvedValue(null);

    const res = await call("?window=weekly");
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect("total" in body).toBe(false);
  });

  it("reports a genuinely empty population as 0", async () => {
    mockedWeeklyTotal.mockResolvedValue(0);
    mockedWeekly.mockResolvedValue([]);

    const body = await (await call("?window=weekly")).json();
    // Zero is a fact about a fresh Monday; it must survive the ?? that turns
    // null into an absent field.
    expect(body.total).toEqual(0);
  });

  it("stays force-dynamic (API-16)", async () => {
    // A CDN-cached weekly board keeps serving last week after the Monday reset.
    expect(routeModule.dynamic).toEqual("force-dynamic");
  });
});
