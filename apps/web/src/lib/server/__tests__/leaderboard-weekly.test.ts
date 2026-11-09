/**
 * Slice 2B — the weekly data layer (API-3, API-4, API-12, API-15).
 *
 * Spec: docs/specs/2026-07-29-leaders-weekly-api.md
 *
 * Covers the two guarantees the SQL cannot give itself, because it fails
 * SILENTLY on both (Slice 2A, "Contract provided"):
 *   - the wallet must arrive lowercased, or it matches zero rows and the
 *     endpoint answers `player: null` — a valid, specified state, so the bug
 *     looks exactly like "you have not played this week";
 *   - `has_onchain` does not exist in the weekly relation, so the mapper must
 *     not invent it as `false`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: vi.fn() }));

import { getSupabaseServer } from "@/lib/supabase/server";
import {
  fetchWeeklyLeaderboard,
  fetchWeeklyPlayerRank,
} from "../leaderboard";

const mockedSupabase = vi.mocked(getSupabaseServer);

const WINDOW = {
  start: new Date("2026-07-27T00:00:00.000Z"),
  end: new Date("2026-08-03T00:00:00.000Z"),
};

/** EIP-55 checksummed, which is what wagmi hands the sheet. */
const CHECKSUMMED = "0xAAAAbbbbccccddddeeeeffff0000111122223333";
const LOWER = CHECKSUMMED.toLowerCase();

const dbRow = (over: Partial<Record<string, unknown>> = {}) => ({
  wallet: LOWER,
  total_score: 420,
  rank: 3,
  is_verified: false,
  ...over,
});

/** A `.from(...).select(...).eq(...)…` chain that records what it was given. */
function makeViewChain(rows: unknown[]) {
  const calls: { table?: string; eq: Record<string, unknown> } = { eq: {} };
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  Object.assign(chain, {
    select: vi.fn(self),
    order: vi.fn(self),
    limit: vi.fn(() => Promise.resolve({ data: rows, error: null })),
    eq: vi.fn((col: string, val: unknown) => {
      calls.eq[col] = val;
      return chain;
    }),
    then: (resolve: (v: unknown) => unknown) =>
      resolve({ data: rows, error: null }),
  });
  return { chain, calls };
}

function makeClient(opts: {
  rpc?: { data?: unknown; error?: unknown };
  viewRows?: unknown[];
}) {
  const view = makeViewChain(opts.viewRows ?? []);
  const rpc = vi.fn((_name: string, _args?: Record<string, unknown>) =>
    Promise.resolve({
      data: opts.rpc?.data ?? null,
      error: opts.rpc?.error ?? null,
    }),
  );
  const from = vi.fn((table: string) => {
    view.calls.table = table;
    return view.chain;
  });
  return { client: { rpc, from }, rpc, from, view };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchWeeklyPlayerRank — wallet normalisation (API-3, API-4)", () => {
  it("lowercases a checksummed address before it reaches SQL", () => {
    const { client, rpc } = makeClient({ rpc: { data: [dbRow()] } });
    mockedSupabase.mockReturnValue(client as never);

    return fetchWeeklyPlayerRank(CHECKSUMMED, "learn", WINDOW).then(() => {
      expect(rpc).toHaveBeenCalledWith(
        "get_weekly_player_rank",
        expect.objectContaining({ p_player: LOWER }),
      );
      // The exact failure this guards: the raw checksummed string reaching a
      // column constrained to '^0x[0-9a-f]{40}$'.
      const args = rpc.mock.calls[0]?.[1] as { p_player: string } | undefined;
      expect(args?.p_player).not.toBe(CHECKSUMMED);
    });
  });

  it("does not answer null for a checksummed address that has a row", async () => {
    const { client } = makeClient({ rpc: { data: [dbRow()] } });
    mockedSupabase.mockReturnValue(client as never);

    const row = await fetchWeeklyPlayerRank(CHECKSUMMED, "learn", WINDOW);
    expect(row).not.toBeNull();
    expect(row!.rank).toBe(3);
  });

  it("passes the window and the surface through untouched", async () => {
    const { client, rpc } = makeClient({ rpc: { data: [dbRow()] } });
    mockedSupabase.mockReturnValue(client as never);

    await fetchWeeklyPlayerRank(CHECKSUMMED, "play", WINDOW);
    expect(rpc).toHaveBeenCalledWith("get_weekly_player_rank", {
      p_player: LOWER,
      p_surface: "play",
      p_week_start: WINDOW.start.toISOString(),
      p_week_end: WINDOW.end.toISOString(),
    });
  });

  it("returns null when the wallet has no row in the window", async () => {
    const { client } = makeClient({ rpc: { data: [] } });
    mockedSupabase.mockReturnValue(client as never);

    expect(await fetchWeeklyPlayerRank(CHECKSUMMED, "learn", WINDOW)).toBeNull();
  });
});

describe("weekly row mapping (API-12)", () => {
  it("never emits hasOnchain — absent, not false", async () => {
    const { client } = makeClient({ rpc: { data: [dbRow()] } });
    mockedSupabase.mockReturnValue(client as never);

    const rows = await fetchWeeklyLeaderboard("learn", WINDOW);
    // `toBeFalsy()` and `toBe(false)` would both pass on the bug this catches:
    // toApiRow writes `hasOnchain: r.has_onchain ?? false`.
    expect("hasOnchain" in rows[0]!).toBe(false);
  });

  it("reads the identity column as `wallet`, not `player`", async () => {
    const { client } = makeClient({ rpc: { data: [dbRow()] } });
    mockedSupabase.mockReturnValue(client as never);

    const rows = await fetchWeeklyLeaderboard("learn", WINDOW);
    // A mapper reading r.player would derive these from undefined.
    expect(rows[0]!.rowId).toBeTruthy();
    expect(rows[0]!.variant).toBeTruthy();
  });

  it("never leaks a full wallet on a foreign row", async () => {
    const { client } = makeClient({ rpc: { data: [dbRow()] } });
    mockedSupabase.mockReturnValue(client as never);

    const rows = await fetchWeeklyLeaderboard("learn", WINDOW);
    expect(rows[0]!.walletShort).toBeUndefined();
    expect(JSON.stringify(rows[0])).not.toContain(LOWER);
  });

  it("carries walletShort on the caller's OWN row", async () => {
    const { client } = makeClient({ rpc: { data: [dbRow()] } });
    mockedSupabase.mockReturnValue(client as never);

    const row = await fetchWeeklyPlayerRank(CHECKSUMMED, "learn", WINDOW);
    expect(row!.walletShort).toBeTruthy();
  });

  it("maps total_score onto score and keeps is_verified", async () => {
    const { client } = makeClient({
      rpc: { data: [dbRow({ total_score: 777, is_verified: true })] },
    });
    mockedSupabase.mockReturnValue(client as never);

    const rows = await fetchWeeklyLeaderboard("learn", WINDOW);
    expect(rows[0]!.score).toBe(777);
    expect(rows[0]!.isVerified).toBe(true);
  });
});

describe("RPC → view fallback (API-15)", () => {
  it("falls back to the view, filtered by the SAME surface", async () => {
    const { client, view } = makeClient({
      rpc: { error: { message: "schema cache stale" } },
      viewRows: [dbRow()],
    });
    mockedSupabase.mockReturnValue(client as never);

    const rows = await fetchWeeklyLeaderboard("play", WINDOW);
    expect(view.calls.table).toBe("leaderboard_weekly_full_v");
    // Dropping this filter is the failure that matters: it would merge both
    // products into one board while every other assertion still passed.
    expect(view.calls.eq.surface).toBe("play");
    expect(rows).toHaveLength(1);
  });

  it("filters the fallback by the LOWERCASED wallet too", async () => {
    const { client, view } = makeClient({
      rpc: { error: { message: "down" } },
      viewRows: [dbRow()],
    });
    mockedSupabase.mockReturnValue(client as never);

    await fetchWeeklyPlayerRank(CHECKSUMMED, "learn", WINDOW);
    expect(view.calls.eq.wallet).toBe(LOWER);
    expect(view.calls.eq.surface).toBe("learn");
  });

  it("produces rows shaped exactly like the RPC path", async () => {
    const viaView = makeClient({
      rpc: { error: { message: "down" } },
      viewRows: [dbRow()],
    });
    mockedSupabase.mockReturnValue(viaView.client as never);
    const fallbackRows = await fetchWeeklyLeaderboard("learn", WINDOW);

    const viaRpc = makeClient({ rpc: { data: [dbRow()] } });
    mockedSupabase.mockReturnValue(viaRpc.client as never);
    const rpcRows = await fetchWeeklyLeaderboard("learn", WINDOW);

    expect(fallbackRows).toEqual(rpcRows);
  });
});

describe("unconfigured Supabase", () => {
  it("returns an empty board rather than throwing", async () => {
    mockedSupabase.mockReturnValue(null as never);
    expect(await fetchWeeklyLeaderboard("learn", WINDOW)).toEqual([]);
  });

  it("returns a null own row rather than throwing", async () => {
    mockedSupabase.mockReturnValue(null as never);
    expect(await fetchWeeklyPlayerRank(CHECKSUMMED, "learn", WINDOW)).toBeNull();
  });
});
