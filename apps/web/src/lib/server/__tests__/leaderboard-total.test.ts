/**
 * The ranked POPULATION, which is not the size of the board.
 *
 * Backlog `2026-07-10-backlog-index.md` §2, seen on device 2026-07-29: the hero
 * read `rows.length` — the top-10 cut — so it announced "10 players" to a player
 * whose own footer said rank 13. The number could not exceed 10 by construction.
 *
 * The count is taken over the UNCUT relations, the same ones the own-row rank
 * comes from, so the hero and the footer can no longer disagree.
 *
 * `null` MEANS "UNKNOWN", AND IT IS NOT ZERO
 * -----------------------------------------
 * A failed count returns null so the caller can omit the figure. Falling back to
 * `rows.length` would restore the exact defect this closes, and falling back to
 * 0 would state "no players" over a board that is visibly not empty. An honest
 * absence is the only safe failure here.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: vi.fn() }));

import { getSupabaseServer } from "@/lib/supabase/server";
import {
  fetchLeaderboardTotal,
  fetchWeeklyLeaderboardTotal,
} from "../leaderboard";

const mockedSupabase = vi.mocked(getSupabaseServer);

type CountResult = { count?: number | null; error?: unknown };

/** Records the table, the count options and every `.eq()` it was handed. */
function makeClient(result: CountResult) {
  const calls: {
    table?: string;
    column?: string;
    options?: { count?: string; head?: boolean };
    eq: Record<string, unknown>;
  } = { eq: {} };

  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    select: vi.fn((column: string, options?: { count?: string; head?: boolean }) => {
      calls.column = column;
      calls.options = options;
      return chain;
    }),
    eq: vi.fn((col: string, val: unknown) => {
      calls.eq[col] = val;
      return chain;
    }),
    // A PostgREST count lands in `count`, never in `data`: with head:true no row
    // is transferred at all.
    then: (resolve: (v: unknown) => unknown) =>
      resolve({
        data: null,
        count: result.count ?? null,
        error: result.error ?? null,
      }),
  });

  const client = {
    from: vi.fn((table: string) => {
      calls.table = table;
      return chain;
    }),
  };

  mockedSupabase.mockReturnValue(client as never);
  return { calls, client };
}

beforeEach(() => {
  mockedSupabase.mockReset();
});

describe("fetchLeaderboardTotal — all-time population", () => {
  it("counts the UNCUT view, not the top-10 cut", async () => {
    // The whole bug in one assertion: 13 ranked players behind a 10-row board.
    const { calls } = makeClient({ count: 13 });

    await expect(fetchLeaderboardTotal()).resolves.toEqual(13);
    // `leaderboard_combined_v` is the cut and would answer 10 forever.
    expect(calls.table).toEqual("leaderboard_full_v");
  });

  it("transfers no rows to get the number", async () => {
    const { calls } = makeClient({ count: 13 });

    await fetchLeaderboardTotal();

    expect(calls.options).toEqual({ count: "exact", head: true });
  });

  it("returns null — not 0, not a row count — when the count fails", async () => {
    makeClient({ error: { message: "relation does not exist" } });

    await expect(fetchLeaderboardTotal()).resolves.toBeNull();
  });

  it("returns null when Supabase is unconfigured", async () => {
    mockedSupabase.mockReturnValue(null as never);

    await expect(fetchLeaderboardTotal()).resolves.toBeNull();
  });

  it("keeps a genuine zero as zero", async () => {
    // An empty board is a KNOWN population. Collapsing it into null would make
    // "nobody has played" indistinguishable from "the count broke".
    makeClient({ count: 0 });

    await expect(fetchLeaderboardTotal()).resolves.toEqual(0);
  });
});

describe("fetchWeeklyLeaderboardTotal — one surface only", () => {
  it("counts the weekly view filtered by the surface it was given", async () => {
    const { calls } = makeClient({ count: 3 });

    await expect(fetchWeeklyLeaderboardTotal("learn")).resolves.toEqual(3);

    expect(calls.table).toEqual("leaderboard_weekly_full_v");
    expect(calls.eq).toEqual({ surface: "learn" });
    expect(calls.options).toEqual({ count: "exact", head: true });
  });

  it("counts play separately — the view holds BOTH surfaces", async () => {
    // `leaderboard_weekly_full_v` cross-joins learn and play, so dropping the
    // filter would merge the two products into one population while every
    // score-shaped assertion still passed.
    const { calls } = makeClient({ count: 7 });

    await expect(fetchWeeklyLeaderboardTotal("play")).resolves.toEqual(7);
    expect(calls.eq).toEqual({ surface: "play" });
  });

  it("returns null when the count fails", async () => {
    makeClient({ error: { message: "boom" } });

    await expect(fetchWeeklyLeaderboardTotal("learn")).resolves.toBeNull();
  });

  it("returns null when Supabase is unconfigured", async () => {
    mockedSupabase.mockReturnValue(null as never);

    await expect(fetchWeeklyLeaderboardTotal("learn")).resolves.toBeNull();
  });
});
