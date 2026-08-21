/**
 * Supabase collector — read-only, one round trip in the normal case.
 *
 * ── Transport ─────────────────────────────────────────────────────────────
 *
 * `psql` inside a throwaway `postgres:16-alpine` container, because there is no
 * local psql and the direct DB host is IPv6-only. The session-mode pooler at
 * `aws-1-…` is the address that actually resolves (`aws-0-…` answers
 * "tenant or user not found" and is a well-known dead end here).
 *
 * The connection string is passed as a container ENV VAR, never as an argv
 * element: argv is visible in `ps` on the host, container env is not. It is
 * never logged, never returned, and never rendered.
 *
 * ── Why ONE query ─────────────────────────────────────────────────────────
 *
 * Each `docker run` costs ~4–5 s of container start; thirteen separate probes
 * measured a full minute. Folding every metric into one `json_build_object`
 * brings a complete snapshot to ~1.5 s.
 *
 * ── Degradation ───────────────────────────────────────────────────────────
 *
 * Version-dependent views (`pg_stat_checkpointer`, PG17+) and optional
 * extensions (`cron.*`) cannot be guarded with `to_regclass`, because Postgres
 * resolves relations at parse time. So the collector tries the full statement
 * and, if it fails with "does not exist", retries once without the optional
 * blocks. One round trip normally, two on an older or leaner server, and a
 * report that says which blocks it could not read.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

import { assertReadOnlySql } from "../lib/read-only-guard";
import { parseSupabaseRef, type OpsEnv } from "../lib/env";
import { buildSnapshotSql } from "./supabase-sql";
import { childEnv } from "../lib/child-env";

export { SUPABASE_SNAPSHOT_SQL, buildSnapshotSql } from "./supabase-sql";

export const SUPABASE_POOLER_HOST = "aws-1-us-east-1.pooler.supabase.com";
export const SUPABASE_POOLER_PORT = 5432;
export const DOCKER_PG_IMAGE = "postgres:16-alpine";
export const SUPABASE_TIMEOUT_MS = 20_000;

export type IngestWindow = { minutes: number; events: number; sessions: number };

export type SupabaseSnapshot = {
  status: "observable";
  latency_ms: number;
  /** Optional blocks the server could not provide (empty in the normal case). */
  degraded_blocks: string[];
  now: string;
  server_version: string;
  db_size_bytes: number;
  analytics: {
    heap_bytes: number;
    index_bytes: number;
    total_bytes: number;
    row_count: number;
    oldest: string | null;
    newest: string | null;
  };
  /** Per-window rates. NOT extrapolated to a daily regime — see `supabase-sql`. */
  ingest_windows: {
    last_15m: IngestWindow;
    last_1h: IngestWindow;
    last_6h: IngestWindow;
    last_24h: IngestWindow;
  };
  peaks: {
    busiest_day: { day: string; events: number; sessions: number } | null;
    busiest_hour: { hour: string; events: number } | null;
  };
  events_per_hour: Array<{ hour: string; events: number }>;
  daily: Array<{
    day: string;
    events: number;
    sessions: number;
    events_per_session: number | null;
  }>;
  top_events_1h: Array<{ event: string; events: number }>;
  top_events_24h: Array<{ event: string; events: number }>;
  /**
   * DIAGNOSTIC ONLY — a top-20 sample, never a distribution.
   *
   * It is ordered by the same quantity one would want to percentile, so any
   * percentile taken over it belongs to the sample, not the population. That
   * is exactly how a healthy system produced a RED: the client-side p95 over
   * these 20 rows returned the SECOND noisiest session of the hour (measured:
   * 182, equal to the real p99, while the real p95 was 77).
   */
  top_sessions_1h: Array<{ session_digest: string; events: number }>;
  /**
   * The distribution the classifier reads. Computed in PostgreSQL over EVERY
   * session in the window. `null` when the query could not run — never a
   * fabricated zero, which would read as "no session emits anything".
   */
  session_stats_24h: {
    session_count: number;
    p95_events: number | null;
    p50_events: number | null;
    max_events: number | null;
  } | null;
  table_stats: Record<string, unknown> | null;
  index_stats: Array<{ index_name: string; idx_scan: number; size_bytes: number }>;
  database: (Record<string, unknown> & { stats_reset: string | null }) | null;
  wal: (Record<string, unknown> & { stats_reset: string | null }) | null;
  bgwriter: (Record<string, unknown> & { stats_reset: string | null }) | null;
  checkpointer: (Record<string, unknown> & { stats_reset: string | null }) | null;
  cron_jobs: Array<Record<string, unknown>> | null;
  cron_runs: Array<Record<string, unknown>> | null;
  statements: Record<string, Array<Record<string, unknown>>> | null;
  connections: { active: number; idle: number; total: number } | null;
};

export type SupabaseNotObservable = {
  status: "not_observable";
  /** Safe to render: never contains a credential (see `sanitizeError`). */
  reason: string;
  missing: string[];
};

export type SupabaseResult = SupabaseSnapshot | SupabaseNotObservable;

/**
 * Cumulative counters may only be diffed against a previous snapshot that
 * reports the SAME `stats_reset`. A resize, a crash or a manual reset zeroes
 * them, and subtracting across that boundary produces a large negative or a
 * meaningless positive — the exact failure that made a 98 K-row table report
 * `n_live_tup = 126` after the Nano→Micro move.
 */
export function isDeltaComparable(
  previous: { stats_reset?: string | null } | null | undefined,
  current: { stats_reset?: string | null } | null | undefined,
): boolean {
  if (!previous || !current) return false;
  const a = previous.stats_reset ?? null;
  const b = current.stats_reset ?? null;
  if (a === null || b === null) return false;
  return a === b;
}

/**
 * Re-hash a session digest with LOG_SALT so two snapshots cannot be joined by a
 * third party and the digest cannot be walked back to a session id. Without a
 * salt the collector emits a positional label rather than an unsalted digest.
 */
export function hashSession(
  digest: string,
  salt: string | undefined,
  index: number,
): string {
  if (!salt) return `session#${index + 1}`;
  return createHash("sha256").update(`session:${digest}${salt}`).digest("hex").slice(0, 12);
}

/**
 * Strip anything credential-shaped out of an error before it can be rendered.
 * psql echoes the connection string in several of its failure messages.
 */
export function sanitizeError(raw: unknown): string {
  const text = raw instanceof Error ? `${raw.message}` : String(raw);
  return text
    .replace(/postgresql:\/\/[^\s"']+/gi, "postgresql://[REDACTED]")
    .replace(/password=[^\s"'&]+/gi, "password=[REDACTED]")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" | ")
    .slice(0, 240);
}

/** A missing relation is recoverable by dropping the optional blocks. */
export function isMissingRelationError(raw: unknown): boolean {
  const text = raw instanceof Error ? `${raw.message}` : String(raw);
  return /does not exist|no existe/i.test(text);
}

export type SupabaseDeps = {
  /** Injected so tests never touch docker or the network. */
  run?: (conn: string, sql: string, timeoutMs: number) => string;
  now?: () => number;
};

function defaultRun(conn: string, sql: string, timeoutMs: number): string {
  return execFileSync(
    "docker",
    [
      "run", "--rm", "-i",
      // ⛔ Names only. This comment used to claim the value "never" reached
      // argv while `-e NAME=value` put it there — see lib/child-env.ts.
      "-e", "PGCONN",
      "-e", "PGQUERY",
      DOCKER_PG_IMAGE,
      "sh", "-c",
      // -t tuples only, -A unaligned: stdout is exactly the JSON document.
      'psql "$PGCONN" -v ON_ERROR_STOP=1 -t -A -c "$PGQUERY"',
    ],
    {
      encoding: "utf8",
      timeout: timeoutMs,
      stdio: ["pipe", "pipe", "pipe"],
      env: childEnv({ PGCONN: conn, PGQUERY: sql }),
    },
  );
}

const OPTIONAL_BLOCKS = ["checkpointer", "statements", "cron_jobs", "cron_runs"];

export async function collectSupabase(
  env: OpsEnv,
  deps: SupabaseDeps = {},
): Promise<SupabaseResult> {
  const missing: string[] = [];
  if (!env.has("SUPABASE_URL")) missing.push("SUPABASE_URL");
  if (!env.has("SUPABASE_DB_PASSWORD")) missing.push("SUPABASE_DB_PASSWORD");

  const ref = parseSupabaseRef(env.get("SUPABASE_URL"));
  if (!ref && !missing.includes("SUPABASE_URL")) {
    missing.push("SUPABASE_URL (unparseable project ref)");
  }
  if (missing.length > 0) {
    return { status: "not_observable", reason: "credentials not configured", missing };
  }

  const password = encodeURIComponent(env.get("SUPABASE_DB_PASSWORD")!);
  const conn =
    `postgresql://postgres.${ref}:${password}` +
    `@${SUPABASE_POOLER_HOST}:${SUPABASE_POOLER_PORT}/postgres?sslmode=require`;

  const run = deps.run ?? defaultRun;
  const clock = deps.now ?? Date.now;
  const startedAt = clock();

  let raw: string | undefined;
  let degraded: string[] = [];
  let lastError: unknown;

  for (const includeOptional of [true, false]) {
    const sql = assertReadOnlySql(buildSnapshotSql({ includeOptional }));
    try {
      raw = run(conn, sql, SUPABASE_TIMEOUT_MS);
      degraded = includeOptional ? [] : [...OPTIONAL_BLOCKS];
      break;
    } catch (error) {
      lastError = error;
      // Only a missing relation is worth a second attempt. A timeout or an
      // auth failure would fail identically and just double the wait.
      if (!includeOptional || !isMissingRelationError(error)) break;
    }
  }

  if (raw === undefined) {
    return { status: "not_observable", reason: sanitizeError(lastError), missing: [] };
  }

  const latency = clock() - startedAt;

  let parsed: Omit<SupabaseSnapshot, "status" | "latency_ms" | "degraded_blocks">;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    return {
      status: "not_observable",
      reason: "psql returned a payload that was not JSON",
      missing: [],
    };
  }

  const salt = env.get("LOG_SALT");
  return {
    ...parsed,
    status: "observable",
    latency_ms: latency,
    degraded_blocks: degraded,
    top_sessions_1h: (parsed.top_sessions_1h ?? []).map((row, index) => ({
      session_digest: hashSession(row.session_digest, salt, index),
      events: row.events,
    })),
    session_stats_24h: normalizeSessionStats(parsed.session_stats_24h),
  };
}

/**
 * Normalise the population block.
 *
 * An empty window yields `session_count = 0` and null percentiles, and that is
 * kept as-is: a zero-session window has no p95, and inventing one — 0 — would
 * be read as "no session emits anything", which is the opposite of unknown.
 */
export function normalizeSessionStats(
  raw: unknown,
): SupabaseSnapshot["session_stats_24h"] {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;

  const num = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const count = num(row.session_count);
  if (count === null) return null;

  return {
    session_count: count,
    p95_events: count > 0 ? num(row.p95_events) : null,
    p50_events: count > 0 ? num(row.p50_events) : null,
    max_events: count > 0 ? num(row.max_events) : null,
  };
}
