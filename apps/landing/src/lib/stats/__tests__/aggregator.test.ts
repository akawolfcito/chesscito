/**
 * Behaviour of the RPC-fed aggregator: shape, filter plumbing, and — the part
 * that matters most — what happens when a call fails.
 *
 * ⛔ No production count is pinned anywhere. `analytics_events` takes ~2,000
 * rows every 40 minutes, so any number asserted here would be true at the hour
 * it was written and false by dinner. These tests assert SHAPE, MAPPING and
 * FAILURE BEHAVIOUR; the values are verified against the database by
 * `scripts/ops/verify-stats-rpcs.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getSupabaseServer = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => getSupabaseServer(),
}));

const fetchOnchainStats = vi.fn();
vi.mock("../onchain", async () => {
  const actual = await vi.importActual<typeof import("../onchain")>("../onchain");
  return { ...actual, fetchOnchainStats: () => fetchOnchainStats() };
});

import { getPublicStats, STATS_RPCS } from "../aggregator";
import { EMPTY_ONCHAIN_STATS } from "../onchain";

/** Row payloads shaped exactly like the migration's `returns table (...)`. */
const ROWS: Record<string, Record<string, unknown>[]> = {
  stats_install_counts: [
    { sessions_7d: 11, sessions_30d: 22, app_opens_rows_30d: 33, app_open_sessions_30d: 44 },
  ],
  stats_activation_funnel: [
    { step: "app_opened", sessions: 100 },
    { step: "hub_viewed", sessions: 90 },
    { step: "exercise_started", sessions: 40 },
  ],
  stats_access_funnel: [
    { step: "gate_viewed", sessions: 50, failed_sessions: 7 },
    { step: "connected", sessions: 20, failed_sessions: 7 },
  ],
  stats_top_countries: [
    { country: "NG", sessions: 9 },
    { country: "KE", sessions: 5 },
  ],
  stats_retention: [
    { bucket: "d1", returned: 5, cohort: 50 },
    { bucket: "d7", returned: 2, cohort: 20 },
    { bucket: "week3", returned: 0, cohort: 0 },
  ],
  stats_account_lifecycle: [
    {
      known: 10, new_today: 2, new_7d: 4,
      active_7d: 7, dormant: 2, inactive: 1, resurrected_7d: 1,
    },
  ],
  stats_habit_depth: [
    { min_days: 1, installs: 10, cohort: 10, median_active_days: 3 },
    { min_days: 3, installs: 4, cohort: 10, median_active_days: 3 },
  ],
  stats_activity_trend: [
    { day: "2026-08-01T00:00:00.000Z", sessions: 3, new_installs: 1, returning_installs: 2 },
    { day: "2026-08-02", sessions: 0, new_installs: 0, returning_installs: 0 },
  ],
};

/** A client whose `rpc` answers from ROWS, with per-name overrides for the
 *  failure cases. `calls` records what the aggregator actually asked for. */
function makeClient(overrides: Record<string, { data?: unknown; error?: unknown } | "throw"> = {}) {
  const calls: Array<{ name: string; args: Record<string, string | null> }> = [];
  return {
    calls,
    client: {
      rpc: (name: string, args: Record<string, string | null>) => {
        calls.push({ name, args });
        const override = overrides[name];
        if (override === "throw") return Promise.reject(new Error("boom"));
        if (override) return Promise.resolve({ data: null, error: null, ...override });
        return Promise.resolve({ data: ROWS[name] ?? [], error: null });
      },
    },
  };
}

beforeEach(() => {
  fetchOnchainStats.mockResolvedValue(EMPTY_ONCHAIN_STATS);
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("without Supabase", () => {
  it("returns the all-em-dash contract instead of throwing", async () => {
    getSupabaseServer.mockReturnValue(null);
    const stats = await getPublicStats();

    expect(stats.installs).toBeNull();
    expect(stats.activation).toBeNull();
    expect(stats.accountLifecycle).toBeNull();
    expect(stats.retention).toBeNull();
    expect(stats.habitDepth).toBeNull();
    expect(stats.accessFunnel).toBeNull();
    expect(stats.topCountries).toEqual([]);
    expect(stats.activityTrend30d).toEqual([]);
    expect(stats.onchain).toEqual(EMPTY_ONCHAIN_STATS);
  });

  it("still stamps a real generatedAt and echoes the filters", async () => {
    getSupabaseServer.mockReturnValue(null);
    const stats = await getPublicStats({ surface: "learn", container: "minipay" });

    expect(stats.filters).toEqual({ surface: "learn", container: "minipay" });
    expect(Date.parse(stats.generatedAt)).toBeGreaterThan(0);
  });
});

describe("filter plumbing", () => {
  it("sends null for `all` — the string must never reach SQL", async () => {
    const { client, calls } = makeClient();
    getSupabaseServer.mockReturnValue(client);
    await getPublicStats({ surface: "all", container: "all" });

    expect(calls).toHaveLength(8);
    for (const call of calls) {
      expect(call.args).toEqual({ p_surface: null, p_container: null });
    }
  });

  it("passes a real filter to all eight, not just some", async () => {
    const { client, calls } = makeClient();
    getSupabaseServer.mockReturnValue(client);
    await getPublicStats({ surface: "play", container: "browser" });

    expect(calls.map((c) => c.name).sort()).toEqual([...STATS_RPCS].sort());
    for (const call of calls) {
      expect(call.args).toEqual({ p_surface: "play", p_container: "browser" });
    }
  });
});

describe("mapping", () => {
  it("maps every snake_case column to its camelCase field", async () => {
    const { client } = makeClient();
    getSupabaseServer.mockReturnValue(client);
    const stats = await getPublicStats();

    expect(stats.installs).toEqual({
      sessions7d: 11, sessions30d: 22, appOpensRows30d: 33, appOpenSessions30d: 44,
    });
    expect(stats.accountLifecycle).toEqual({
      known: 10, newToday: 2, new7d: 4,
      active7d: 7, dormant: 2, inactive: 1, resurrected7d: 1,
    });
    expect(stats.retention).toEqual({
      d1: { returned: 5, cohort: 50 },
      d7: { returned: 2, cohort: 20 },
      week3: { returned: 0, cohort: 0 },
    });
  });

  it("lifts the repeated funnel scalar off the first row", async () => {
    const { client } = makeClient();
    getSupabaseServer.mockReturnValue(client);
    const stats = await getPublicStats();

    expect(stats.accessFunnel?.failedSessions).toBe(7);
    expect(stats.accessFunnel?.steps).toHaveLength(2);
    expect(stats.habitDepth?.cohort).toBe(10);
    expect(stats.habitDepth?.medianActiveDays).toBe(3);
  });

  it("echoes app_opened into appOpens30d", async () => {
    const { client } = makeClient();
    getSupabaseServer.mockReturnValue(client);
    expect((await getPublicStats()).appOpens30d).toBe(100);
  });

  it("preserves the SQL ordering of top countries instead of re-sorting", async () => {
    const { client } = makeClient();
    getSupabaseServer.mockReturnValue(client);
    const stats = await getPublicStats();
    expect(stats.topCountries.map((c) => c.country)).toEqual(["NG", "KE"]);
  });

  it("normalises the trend day to YYYY-MM-DD whichever way postgres spells it", async () => {
    const { client } = makeClient();
    getSupabaseServer.mockReturnValue(client);
    const stats = await getPublicStats();
    expect(stats.activityTrend30d.map((d) => d.date)).toEqual(["2026-08-01", "2026-08-02"]);
  });

  it("keeps a zero-cohort retention bucket instead of dropping it", async () => {
    // `cohort: 0` means "nobody was eligible yet" — week3 will read 0 until
    // ~2026-08-20 because session_first_seen was created on 2026-07-23. The UI
    // must be able to tell that apart from "nobody returned", so the row has to
    // survive the mapping.
    const { client } = makeClient();
    getSupabaseServer.mockReturnValue(client);
    const stats = await getPublicStats();
    expect(stats.retention?.week3).toEqual({ returned: 0, cohort: 0 });
  });
});

describe("partial failure", () => {
  it("nulls only the failing block and names it", async () => {
    const { client } = makeClient({
      stats_top_countries: { error: { message: "nope" } },
    });
    getSupabaseServer.mockReturnValue(client);
    const stats = await getPublicStats();

    expect(stats.topCountries).toEqual([]);
    expect(stats.dataIntegrity.failedRpcs).toEqual(["stats_top_countries"]);
    // Everything else survives.
    expect(stats.installs).not.toBeNull();
    expect(stats.activation).not.toBeNull();
    expect(stats.accountLifecycle).not.toBeNull();
  });

  it("survives a REJECTED promise, not just an error payload", async () => {
    const { client } = makeClient({ stats_habit_depth: "throw" });
    getSupabaseServer.mockReturnValue(client);
    const stats = await getPublicStats();

    expect(stats.habitDepth).toBeNull();
    expect(stats.dataIntegrity.failedRpcs).toEqual(["stats_habit_depth"]);
    expect(stats.installs).not.toBeNull();
  });

  it("nulls retention when a bucket is missing — a broken contract, not an empty one", async () => {
    const { client } = makeClient({
      stats_retention: { data: [{ bucket: "d1", returned: 1, cohort: 2 }] },
    });
    getSupabaseServer.mockReturnValue(client);
    expect((await getPublicStats()).retention).toBeNull();
  });

  it("reports several failures at once", async () => {
    const { client } = makeClient({
      stats_install_counts: { error: { message: "x" } },
      stats_activity_trend: "throw",
    });
    getSupabaseServer.mockReturnValue(client);
    const stats = await getPublicStats();

    expect(stats.dataIntegrity.failedRpcs.sort()).toEqual([
      "stats_activity_trend",
      "stats_install_counts",
    ]);
    expect(stats.installs).toBeNull();
    expect(stats.activityTrend30d).toEqual([]);
  });

  it("never returns 0 in place of a failed measurement", async () => {
    const { client } = makeClient({
      stats_install_counts: "throw",
      stats_account_lifecycle: "throw",
    });
    getSupabaseServer.mockReturnValue(client);
    const stats = await getPublicStats();

    // A zero would assert "nobody did this" — the opposite claim.
    expect(stats.installs).toBeNull();
    expect(stats.accountLifecycle).toBeNull();
    expect(stats.appOpens30d).not.toBe(0);
  });

  it("keeps the page alive when the on-chain block throws", async () => {
    fetchOnchainStats.mockRejectedValue(new Error("chain down"));
    const { client } = makeClient();
    getSupabaseServer.mockReturnValue(client);
    const stats = await getPublicStats();

    expect(stats.onchain).toEqual(EMPTY_ONCHAIN_STATS);
    expect(stats.installs).not.toBeNull();
  });

  it("empty rows are NOT a failure — an empty ranking is a real answer", async () => {
    const { client } = makeClient({ stats_top_countries: { data: [] } });
    getSupabaseServer.mockReturnValue(client);
    const stats = await getPublicStats();

    expect(stats.topCountries).toEqual([]);
    expect(stats.dataIntegrity.failedRpcs).toEqual([]);
  });
});
