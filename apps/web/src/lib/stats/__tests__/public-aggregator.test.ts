import { describe, it, expect, vi, beforeEach } from "vitest";

const getSupabaseServerMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: getSupabaseServerMock,
}));

const fetchLeaderboardFromDbMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/queries", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/supabase/queries")
  >("@/lib/supabase/queries");
  return {
    ...actual,
    fetchLeaderboardFromDb: fetchLeaderboardFromDbMock,
  };
});

import {
  EMPTY_PUBLIC_STATS,
  getPublicStats,
} from "../public-aggregator";

/**
 * Builds a thenable mock that resolves to `value` and supports the
 * chainable Supabase query API used by the aggregator:
 *   .select(...).gte(...).order(...).limit(...)
 *
 * Each chainable returns the same thenable so resolution always lands
 * on `value` regardless of how many qualifiers were appended.
 */
function thenable<T>(value: T) {
  const obj: Record<string, unknown> = {
    then: (resolve: (v: T) => unknown) => Promise.resolve(value).then(resolve),
    gte: () => obj,
    order: () => obj,
    limit: () => obj,
    range: () => obj,
  };
  return obj;
}

type QueryFixture = {
  count?: number | null;
  data?: unknown[] | null;
  error?: unknown;
};

/**
 * Sequencer for `supabase.from(...)`: returns one fixture per call,
 * matched to the aggregator's invocation order. The aggregator calls
 * `.from(...)` 12 times (the 13th promise — leaderboard — bypasses
 * `from` via fetchLeaderboardFromDb mock).
 */
function buildSupabaseStub(fixtures: QueryFixture[]) {
  const calls = [...fixtures];
  return {
    from: vi.fn(() => {
      const next = calls.shift();
      const fixture = next ?? { count: null, data: null };
      return {
        select: () =>
          thenable({
            count: fixture.count ?? null,
            data: fixture.data ?? null,
            error: fixture.error,
          }),
      };
    }),
  };
}

const EMPTY_FIXTURES: QueryFixture[] = Array.from({ length: 12 }, () => ({
  count: 0,
  data: [],
}));

describe("getPublicStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchLeaderboardFromDbMock.mockResolvedValue([]);
  });

  it("returns EMPTY_PUBLIC_STATS shape when Supabase env vars are missing", async () => {
    getSupabaseServerMock.mockReturnValue(null);

    const stats = await getPublicStats();

    // Every numeric field is null and every list is empty — but
    // generatedAt MUST be a fresh ISO string, not the epoch sentinel,
    // so a stale CDN snapshot is identifiable.
    expect(stats.totalVictories).toBe(EMPTY_PUBLIC_STATS.totalVictories);
    expect(stats.hallOfFame).toEqual([]);
    expect(stats.leaderboardTop10).toEqual([]);
    expect(Date.parse(stats.generatedAt)).toBeGreaterThan(0);
    expect(stats.generatedAt).not.toBe(EMPTY_PUBLIC_STATS.generatedAt);
  });

  it("aggregates happy-path counts and rows from Supabase + leaderboard helper", async () => {
    const fixtures: QueryFixture[] = [
      { count: 42, data: null }, // 0 totalVictories
      { count: 7, data: null }, // 1 victories7d
      { count: 12, data: null }, // 2 victories30d
      { count: null, data: [{ player: "0xaaa" }, { player: "0xbbb" }, { player: "0xaaa" }] }, // 3 unique minters (2 distinct)
      { count: null, data: [{ difficulty: 1 }, { difficulty: 2 }, { difficulty: 2 }, { difficulty: 3 }] }, // 4 difficulty tally
      { count: 100, data: null }, // 5 welcome packs lifetime
      { count: 9, data: null }, // 6 welcome packs 7d
      { count: null, data: [{ session_id: "s1" }, { session_id: "s2" }, { session_id: "s1" }] }, // 7 sessions 7d (2 distinct)
      { count: null, data: [{ session_id: "s1" }, { session_id: "s3" }, { session_id: "s4" }, { session_id: "s2" }] }, // 8 sessions 30d (4 distinct)
      { count: 33, data: null }, // 9 coach analyses lifetime
      { count: 5, data: null }, // 10 coach analyses 7d
      {
        count: null,
        data: [
          {
            token_id: 1,
            player: "0xabc",
            difficulty: 2,
            total_moves: 35,
            time_ms: 60000,
            tx_hash: "0xtxhash1",
            minted_at: "2026-06-01T00:00:00Z",
          },
        ],
      }, // 11 hall of fame
    ];
    getSupabaseServerMock.mockReturnValue(buildSupabaseStub(fixtures));
    fetchLeaderboardFromDbMock.mockResolvedValue([
      { rank: 1, player: "0xabc", total_score: 999, is_verified: true },
      { rank: 2, player: "0xdef", total_score: 800, is_verified: false },
    ]);

    const stats = await getPublicStats();

    expect(stats.totalVictories).toBe(42);
    expect(stats.victories7d).toBe(7);
    expect(stats.victories30d).toBe(12);
    expect(stats.uniqueMintersLifetime).toBe(2);
    expect(stats.victoriesByDifficulty).toEqual({ easy: 1, medium: 2, hard: 1 });
    expect(stats.welcomePacksLifetime).toBe(100);
    expect(stats.welcomePacks7d).toBe(9);
    expect(stats.activeSessions7d).toBe(2);
    expect(stats.activeSessions30d).toBe(4);
    expect(stats.coachAnalysesLifetime).toBe(33);
    expect(stats.coachAnalyses7d).toBe(5);
    expect(stats.hallOfFame).toHaveLength(1);
    expect(stats.hallOfFame[0].token_id).toBe(1);
    expect(stats.leaderboardTop10).toHaveLength(2);
    expect(stats.leaderboardTop10[0].player).toBe("0xabc");
  });

  it("renders null for failed count queries while keeping siblings intact", async () => {
    const fixtures: QueryFixture[] = [
      { count: null, data: null, error: new Error("rpc fail") }, // 0 totalVictories FAILS
      { count: 1, data: null }, // 1 victories7d OK
      { count: 1, data: null }, // 2 victories30d OK
      { count: null, data: [{ player: "0xa" }] }, // 3 unique minters OK
      { count: null, data: [{ difficulty: 1 }] }, // 4 difficulty OK
      { count: 1, data: null }, // 5 welcome packs lifetime OK
      { count: 1, data: null }, // 6 welcome packs 7d OK
      { count: null, data: [{ session_id: "s" }] }, // 7
      { count: null, data: [{ session_id: "s" }] }, // 8
      { count: 1, data: null }, // 9
      { count: 1, data: null }, // 10
      { count: null, data: [] }, // 11 hall of fame empty
    ];
    getSupabaseServerMock.mockReturnValue(buildSupabaseStub(fixtures));

    const stats = await getPublicStats();

    expect(stats.totalVictories).toBeNull();
    expect(stats.victories7d).toBe(1);
    expect(stats.victoriesByDifficulty).toEqual({ easy: 1, medium: 0, hard: 0 });
    expect(stats.hallOfFame).toEqual([]);
  });

  it("returns [] for hallOfFame and leaderboardTop10 when their sources fail", async () => {
    const fixtures: QueryFixture[] = [
      ...Array.from({ length: 11 }, () => ({ count: 0, data: [] })),
      { count: null, data: null, error: new Error("hof fail") }, // 11 hall of fame FAILS
    ];
    getSupabaseServerMock.mockReturnValue(buildSupabaseStub(fixtures));
    fetchLeaderboardFromDbMock.mockRejectedValue(new Error("leaderboard fail"));

    const stats = await getPublicStats();

    expect(stats.hallOfFame).toEqual([]);
    expect(stats.leaderboardTop10).toEqual([]);
  });

  it("drops unmapped difficulty values silently (defensive against legacy rows)", async () => {
    const fixtures: QueryFixture[] = [
      ...Array.from({ length: 4 }, () => ({ count: 0, data: [] })),
      {
        count: null,
        data: [
          { difficulty: 1 },
          { difficulty: 2 },
          { difficulty: 3 },
          { difficulty: 0 }, // legacy / unmapped
          { difficulty: 99 }, // future band
        ],
      },
      ...Array.from({ length: 7 }, () => ({ count: 0, data: [] })),
    ];
    getSupabaseServerMock.mockReturnValue(buildSupabaseStub(fixtures));

    const stats = await getPublicStats();
    expect(stats.victoriesByDifficulty).toEqual({ easy: 1, medium: 1, hard: 1 });
  });

  it("emits an ISO generatedAt timestamp on every call", async () => {
    getSupabaseServerMock.mockReturnValue(buildSupabaseStub(EMPTY_FIXTURES));

    const stats = await getPublicStats();

    expect(typeof stats.generatedAt).toBe("string");
    expect(Date.parse(stats.generatedAt)).not.toBeNaN();
  });
});
