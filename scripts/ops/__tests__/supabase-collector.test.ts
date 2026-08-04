/**
 * Supabase collector — behaviour under success, absence and failure.
 *
 * `run` is injected everywhere, so no test starts a container or reaches the
 * network. What is actually under test is the contract the rest of the monitor
 * depends on: it never throws, it never leaks a credential, and it degrades to
 * `not_observable` instead of taking the snapshot down with it.
 */

import { describe, expect, it, vi } from "vitest";

import {
  collectSupabase,
  hashSession,
  isDeltaComparable,
  isMissingRelationError,
  normalizeSessionStats,
  sanitizeError,
} from "../collectors/supabase";
import { buildSnapshotSql } from "../collectors/supabase-sql";
import { assertReadOnlySql } from "../lib/read-only-guard";
import type { CredentialName, OpsEnv } from "../lib/env";

const PASSWORD = "sup3r-s3cret-pw";

function fakeEnv(overrides: Partial<Record<CredentialName, string>> = {}): OpsEnv {
  const values: Partial<Record<CredentialName, string>> = {
    SUPABASE_URL: "https://brsbabcdefghijklmnop.supabase.co",
    SUPABASE_DB_PASSWORD: PASSWORD,
    LOG_SALT: "test-salt",
    ...overrides,
  };
  return {
    get: (n) => values[n],
    has: (n) => Boolean(values[n]),
    statuses: () => [],
  };
}

const PAYLOAD = {
  now: "2026-08-04T03:55:05+00:00",
  db_size_bytes: 86_000_000,
  analytics: {
    heap_bytes: 20_971_520,
    index_bytes: 42_991_616,
    total_bytes: 63_963_136,
    row_count: 99_542,
  },
  events_per_hour: [{ hour: "2026-08-04T03:00:00+00:00", events: 120 }],
  daily: [{ day: "2026-08-03", events: 46_337, sessions: 1_930, events_per_session: 24.0 }],
  top_events_1h: [{ event: "app_opened", events: 40 }],
  top_events_24h: [{ event: "app_opened", events: 8_412 }],
  top_sessions_1h: [
    { session_digest: "aaaaaaaaaaaa", events: 31 },
    { session_digest: "bbbbbbbbbbbb", events: 12 },
  ],
  session_stats_24h: {
    session_count: 2_411,
    p95_events: 73,
    p50_events: 15,
    max_events: 592,
  },
  server_version: "17.6",
  ingest_windows: {
    last_15m: { minutes: 15, events: 300, sessions: 20 },
    last_1h: { minutes: 60, events: 1_100, sessions: 60 },
    last_6h: { minutes: 360, events: 5_000, sessions: 200 },
    last_24h: { minutes: 1_440, events: 46_337, sessions: 1_930 },
  },
  peaks: {
    busiest_day: { day: "2026-08-03", events: 46_337, sessions: 1_930 },
    busiest_hour: { hour: "2026-08-03T18:00:00+00:00", events: 6_010 },
  },
  database: { stats_reset: "2026-08-04T01:00:00+00:00", blks_read: 10, temp_files: 0 },
  wal: { stats_reset: "2026-08-04T01:00:00+00:00", wal_records: 900 },
  bgwriter: { stats_reset: "2026-08-04T01:00:00+00:00", buffers_alloc: 42 },
  checkpointer: { stats_reset: "2026-08-04T01:00:00+00:00", num_timed: 3 },
  statements: { by_total_exec_time: [{ query: "select 1", calls: 5 }] },
  table_stats: { n_live_tup: 1_531, n_dead_tup: 0, last_autovacuum: null },
  index_stats: [{ index_name: "idx_analytics_events_event", idx_scan: 4, size_bytes: 5_242_880 }],
  cron_jobs: [{ jobid: 1, jobname: "prune_analytics_events_monthly", active: true }],
  cron_runs: [{ jobid: 1, status: "succeeded", start_time: "2026-08-01T03:00:00+00:00" }],
  connections: { active: 2, idle: 25, total: 27 },
  statements_available: true,
};

describe("success path", () => {
  it("parses the payload and reports latency", async () => {
    let tick = 1_000;
    const result = await collectSupabase(fakeEnv(), {
      run: () => JSON.stringify(PAYLOAD),
      now: () => (tick += 250),
    });

    expect(result.status).toBe("observable");
    if (result.status !== "observable") return;
    expect(result.analytics.row_count).toBe(99_542);
    expect(result.daily[0]?.events_per_session).toBe(24.0);
    expect(result.latency_ms).toBeGreaterThan(0);
  });

  it("passes the connection string through the ENV, never through argv", async () => {
    // argv is visible in `ps` on the host; container env is not.
    const run = vi.fn(() => JSON.stringify(PAYLOAD));
    await collectSupabase(fakeEnv(), { run });

    const [conn, sql] = run.mock.calls[0]!;
    expect(conn).toContain("postgresql://");
    expect(sql).toMatch(/^\s*select json_build_object/);
  });

  it("runs a query that passes the read-only guard", async () => {
    // The collector calls assertReadOnlySql itself; if that ever regressed,
    // this would throw rather than return.
    const result = await collectSupabase(fakeEnv(), { run: () => JSON.stringify(PAYLOAD) });
    expect(result.status).toBe("observable");
  });
});

describe("session privacy", () => {
  it("re-hashes session digests with LOG_SALT before they can be rendered", async () => {
    const result = await collectSupabase(fakeEnv(), { run: () => JSON.stringify(PAYLOAD) });
    if (result.status !== "observable") throw new Error("expected observable");

    const digests = result.top_sessions_1h.map((s) => s.session_digest);
    // The raw md5 prefix that came out of the database must not survive.
    expect(digests).not.toContain("aaaaaaaaaaaa");
    expect(digests[0]).toMatch(/^[0-9a-f]{12}$/);
  });

  it("degrades to a positional label rather than emit an unsalted digest", async () => {
    const result = await collectSupabase(
      fakeEnv({ LOG_SALT: undefined }),
      { run: () => JSON.stringify(PAYLOAD) },
    );
    if (result.status !== "observable") throw new Error("expected observable");

    expect(result.top_sessions_1h[0]?.session_digest).toBe("session#1");
    expect(JSON.stringify(result)).not.toContain("aaaaaaaaaaaa");
  });

  it("gives different sessions different digests", () => {
    const a = hashSession("aaaaaaaaaaaa", "salt", 0);
    const b = hashSession("bbbbbbbbbbbb", "salt", 1);
    expect(a).not.toBe(b);
  });
});

describe("degradation", () => {
  it("reports not_observable when credentials are missing — and does not throw", async () => {
    const result = await collectSupabase(
      fakeEnv({ SUPABASE_DB_PASSWORD: undefined }),
      { run: () => { throw new Error("must not be called"); } },
    );

    expect(result.status).toBe("not_observable");
    if (result.status !== "not_observable") return;
    expect(result.missing).toContain("SUPABASE_DB_PASSWORD");
  });

  it("reports not_observable when psql fails", async () => {
    const result = await collectSupabase(fakeEnv(), {
      run: () => { throw new Error("connection refused"); },
    });
    expect(result.status).toBe("not_observable");
  });

  it("reports not_observable when the payload is not JSON", async () => {
    const result = await collectSupabase(fakeEnv(), { run: () => "psql: FATAL: too many" });
    expect(result.status).toBe("not_observable");
    if (result.status !== "not_observable") return;
    expect(result.reason).toMatch(/not JSON/);
  });
});

describe("credential redaction in errors", () => {
  it("never lets the password reach a rendered reason", async () => {
    // psql echoes the connection string in some failures. This is the exact
    // path by which a monitor leaks its own credentials into a shared report.
    const result = await collectSupabase(fakeEnv(), {
      run: (conn) => { throw new Error(`could not connect to ${conn}`); },
    });

    expect(result.status).toBe("not_observable");
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(PASSWORD);
    expect(serialized).toContain("[REDACTED]");
  });

  it("sanitizeError strips connection strings and passwords", () => {
    expect(sanitizeError(new Error("x postgresql://u:p@h/db y"))).not.toContain("u:p@h");
    expect(sanitizeError(new Error("password=hunter2"))).not.toContain("hunter2");
  });

  it("sanitizeError bounds the output", () => {
    expect(sanitizeError(new Error("e".repeat(5_000))).length).toBeLessThanOrEqual(240);
  });
});

describe("ingest windows — rates, not extrapolations", () => {
  it("reports each window separately with its own span", async () => {
    const r = await collectSupabase(fakeEnv(), { run: () => JSON.stringify(PAYLOAD) });
    if (r.status !== "observable") throw new Error("expected observable");

    expect(r.ingest_windows.last_15m).toMatchObject({ minutes: 15, events: 300 });
    expect(r.ingest_windows.last_1h).toMatchObject({ minutes: 60, events: 1_100 });
    expect(r.ingest_windows.last_6h).toMatchObject({ minutes: 360, events: 5_000 });
    expect(r.ingest_windows.last_24h).toMatchObject({ minutes: 1_440, events: 46_337 });
  });

  it("carries the observed peaks, which is what capacity should be sized against", async () => {
    const r = await collectSupabase(fakeEnv(), { run: () => JSON.stringify(PAYLOAD) });
    if (r.status !== "observable") throw new Error("expected observable");

    expect(r.peaks.busiest_day).toMatchObject({ day: "2026-08-03", events: 46_337 });
    expect(r.peaks.busiest_hour?.events).toBe(6_010);
  });

  it("emits NO daily-rate field — extrapolating a short window is the bug", async () => {
    // A 15-minute sample scaled to a day suggested ~56K/day during development
    // while the 24h window said 46K. The collector must not pick one and call
    // it "the" rate; that is the renderer's problem, with all windows visible.
    const r = await collectSupabase(fakeEnv(), { run: () => JSON.stringify(PAYLOAD) });
    if (r.status !== "observable") throw new Error("expected observable");

    const keys = Object.keys(r);
    expect(keys).not.toContain("rows_per_day");
    expect(keys).not.toContain("growth_per_day");
    expect(keys).not.toContain("estimated_daily_rate");
  });
});

describe("cumulative blocks carry stats_reset", () => {
  it("every cumulative block exposes its own stats_reset", async () => {
    const r = await collectSupabase(fakeEnv(), { run: () => JSON.stringify(PAYLOAD) });
    if (r.status !== "observable") throw new Error("expected observable");

    for (const block of [r.database, r.wal, r.bgwriter, r.checkpointer]) {
      expect(block).toBeTruthy();
      expect(block).toHaveProperty("stats_reset");
    }
  });

  it("a delta is comparable only when stats_reset matches", () => {
    const a = { stats_reset: "2026-08-04T01:00:00+00:00" };
    const b = { stats_reset: "2026-08-04T01:00:00+00:00" };
    const c = { stats_reset: "2026-08-04T09:00:00+00:00" };

    expect(isDeltaComparable(a, b)).toBe(true);
    // The counters were zeroed between snapshots — this is what made a 98K-row
    // table report n_live_tup = 126 after the Nano→Micro resize.
    expect(isDeltaComparable(a, c)).toBe(false);
  });

  it("refuses a delta when either side lacks stats_reset", () => {
    expect(isDeltaComparable(null, { stats_reset: "x" })).toBe(false);
    expect(isDeltaComparable({ stats_reset: null }, { stats_reset: "x" })).toBe(false);
    expect(isDeltaComparable(undefined, undefined)).toBe(false);
  });
});

describe("version degradation", () => {
  it("retries without the optional blocks when a relation is missing", async () => {
    // pg_stat_checkpointer only exists on PG17+, and to_regclass cannot guard
    // it: Postgres resolves relations at parse time.
    const attempts: string[] = [];
    const r = await collectSupabase(fakeEnv(), {
      run: (_conn, sql) => {
        attempts.push(sql);
        if (sql.includes("pg_stat_checkpointer")) {
          throw new Error('ERROR: relation "pg_stat_checkpointer" does not exist');
        }
        return JSON.stringify({ ...PAYLOAD, checkpointer: null, cron_jobs: null, cron_runs: null });
      },
    });

    expect(attempts).toHaveLength(2);
    expect(r.status).toBe("observable");
    if (r.status !== "observable") return;
    expect(r.degraded_blocks).toContain("checkpointer");
    expect(r.degraded_blocks).toContain("cron_jobs");
  });

  it("does NOT retry on a timeout — that would only double the wait", async () => {
    const attempts: string[] = [];
    await collectSupabase(fakeEnv(), {
      run: (_c, sql) => { attempts.push(sql); throw new Error("ETIMEDOUT"); },
    });
    expect(attempts).toHaveLength(1);
  });

  it("reports no degradation on the normal path", async () => {
    const r = await collectSupabase(fakeEnv(), { run: () => JSON.stringify(PAYLOAD) });
    if (r.status !== "observable") throw new Error("expected observable");
    expect(r.degraded_blocks).toEqual([]);
  });

  it("isMissingRelationError only matches a missing relation", () => {
    expect(isMissingRelationError(new Error('relation "x" does not exist'))).toBe(true);
    expect(isMissingRelationError(new Error("ETIMEDOUT"))).toBe(false);
  });
});

describe("session p95 — population, not a top-N sample", () => {
  it("computes the percentile in PostgreSQL over the whole window", () => {
    for (const includeOptional of [true, false]) {
      const sql = buildSnapshotSql({ includeOptional });
      expect(sql).toContain("percentile_disc(0.95) within group");
      expect(sql).toContain("session_stats_24h");
    }
  });

  it("uses a 24-hour window for the population block", () => {
    const sql = buildSnapshotSql({ includeOptional: true });
    const block = sql.slice(sql.indexOf("'session_stats_24h'"));
    const body = block.slice(0, block.indexOf("'table_stats'"));
    expect(body).toContain("interval '24 hours'");
    expect(body).not.toContain("interval '1 hour'");
  });

  it("does NOT cap the population with a LIMIT", () => {
    // The whole defect: a top-20 slice is ordered by the very quantity being
    // percentiled, so its percentile can only describe itself.
    const sql = buildSnapshotSql({ includeOptional: true });
    const block = sql.slice(sql.indexOf("'session_stats_24h'"));
    const body = block.slice(0, block.indexOf("'table_stats'"));
    expect(body).not.toMatch(/limit\s+\d+/i);
  });

  it("ignores null and empty session ids", () => {
    const sql = buildSnapshotSql({ includeOptional: true });
    const block = sql.slice(sql.indexOf("'session_stats_24h'"));
    const body = block.slice(0, block.indexOf("'table_stats'"));
    expect(body).toContain("session_id is not null");
    expect(body).toContain("session_id <> ''");
  });

  it("keeps top_sessions_1h available as a diagnostic", () => {
    const sql = buildSnapshotSql({ includeOptional: true });
    expect(sql).toContain("'top_sessions_1h'");
  });

  it("reports the population size next to the percentile", () => {
    expect(buildSnapshotSql({ includeOptional: true })).toContain("session_count");
  });

  it("passes the read-only guard", () => {
    expect(() => assertReadOnlySql(buildSnapshotSql({ includeOptional: true }))).not.toThrow();
  });
});

describe("session p95 — normalisation", () => {
  it("carries the population block through the collector", async () => {
    const result = await collectSupabase(fakeEnv(), {
      run: () => JSON.stringify(PAYLOAD),
      now: () => 1_785_810_000_000,
    });
    if (result.status !== "observable") throw new Error("expected observable");
    expect(result.session_stats_24h).toEqual({
      session_count: 2_411,
      p95_events: 73,
      p50_events: 15,
      max_events: 592,
    });
  });

  it("an empty window has NO p95 — never a fabricated zero", () => {
    // A zero would read as "no session emits anything", which is the opposite
    // of "we could not measure it".
    expect(
      normalizeSessionStats({ session_count: 0, p95_events: null, p50_events: null, max_events: null }),
    ).toEqual({ session_count: 0, p95_events: null, p50_events: null, max_events: null });
  });

  it("a single session yields that session's own count as the p95", () => {
    // percentile_disc over one row is that row. Documented, not accidental.
    expect(
      normalizeSessionStats({ session_count: 1, p95_events: 12, p50_events: 12, max_events: 12 }),
    ).toMatchObject({ session_count: 1, p95_events: 12 });
  });

  it("a missing or malformed block degrades to null without throwing", () => {
    for (const raw of [undefined, null, "nope", 42, {}, { session_count: "x" }]) {
      expect(() => normalizeSessionStats(raw)).not.toThrow();
      expect(normalizeSessionStats(raw)).toBeNull();
    }
  });

  it("a payload without the block does not take the run down", async () => {
    const { session_stats_24h: _omitted, ...withoutBlock } = PAYLOAD;
    const result = await collectSupabase(fakeEnv(), {
      run: () => JSON.stringify(withoutBlock),
      now: () => 1_785_810_000_000,
    });
    expect(result.status).toBe("observable");
    if (result.status !== "observable") return;
    expect(result.session_stats_24h).toBeNull();
  });

  it("never emits a raw session id", async () => {
    const result = await collectSupabase(fakeEnv(), {
      run: () => JSON.stringify(PAYLOAD),
      now: () => 1_785_810_000_000,
    });
    // The population block is pure counts; the diagnostic sample is digested.
    expect(JSON.stringify(result)).not.toContain("aaaaaaaaaaaa");
  });
});

describe("SQL shape", () => {
  it("both variants pass the read-only guard", () => {
    for (const includeOptional of [true, false]) {
      expect(() => assertReadOnlySql(buildSnapshotSql({ includeOptional }))).not.toThrow();
    }
  });

  it("the reduced variant drops exactly the version-dependent blocks", () => {
    const reduced = buildSnapshotSql({ includeOptional: false });
    expect(reduced).not.toContain("pg_stat_checkpointer");
    expect(reduced).not.toContain("cron.job");
    // …and keeps everything that exists on every supported server.
    expect(reduced).toContain("pg_stat_wal");
    expect(reduced).toContain("pg_stat_bgwriter");
    expect(reduced).toContain("pg_stat_database");
  });

  it("reads pg_stat_statements by all four requested orderings", () => {
    const sql = buildSnapshotSql({ includeOptional: true });
    for (const key of [
      "by_total_exec_time",
      "by_shared_blks_read",
      "by_temp_blks_read",
      "by_temp_blks_written",
    ]) {
      expect(sql).toContain(key);
    }
  });
});
