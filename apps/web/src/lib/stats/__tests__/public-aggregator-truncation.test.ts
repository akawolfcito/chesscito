import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The 1,000-row transport ceiling.
 *
 * PostgREST caps every response at `db-max-rows` and an explicit `.range()`
 * does NOT lift it — asking for `0-9999` comes back as `Content-Range 0-999/…`.
 * The aggregator believed otherwise for months and published the newest ~15
 * minutes of traffic under labels reading "7d" and "30d": 46 sessions against a
 * real 3,928, and "1,000 accounts ever seen · 1,000 arrived today · 1,000 this
 * week" — one capped list counted three times.
 *
 * Every test here fails against that code.
 * Evidence: `docs/audits/2026-08-04-public-stats-accuracy-audit.md` §9.
 */

const getSupabaseServerMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: getSupabaseServerMock,
}));

const fetchLeaderboardFromDbMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/queries", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/supabase/queries")
  >("@/lib/supabase/queries");
  return { ...actual, fetchLeaderboardFromDb: fetchLeaderboardFromDbMock };
});

const fetchOnchainStatsMock = vi.hoisted(() => vi.fn());
vi.mock("../onchain", async () => {
  const actual = await vi.importActual<typeof import("../onchain")>("../onchain");
  return { ...actual, fetchOnchainStats: fetchOnchainStatsMock };
});

import { getPublicStats } from "../public-aggregator";
import { EMPTY_ONCHAIN_STATS } from "../onchain";

/** What the server will actually hand back, measured against production. */
const SERVER_CAP = 1_000;

/**
 * Positional index of each `supabase.from()` call the aggregator makes.
 * The leaderboard goes through `fetchLeaderboardFromDb`, so it consumes no slot.
 */
const CALL = {
  sessions7d: 7,
  sessions30d: 8,
  mintsTrend: 12,
  events30d: 14,
  cohorts: 15,
  access: 16,
  firstSeen: 17,
  accountsKnown: 18,
  accountsToday: 19,
  accounts7d: 20,
  accountRows: 21,
} as const;

type QueryFixture = { count?: number | null; data?: unknown[] | null; error?: unknown };

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

/** Fixtures by call index; anything unspecified resolves to nulls. */
function stubAt(fixtures: Record<number, QueryFixture>) {
  let call = -1;
  return {
    from: vi.fn(() => {
      call += 1;
      const fixture = fixtures[call] ?? { count: null, data: null };
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

/** A read that came back exactly full — the signature of a capped response. */
function cappedSessions(): { session_id: string; created_at: string }[] {
  const iso = new Date().toISOString();
  return Array.from({ length: SERVER_CAP }, (_, i) => ({
    session_id: `s${i % 46}`, // 46 distinct — the number production published
    created_at: iso,
  }));
}

function cappedAccounts(): { account_ref: string; first_seen: string }[] {
  const iso = new Date().toISOString();
  return Array.from({ length: SERVER_CAP }, (_, i) => ({
    account_ref: `a${i}`,
    first_seen: iso,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchLeaderboardFromDbMock.mockResolvedValue([]);
  fetchOnchainStatsMock.mockResolvedValue(EMPTY_ONCHAIN_STATS);
});

describe("the ceiling is the one the server enforces", () => {
  it("declares 1,000 rows, not 10,000", async () => {
    getSupabaseServerMock.mockReturnValue(stubAt({}));

    const stats = await getPublicStats();

    // 10,000 was a size the server can never return, so `hitCeiling` was
    // unsatisfiable and the page never warned anyone.
    expect(stats.dataIntegrity.rowCeiling).toBe(SERVER_CAP);
  });

  it("flags a read that came back with exactly 1,000 rows", async () => {
    getSupabaseServerMock.mockReturnValue(
      stubAt({ [CALL.sessions7d]: { data: cappedSessions() } }),
    );

    const stats = await getPublicStats();

    expect(stats.dataIntegrity.truncated).toContain("app sessions (7d)");
  });

  it("stays quiet when every read came back short", async () => {
    getSupabaseServerMock.mockReturnValue(
      stubAt({
        [CALL.sessions7d]: { data: cappedSessions().slice(0, SERVER_CAP - 1) },
      }),
    );

    const stats = await getPublicStats();

    expect(stats.dataIntegrity.truncated).toEqual([]);
  });
});

describe("a capped read never becomes a published number", () => {
  it("nulls the 7d session count instead of publishing the Set size", async () => {
    getSupabaseServerMock.mockReturnValue(
      stubAt({ [CALL.sessions7d]: { data: cappedSessions() } }),
    );

    const stats = await getPublicStats();

    // The fixture holds 46 distinct sessions over 1,000 rows — precisely the
    // shape that put "Approx. App Sessions (7d) 46" on a public page.
    expect(stats.activeSessions7d).toBeNull();
  });

  it("nulls the 30d session count too", async () => {
    getSupabaseServerMock.mockReturnValue(
      stubAt({ [CALL.sessions30d]: { data: cappedSessions() } }),
    );

    const stats = await getPublicStats();

    expect(stats.activeSessions30d).toBeNull();
  });

  it("nulls the activation funnel, app opens, countries and habit depth", async () => {
    const iso = new Date().toISOString();
    getSupabaseServerMock.mockReturnValue(
      stubAt({
        [CALL.events30d]: {
          data: Array.from({ length: SERVER_CAP }, (_, i) => ({
            event: "app_opened",
            session_id: `s${i % 37}`,
            created_at: iso,
            country: "NG",
            account_ref: `a${i % 37}`,
          })),
        },
      }),
    );

    const stats = await getPublicStats();

    expect(stats.activation).toBeNull();
    expect(stats.appOpens30d).toBeNull();
    expect(stats.topCountries).toEqual([]);
    expect(stats.habitDepth).toBeNull();
  });

  it("nulls retention when the cohort read is capped", async () => {
    const iso = new Date().toISOString();
    getSupabaseServerMock.mockReturnValue(
      stubAt({
        [CALL.cohorts]: {
          data: Array.from({ length: SERVER_CAP }, (_, i) => ({
            session_id: `s${i}`,
            first_seen: iso,
          })),
        },
      }),
    );

    const stats = await getPublicStats();

    // A capped cohort read returns only the newest first_seen rows — all born
    // today — so every band comes back empty and the page rendered "—" already.
    // The difference is that now it is declared instead of inferred.
    expect(stats.retention).toBeNull();
    expect(stats.dataIntegrity.truncated).toContain("retention cohorts (30d)");
  });

  it("nulls the access funnel when its own narrow read is capped", async () => {
    getSupabaseServerMock.mockReturnValue(
      stubAt({
        [CALL.access]: {
          data: Array.from({ length: SERVER_CAP }, (_, i) => ({
            event: "web_access_gate_viewed",
            session_id: `s${i}`,
          })),
        },
      }),
    );

    const stats = await getPublicStats();

    expect(stats.accessFunnel).toBeNull();
  });

  it("hides the trend rather than drawing 29 empty days", async () => {
    getSupabaseServerMock.mockReturnValue(
      stubAt({ [CALL.sessions30d]: { data: cappedSessions() } }),
    );

    const stats = await getPublicStats();

    // Four panels share one bucket array, so there is no way to blank one
    // series without printing zeros for it — and 30 bars of zero read as
    // "traffic collapsed", not as "not measured".
    expect(stats.activityTrend30d).toEqual([]);
  });

  it("hides the trend when the cohort read alone is capped", async () => {
    const iso = new Date().toISOString();
    getSupabaseServerMock.mockReturnValue(
      stubAt({
        [CALL.firstSeen]: {
          data: Array.from({ length: SERVER_CAP }, (_, i) => ({
            session_id: `s${i}`,
            first_seen: iso,
          })),
        },
      }),
    );

    const stats = await getPublicStats();

    // This is what produced "New installs 46 · Returning 0": with only the
    // newest 1,000 first_seen rows in hand, every install looks brand new.
    expect(stats.activityTrend30d).toEqual([]);
  });
});

describe("nothing degrades into zero", () => {
  it("returns null, never 0, for every capped metric", async () => {
    const iso = new Date().toISOString();
    getSupabaseServerMock.mockReturnValue(
      stubAt({
        [CALL.sessions7d]: { data: cappedSessions() },
        [CALL.sessions30d]: { data: cappedSessions() },
        [CALL.events30d]: {
          data: Array.from({ length: SERVER_CAP }, (_, i) => ({
            event: "app_opened",
            session_id: `s${i}`,
            created_at: iso,
            country: "NG",
            account_ref: `a${i}`,
          })),
        },
        [CALL.accountRows]: { data: cappedAccounts() },
        [CALL.accountsKnown]: { count: 3_077 },
        [CALL.accountsToday]: { count: 1_578 },
        [CALL.accounts7d]: { count: 3_058 },
      }),
    );

    const stats = await getPublicStats();

    for (const value of [
      stats.activeSessions7d,
      stats.activeSessions30d,
      stats.appOpens30d,
      stats.accountLifecycle?.active7d,
      stats.accountLifecycle?.dormant,
      stats.accountLifecycle?.inactive,
      stats.accountLifecycle?.resurrected7d,
    ]) {
      expect(value).toBeNull();
    }

    // "Inactive 962" was the worst of these: the real figure was 0, so the card
    // was not merely low — it was inverted. A zero here would assert "nobody is
    // inactive"; null says "we could not measure it".
    expect(stats.accountLifecycle?.inactive).not.toBe(0);
  });
});

describe("account head counts are exact and independent", () => {
  it("takes known / newToday / new7d from count reads, not from row length", async () => {
    getSupabaseServerMock.mockReturnValue(
      stubAt({
        // The row scan is capped at 1,000 — the very read that used to supply
        // all three figures, and the reason all three read 1,000.
        [CALL.accountRows]: { data: cappedAccounts() },
        [CALL.accountsKnown]: { count: 3_077 },
        [CALL.accountsToday]: { count: 1_578 },
        [CALL.accounts7d]: { count: 3_058 },
      }),
    );

    const stats = await getPublicStats();

    expect(stats.accountLifecycle?.known).toBe(3_077);
    expect(stats.accountLifecycle?.newToday).toBe(1_578);
    expect(stats.accountLifecycle?.new7d).toBe(3_058);
  });

  it("lets the three disagree with each other", async () => {
    getSupabaseServerMock.mockReturnValue(
      stubAt({
        [CALL.accountRows]: { data: cappedAccounts() },
        [CALL.accountsKnown]: { count: 3_077 },
        [CALL.accountsToday]: { count: 1_578 },
        [CALL.accounts7d]: { count: 3_058 },
      }),
    );

    const life = (await getPublicStats()).accountLifecycle!;

    // Three identical values was the tell: they were one capped list counted
    // three times. Distinct counts cannot collapse that way.
    expect(new Set([life.known, life.newToday, life.new7d]).size).toBe(3);
  });

  it("nulls the whole block when the count reads fail — never falls back to rows", async () => {
    getSupabaseServerMock.mockReturnValue(
      stubAt({ [CALL.accountRows]: { data: cappedAccounts() } }),
    );

    const stats = await getPublicStats();

    expect(stats.accountLifecycle).toBeNull();
  });

  it("keeps the partition when both reads come back whole", async () => {
    const iso = new Date().toISOString();
    getSupabaseServerMock.mockReturnValue(
      stubAt({
        [CALL.accountRows]: {
          data: [
            { account_ref: "a", first_seen: iso },
            { account_ref: "b", first_seen: iso },
          ],
        },
        [CALL.events30d]: {
          data: [
            {
              event: "app_opened",
              session_id: "s1",
              created_at: iso,
              country: "NG",
              account_ref: "a",
            },
          ],
        },
        [CALL.accountsKnown]: { count: 2 },
        [CALL.accountsToday]: { count: 2 },
        [CALL.accounts7d]: { count: 2 },
      }),
    );

    const life = (await getPublicStats()).accountLifecycle!;

    expect(life.active7d).toBe(1);
    expect(life.inactive).toBe(1);
    // The partition must close against the EXACT denominator, not against the
    // length of whatever the row read happened to return.
    expect(life.active7d! + life.dormant! + life.inactive!).toBe(life.known);
  });
});

describe("source guard — the comment that carried the defect", () => {
  const files = [
    "src/lib/stats/public-aggregator.ts",
    "src/lib/stats/onchain.ts",
  ];

  /** Both files carried the identical false claim: the constant was copied and
   *  the prose was copied with it. Only a source guard catches that. */
  it("never claims an explicit range bypasses the cap", () => {
    for (const file of files) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/explicit range bypasses/i);
      expect(source).not.toMatch(/dodge PostgREST/i);
    }
  });

  it("never asks for more rows than the server will return", () => {
    for (const file of files) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      // Targets CODE, not prose: both files quote `0-9999` as the measurement
      // that proved the cap, and that evidence has to stay readable. What must
      // not come back is a range bound or a constant above 1,000.
      const code = source
        .split("\n")
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join("\n");
      const bounds = [
        ...code.matchAll(/\.range\(\s*0\s*,\s*([A-Za-z0-9_]+)\s*\)/g),
      ].map((m) => m[1]!);

      expect(bounds.length).toBeGreaterThan(0);
      // A literal here is the shape of the defect: the bound has to come from
      // the one constant that documents why it cannot be raised.
      expect(
        bounds.filter(
          (id) => id !== "RANGE_TO" && id !== "ONCHAIN_QUERY_MAX_ROWS",
        ),
      ).toEqual([]);
    }
  });

  it("pins both row constants to what the server actually returns", () => {
    const aggregator = readFileSync(
      path.join(process.cwd(), files[0]!),
      "utf8",
    );
    const onchain = readFileSync(path.join(process.cwd(), files[1]!), "utf8");

    // 1,000 rows is the cap; 999 is the inclusive `to` bound that asks for them.
    expect(aggregator).toMatch(/const POSTGREST_MAX_ROWS = 1_000;/);
    expect(onchain).toMatch(/const ONCHAIN_QUERY_MAX_ROWS = 999;/);
  });
});
