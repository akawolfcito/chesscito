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

// fetchOnchainStats calls supabase.from() 15 times. Mock it so the
// position-based buildSupabaseStub fixture array is not consumed by the
// on-chain block, leaving fixture[13] available for the challenge funnel query.
const fetchOnchainStatsMock = vi.hoisted(() => vi.fn());
vi.mock("../onchain", async () => {
  const actual = await vi.importActual<typeof import("../onchain")>("../onchain");
  return {
    ...actual,
    fetchOnchainStats: fetchOnchainStatsMock,
  };
});

import {
  EMPTY_PUBLIC_STATS,
  getPublicStats,
} from "../public-aggregator";
import { EMPTY_ONCHAIN_STATS } from "../onchain";
import { deriveAvatarVariant, deriveRowId } from "@/lib/identity/identity-lite";

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
    eq: () => obj,
    gte: () => obj,
    in: () => obj,
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
 * `.from(...)` 14 times (the leaderboard promise bypasses `from`
 * via fetchLeaderboardFromDb mock):
 *   0-2  victories count queries (total, 7d, 30d)
 *   3    victories.player rows (distinct minters)
 *   4    victories.difficulty rows
 *   5-6  welcome_pack_claims count queries (lifetime, 7d)
 *   7-8  analytics_events session_id rows (7d, 30d)
 *   9-10 coach_analyses count queries (lifetime, 7d)
 *   11   victories HoF rows (top 10 by minted_at)
 *   12   victories.minted_at rows (trend chart mint series)
 *   13   analytics_events challenge funnel rows (B2.1, last 30d)
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

const EMPTY_FIXTURES: QueryFixture[] = Array.from({ length: 14 }, () => ({
  count: 0,
  data: [],
}));

describe("getPublicStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchLeaderboardFromDbMock.mockResolvedValue([]);
    // Prevent fetchOnchainStats from consuming from() fixtures —
    // it makes 15 from() calls which would displace the challenge
    // funnel fixture at index 13.
    fetchOnchainStatsMock.mockResolvedValue(EMPTY_ONCHAIN_STATS);
  });

  it("returns EMPTY_PUBLIC_STATS shape when Supabase env vars are missing", async () => {
    getSupabaseServerMock.mockReturnValue(null);

    const stats = await getPublicStats();

    // Every numeric field is null and every list is empty — but
    // generatedAt MUST be a fresh ISO string, not the epoch sentinel,
    // so a stale CDN snapshot is identifiable.
    expect(stats.totalVictories).toBe(EMPTY_PUBLIC_STATS.totalVictories);
    expect(stats.topMinters).toEqual([]);
    expect(stats.leaderboardTop10).toEqual([]);
    expect(Date.parse(stats.generatedAt)).toBeGreaterThan(0);
    expect(stats.generatedAt).not.toBe(EMPTY_PUBLIC_STATS.generatedAt);
    // §8 on-chain block present even on the no-Supabase path.
    expect(stats.onchain).toEqual(EMPTY_ONCHAIN_STATS);
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
      { count: null, data: [] }, // 12 mints trend (empty — dedicated test covers shape)
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
    // Identity-only rollups — no wallet, derived variant + opaque rowId.
    expect(stats.topMinters).toHaveLength(1);
    expect(stats.topMinters[0].mintCount).toBe(1);
    expect(stats.topMinters[0].rowId).toBe(deriveRowId("0xabc"));
    expect(stats.topMinters[0].variant).toEqual(deriveAvatarVariant("0xabc"));
    expect(stats.leaderboardTop10).toHaveLength(2);
    expect(stats.leaderboardTop10[0].rowId).toBe(deriveRowId("0xabc"));
    expect(stats.leaderboardTop10[0].totalScore).toBe(999);
    expect(JSON.stringify(stats.leaderboardTop10)).not.toContain("0x");
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
      { count: null, data: [] }, // 12 mints trend empty
    ];
    getSupabaseServerMock.mockReturnValue(buildSupabaseStub(fixtures));

    const stats = await getPublicStats();

    expect(stats.totalVictories).toBeNull();
    expect(stats.victories7d).toBe(1);
    expect(stats.victoriesByDifficulty).toEqual({ easy: 1, medium: 0, hard: 0 });
    expect(stats.topMinters).toEqual([]);
  });

  it("returns [] for hallOfFame and leaderboardTop10 when their sources fail", async () => {
    const fixtures: QueryFixture[] = [
      ...Array.from({ length: 11 }, () => ({ count: 0, data: [] })),
      { count: null, data: null, error: new Error("hof fail") }, // 11 hall of fame FAILS
      { count: null, data: [] }, // 12 mints trend (empty)
    ];
    getSupabaseServerMock.mockReturnValue(buildSupabaseStub(fixtures));
    fetchLeaderboardFromDbMock.mockRejectedValue(new Error("leaderboard fail"));

    const stats = await getPublicStats();

    expect(stats.topMinters).toEqual([]);
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
      ...Array.from({ length: 8 }, () => ({ count: 0, data: [] })),
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

  it("builds a dense 30-day activity trend with daily session + mint buckets", async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayKey = today.toISOString().slice(0, 10);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      .toISOString();
    const todayIso = today.toISOString();

    const fixtures: QueryFixture[] = [
      ...Array.from({ length: 8 }, () => ({ count: 0, data: [] })),
      // index 8 — sessions 30d rows feed both distinct count AND
      // daily session bucket. Two distinct sessions today + one
      // duplicate today + one different session yesterday.
      {
        count: null,
        data: [
          { session_id: "s-today-A", created_at: todayIso },
          { session_id: "s-today-B", created_at: todayIso },
          { session_id: "s-today-A", created_at: todayIso }, // duplicate
          { session_id: "s-yest-A", created_at: yesterday },
        ],
      },
      ...Array.from({ length: 3 }, () => ({ count: 0, data: [] })), // 9-11
      // index 12 — mints trend rows. Two mints today, one yesterday.
      {
        count: null,
        data: [
          { minted_at: todayIso },
          { minted_at: todayIso },
          { minted_at: yesterday },
        ],
      },
    ];
    getSupabaseServerMock.mockReturnValue(buildSupabaseStub(fixtures));

    const stats = await getPublicStats();

    // Dense 30-day window, today is the LAST bucket.
    expect(stats.activityTrend30d).toHaveLength(30);
    const last = stats.activityTrend30d[29];
    expect(last.date).toBe(todayKey);
    expect(last.sessions).toBe(2); // duplicate session_id collapsed
    expect(last.mints).toBe(2);

    const dayBefore = stats.activityTrend30d[28];
    expect(dayBefore.sessions).toBe(1);
    expect(dayBefore.mints).toBe(1);

    // Days with no activity stay at zero — chart can index by
    // position without skipping holes.
    const someEmptyDay = stats.activityTrend30d[5];
    expect(someEmptyDay.sessions).toBe(0);
    expect(someEmptyDay.mints).toBe(0);
  });

  it("returns an empty activityTrend30d when BOTH trend queries fail", async () => {
    const fixtures: QueryFixture[] = [
      ...Array.from({ length: 8 }, () => ({ count: 0, data: [] })),
      { count: null, data: null, error: new Error("sessions fail") }, // 8 sessions30d FAILS
      ...Array.from({ length: 3 }, () => ({ count: 0, data: [] })), // 9-11
      { count: null, data: null, error: new Error("mints fail") }, // 12 mints trend FAILS
      { count: 0, data: [] }, // 13 challenge funnel
    ];
    getSupabaseServerMock.mockReturnValue(buildSupabaseStub(fixtures));

    const stats = await getPublicStats();
    expect(stats.activityTrend30d).toEqual([]);
  });

  describe("challengeFunnel (B2.1)", () => {
    it("counts challenge events with isLite: true", async () => {
      const challengeRows = [
        { event: "challenge_link_opened", props: { isLite: true } },
        { event: "challenge_link_opened", props: { isLite: true } },
        { event: "challenge_started", props: { isLite: true } },
        { event: "challenge_completed", props: { isLite: true } },
        { event: "challenge_shared", props: { isLite: true } },
        { event: "challenge_continue_to_lite", props: { isLite: true } },
      ];
      const fixtures: QueryFixture[] = [
        ...Array.from({ length: 13 }, () => ({ count: 0, data: [] })),
        { count: null, data: challengeRows }, // 13 challenge funnel
      ];
      getSupabaseServerMock.mockReturnValue(buildSupabaseStub(fixtures));
      fetchLeaderboardFromDbMock.mockResolvedValue([]);

      const stats = await getPublicStats();
      expect(stats.challengeFunnel).not.toBeNull();
      expect(stats.challengeFunnel?.opens).toBe(2);
      expect(stats.challengeFunnel?.starts).toBe(1);
      expect(stats.challengeFunnel?.completions).toBe(1);
      expect(stats.challengeFunnel?.shares).toBe(1);
      expect(stats.challengeFunnel?.continueToLite).toBe(1);
    });

    it("returns challengeFunnel: null when the query fails", async () => {
      const fixtures: QueryFixture[] = [
        ...Array.from({ length: 13 }, () => ({ count: 0, data: [] })),
        { count: null, data: null, error: new Error("funnel fail") }, // 13 FAILS
      ];
      getSupabaseServerMock.mockReturnValue(buildSupabaseStub(fixtures));
      fetchLeaderboardFromDbMock.mockResolvedValue([]);

      const stats = await getPublicStats();
      expect(stats.challengeFunnel).toBeNull();
    });

    it("does not count challenge events without isLite: true", async () => {
      const challengeRows = [
        { event: "challenge_link_opened", props: { source: "challenge_link" } },
        { event: "challenge_started", props: null },
        { event: "challenge_completed", props: { isLite: false } },
      ];
      const fixtures: QueryFixture[] = [
        ...Array.from({ length: 13 }, () => ({ count: 0, data: [] })),
        { count: null, data: challengeRows }, // 13 challenge funnel — no isLite rows
      ];
      getSupabaseServerMock.mockReturnValue(buildSupabaseStub(fixtures));
      fetchLeaderboardFromDbMock.mockResolvedValue([]);

      const stats = await getPublicStats();
      expect(stats.challengeFunnel?.opens).toBe(0);
      expect(stats.challengeFunnel?.starts).toBe(0);
      expect(stats.challengeFunnel?.completions).toBe(0);
    });
  });
});
