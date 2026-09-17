import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ redis: vi.fn(), get: vi.fn(), supabase: vi.fn() }));
vi.mock("next/headers", () => ({ headers: () => new Headers({ "accept-language": "en" }) }));
vi.mock("@/lib/stats/redis", () => ({ getStatsRedis: mocks.redis }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: mocks.supabase }));
vi.mock("@/components/stats/stats-dashboard", () => ({ StatsDashboard: () => null }));

import StatsPage from "../page";
import { asPersistedSnapshot, STATS_SNAPSHOT_KEY } from "@/lib/stats/persisted-snapshot";
import { EMPTY_PUBLIC_STATS } from "@/lib/stats/types";
import { EMPTY_PLAYERS_CENSUS } from "@/lib/stats/players-census";

describe("public stats reads at runtime", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.redis.mockReturnValue({ get: mocks.get });
    mocks.supabase.mockImplementation(() => { throw new Error("Public stats must not reach Supabase"); });
  });

  it("repeated visits, locales and filters read the same durable value without RPCs", async () => {
    const snapshot = asPersistedSnapshot({
      stats: { ...EMPTY_PUBLIC_STATS, generatedAt: "2026-09-15T00:00:00.000Z" },
      breakdown: { learn: null, play: null, total: null },
      census: EMPTY_PLAYERS_CENSUS,
      availability: {
        onchain: "temporarily_unavailable", census: "temporarily_unavailable", breakdown: "temporarily_unavailable",
        rpcs: Object.fromEntries([
          "stats_install_counts", "stats_activation_funnel", "stats_access_funnel", "stats_top_countries",
          "stats_retention", "stats_account_lifecycle", "stats_habit_depth", "stats_activity_trend",
        ].map((rpc) => [rpc, "temporarily_unavailable"])) as never,
      },
    });
    mocks.get.mockResolvedValue(snapshot);
    const views = await Promise.all([
      StatsPage({}), StatsPage({}),
      StatsPage({ searchParams: { locale: "es", surface: "learn", container: "minipay" } }),
      StatsPage({ searchParams: { locale: "en", surface: "play", container: "browser" } }),
    ]);
    expect(mocks.get.mock.calls).toEqual(Array.from({ length: 4 }, () => [STATS_SNAPSHOT_KEY]));
    expect(mocks.supabase).not.toHaveBeenCalled();
    for (const view of views) {
      expect(view.props.stats).toEqual(snapshot.stats);
      expect(view.props.stats.generatedAt).toBe("2026-09-15T00:00:00.000Z");
      expect(view.props.stats.filters).toEqual({ surface: "all", container: "all" });
      expect(view.props.filtersUnavailable).toBe(true);
      expect(view.props.snapshotUnavailable).toBe(false);
      expect(Object.keys(view.props.stats).sort()).toEqual(Object.keys(EMPTY_PUBLIC_STATS).sort());
    }
    expect(views[2].props.locale).toBe("es");
  });

  it.each(["missing", "Redis failure", "not configured"])("a %s snapshot renders unavailable without DB fallback", async (reason) => {
    if (reason === "not configured") mocks.redis.mockReturnValue(null);
    else if (reason === "Redis failure") mocks.get.mockRejectedValue(new Error("test failure"));
    else mocks.get.mockResolvedValue(null);
    const view = await StatsPage({});
    expect(view.props.snapshotUnavailable).toBe(true);
    expect(mocks.supabase).not.toHaveBeenCalled();
  });
});
