/**
 * `pnpm ops:archive` — export the analytics history out of hot Postgres into a
 * private, verifiable Parquet archive.
 *
 *   pnpm ops:archive --from 2026-08-10 --to 2026-08-17   # half-open, UTC
 *   pnpm ops:archive --all                               # range resolved FROM production
 *   pnpm ops:archive --verify-only private/archive/manifest.json
 *
 * Productionizes the process proven on 2026-08-17
 * (`docs/audits/2026-08-17-supabase-historical-archive-recoverability.md`:
 * 45.324 rows, 7/7 partitions, 25/25 metric parity against Postgres).
 *
 * ── Why production cannot be written, in order of strength ────────────────
 *
 *  1. **The connection.** DuckDB attaches Postgres with `(TYPE POSTGRES,
 *     READ_ONLY)`. A write is refused by the engine, not by our intentions —
 *     which is the only guarantee worth having.
 *  2. **`assertNoWrites`**, defence in depth, before the container starts. It
 *     distinguishes writes against `pg.` from the LOCAL `COPY`/`CREATE` the
 *     export legitimately needs; a guard that banned both would be turned off
 *     the first time somebody needed it.
 *  3. **`assertUnderArchiveRoot`.** Output can only land under
 *     `private/archive/`, which is gitignored. The archive holds raw
 *     `account_ref` and unredacted `props`, so a path that escaped there would
 *     be a privacy incident, not an inconvenience.
 *
 * Secrets never reach stdout: the password rides in the child process env, and
 * every error passes through `redactSecrets`, which also masks the Supabase
 * project ref as `[REF]` — a Docker error leaked it once on 2026-08-17.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { childEnv } from "./lib/child-env";
import { loadOpsEnv, parseSupabaseRef } from "./lib/env";

const POOLER_HOST = "aws-1-us-east-1.pooler.supabase.com";
const POOLER_PORT = 5432;
const DOCKER_PG_IMAGE = "postgres:16-alpine";
const DUCKDB_IMAGE = "duckdb/duckdb:latest";
const TIMEOUT_MS = 1_800_000;

/** ⛔ The ONLY directory the tool may write to. Gitignored. */
export const ARCHIVE_ROOT_SUFFIX = "private/archive";

export type DateRange = { from: string; to: string };

export type Command =
  | { kind: "export"; range: DateRange }
  | { kind: "export-all" }
  | { kind: "verify"; manifestPath: string };

/**
 * ⛔ A partition HAS files, it is not one.
 *
 * Found by running `--all` against production on 2026-08-17: DuckDB splits a
 * large day across several Parquet files (2026-08-05 produced three). The first
 * shape recorded one entry per file and verification then reported a perfectly
 * good multi-file day as MISSING. Counts belong to the partition; checksums
 * belong to the file.
 */
export type ArchiveFile = {
  table: string;
  filename: string;
  /** UTC date for an event file; the table name for a snapshot. */
  partition: string;
  bytes: number;
  sha256: string;
};

export type PartitionSummary = {
  partition: string;
  rows: number;
  min_ts: string | null;
  max_ts: string | null;
};

export type Manifest = {
  created_at: string;
  range: DateRange;
  partitions: PartitionSummary[];
  files: ArchiveFile[];
};

export type ObservedPartition = {
  partition: string;
  rows: number;
  min_ts: string | null;
  max_ts: string | null;
};

/* ── argument parsing ───────────────────────────────────────────────────── */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(value: string | undefined, flag: string): string {
  if (!value || !DATE_RE.test(value)) {
    throw new Error(`${flag} must be a date in YYYY-MM-DD form, got ${value ?? "(nothing)"}`);
  }
  // Rejects 2026-13-01 and 2026-02-30: Date normalizes them, so a round-trip
  // that changes the string is proof the date does not exist.
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${flag} is not a real calendar date: ${value}`);
  }
  return value;
}

export function parseArgs(argv: readonly string[]): Command {
  const at = (flag: string) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };

  if (argv.includes("--verify-only")) {
    const manifestPath = at("--verify-only");
    if (!manifestPath) throw new Error("--verify-only needs a manifest path");
    return { kind: "verify", manifestPath };
  }
  if (argv.includes("--all")) return { kind: "export-all" };

  const from = assertDate(at("--from"), "--from");
  const to = assertDate(at("--to"), "--to");
  if (!(to > from)) {
    throw new Error(`--to (${to}) must be after --from (${from}); an empty range exports nothing`);
  }
  return { kind: "export", range: { from, to } };
}

/**
 * Turn production's own min/max into a half-open UTC range.
 *
 * ⚠️ `to` is the day AFTER the last event. A `to` equal to the last date would
 * drop that whole day, and the loss would look exactly like a quiet day.
 */
export function resolveAllRange(minTs: string, maxTs: string): DateRange {
  // Postgres emits `+00`, which `Date` rejects — it wants `+00:00` or `Z`.
  // Left unnormalized this throws, and the `--all` range would never resolve.
  const day = (ts: string) => {
    const normalized = ts.trim().replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) throw new Error(`unparseable timestamp: ${ts}`);
    return parsed.toISOString().slice(0, 10);
  };
  const from = day(minTs);
  const last = new Date(`${day(maxTs)}T00:00:00Z`);
  last.setUTCDate(last.getUTCDate() + 1);
  return { from, to: last.toISOString().slice(0, 10) };
}

/* ── safety ─────────────────────────────────────────────────────────────── */

const WRITE_VERBS =
  /\b(delete|update|insert|upsert|merge|truncate|drop|alter|vacuum|reindex|grant|revoke)\b/i;

/**
 * Refuse anything that could mutate production.
 *
 * `CREATE`/`COPY` are judged by TARGET, not by name: the export legitimately
 * writes Parquet and builds local views. What is never allowed is any write
 * verb, or a `CREATE INDEX` — the one `CREATE` that would land on the server.
 */
export function assertNoWrites(sql: string): string {
  const bare = sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
  const verb = WRITE_VERBS.exec(bare);
  if (verb) throw new Error(`refusing to run: statement contains "${verb[0]}"`);
  if (/\bcreate\s+(unique\s+)?index\b/i.test(bare)) {
    throw new Error("refusing to run: statement creates an index");
  }
  return sql;
}

export function assertUnderArchiveRoot(target: string): string {
  const normalized = path.normalize(target);
  if (!normalized.includes(`/${ARCHIVE_ROOT_SUFFIX}/`) && !normalized.endsWith(`/${ARCHIVE_ROOT_SUFFIX}`)) {
    throw new Error(`refusing to write outside ${ARCHIVE_ROOT_SUFFIX}: ${target}`);
  }
  return normalized;
}

/* ── SQL ────────────────────────────────────────────────────────────────── */

export function buildExportSql(range: DateRange): string {
  return `COPY (
  SELECT *, created_at::DATE AS event_date
  FROM pg.public.analytics_events
  WHERE created_at >= TIMESTAMPTZ '${range.from} 00:00:00+00'
    AND created_at <  TIMESTAMPTZ '${range.to} 00:00:00+00'
) TO '/out/analytics_events'
  (FORMAT PARQUET, COMPRESSION ZSTD, PARTITION_BY (event_date),
   FILENAME_PATTERN 'part-{i}', OVERWRITE_OR_IGNORE);

COPY (SELECT * FROM pg.public.account_first_seen)
  TO '/out/account_first_seen/part-0000.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);

COPY (SELECT * FROM pg.public.session_first_seen)
  TO '/out/session_first_seen/part-0000.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);
`;
}

/** Reads the archive back — offline, no Postgres involved. */
export function buildVerifySql(): string {
  return `SELECT event_date::VARCHAR AS partition, count(*) AS rows,
       strftime(min(created_at) AT TIME ZONE 'UTC', '%Y-%m-%dT%H:%M:%S.%gZ') AS min_ts,
       strftime(max(created_at) AT TIME ZONE 'UTC', '%Y-%m-%dT%H:%M:%S.%gZ') AS max_ts
FROM read_parquet('/out/analytics_events/**/*.parquet', hive_partitioning=1)
GROUP BY 1 ORDER BY 1;
`;
}

/** The same aggregate, computed on the SERVER, to compare against. */
export function buildSourceCountSql(range: DateRange): string {
  return `SELECT created_at::date::text AS partition, count(*) AS rows,
       to_char(min(created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS min_ts,
       to_char(max(created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS max_ts
FROM analytics_events
WHERE created_at >= timestamptz '${range.from} 00:00:00+00'
  AND created_at <  timestamptz '${range.to} 00:00:00+00'
GROUP BY 1 ORDER BY 1`;
}

/* ── verification ───────────────────────────────────────────────────────── */

/**
 * Compare PER PARTITION.
 *
 * ⛔ A matching grand total is not evidence: two days wrong by the same amount
 * in opposite directions sum correctly and the archive is still corrupt. That
 * case is pinned by a test.
 */
export function verifyManifest(
  entries: readonly PartitionSummary[],
  observed: readonly ObservedPartition[],
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const seen = new Map(observed.map((o) => [o.partition, o]));

  for (const entry of entries) {
    const hit = seen.get(entry.partition);
    if (!hit) {
      failures.push(`partition ${entry.partition}: missing from the archive`);
      continue;
    }
    if (hit.rows !== entry.rows) {
      failures.push(`partition ${entry.partition}: rows ${entry.rows} → ${hit.rows}`);
    }
    if (entry.min_ts !== null && hit.min_ts !== entry.min_ts) {
      failures.push(`partition ${entry.partition}: min_ts ${entry.min_ts} → ${hit.min_ts}`);
    }
    if (entry.max_ts !== null && hit.max_ts !== entry.max_ts) {
      failures.push(`partition ${entry.partition}: max_ts ${entry.max_ts} → ${hit.max_ts}`);
    }
    seen.delete(entry.partition);
  }
  for (const extra of seen.keys()) {
    failures.push(`partition ${extra}: unexpected, present in the archive but not in the manifest`);
  }
  return { ok: failures.length === 0, failures };
}

/* ── redaction ──────────────────────────────────────────────────────────── */

export function redactSecrets(text: string, s: { password: string; ref: string }): string {
  let out = text;
  if (s.password) out = out.split(s.password).join("[REDACTED]");
  if (s.ref) out = out.split(s.ref).join("[REF]");
  return out
    .replace(/postgresql:\/\/[^\s"']+/gi, "[REDACTED]")
    .replace(/password=[^\s"'&]+/gi, "password=[REDACTED]")
    .replace(/0x[a-fA-F0-9]{6,}/g, "0x<hex>");
}

/* ── runtime ────────────────────────────────────────────────────────────── */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARCHIVE_DIR = path.join(REPO_ROOT, ARCHIVE_ROOT_SUFFIX);

function credentials() {
  const env = loadOpsEnv(REPO_ROOT);
  const ref = parseSupabaseRef(env.get("SUPABASE_URL"));
  const password = env.get("SUPABASE_DB_PASSWORD");
  if (!ref || !password) throw new Error("missing SUPABASE_URL / SUPABASE_DB_PASSWORD");
  return { ref, password };
}

/** DuckDB WITH the read-only Postgres attachment. */
function duckWithPg(sql: string, creds: { ref: string; password: string }): string {
  assertNoWrites(sql);
  const attach =
    `INSTALL postgres; LOAD postgres;\n` +
    `ATTACH 'host=${POOLER_HOST} port=${POOLER_PORT} user=postgres.${creds.ref} ` +
    `dbname=postgres sslmode=require' AS pg (TYPE POSTGRES, READ_ONLY);\n`;
  return execFileSync(
    "docker",
    [
      "run", "--rm",
      // ⛔ BY NAME, NEVER `NAME=value`. See the note on `childEnv` below.
      "-e", "PGPASSWORD",
      "-v", `${ARCHIVE_DIR}:/out`,
      DUCKDB_IMAGE,
      "/duckdb", "-c", `${attach}${sql}`,
    ],
    {
      encoding: "utf8",
      timeout: TIMEOUT_MS,
      stdio: ["pipe", "pipe", "pipe"],
      env: childEnv({ PGPASSWORD: creds.password }),
    },
  );
}

/** DuckDB with NO network at all — proves the archive stands on its own. */
function duckOffline(sql: string): string {
  assertNoWrites(sql);
  return execFileSync(
    "docker",
    [
      "run", "--rm",
      "--network", "none",
      "-v", `${ARCHIVE_DIR}:/out`,
      DUCKDB_IMAGE,
      "/duckdb", "-json", "-c", sql,
    ],
    { encoding: "utf8", timeout: TIMEOUT_MS, stdio: ["pipe", "pipe", "pipe"] },
  );
}

function psql(sql: string, creds: { ref: string; password: string }): string {
  const conn =
    `postgresql://postgres.${creds.ref}:${encodeURIComponent(creds.password)}` +
    `@${POOLER_HOST}:${POOLER_PORT}/postgres?sslmode=require`;
  return execFileSync(
    "docker",
    [
      "run", "--rm", "-i",
      "-e", "PGCONN",
      "-e", "PGQUERY",
      DOCKER_PG_IMAGE,
      "sh", "-c",
      'printf %s "$PGQUERY" | psql "$PGCONN" -q -v ON_ERROR_STOP=1 -t -A -F "|" -f -',
    ],
    {
      encoding: "utf8",
      timeout: TIMEOUT_MS,
      stdio: ["pipe", "pipe", "pipe"],
      env: childEnv({
        PGCONN: conn,
        PGQUERY: `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;\n${sql}`,
      }),
    },
  );
}

function sha256(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function listParquet(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const item of readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, item.name);
      if (item.isDirectory()) walk(full);
      else if (item.name.endsWith(".parquet")) out.push(full);
    }
  };
  walk(dir);
  return out.sort();
}

function observedFromArchive(): ObservedPartition[] {
  const raw = duckOffline(buildVerifySql()).trim();
  if (!raw) return [];
  return (JSON.parse(raw) as ObservedPartition[]).map((r) => ({
    partition: String(r.partition),
    rows: Number(r.rows),
    min_ts: r.min_ts,
    max_ts: r.max_ts,
  }));
}

function sourcePartitions(range: DateRange, creds: { ref: string; password: string }): ObservedPartition[] {
  return psql(buildSourceCountSql(range), creds)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [partition, rows, min_ts, max_ts] = line.split("|");
      return { partition: partition!, rows: Number(rows), min_ts: min_ts!, max_ts: max_ts! };
    });
}

/** The distinct partitions a set of files covers, in order. */
export function partitionsFromFiles(files: readonly ArchiveFile[]): string[] {
  return [...new Set(files.map((f) => f.partition))];
}

function buildManifest(range: DateRange, source: readonly ObservedPartition[]): Manifest {
  const files: ArchiveFile[] = listParquet(ARCHIVE_DIR).map((file) => {
    const rel = path.relative(ARCHIVE_DIR, file);
    const table = rel.split("/")[0]!;
    return {
      table,
      filename: rel,
      partition: /event_date=(\d{4}-\d{2}-\d{2})/.exec(rel)?.[1] ?? table,
      bytes: statSync(file).size,
      sha256: sha256(file),
    };
  });
  return { created_at: new Date().toISOString(), range, partitions: [...source], files };
}

function report(manifest: Manifest, result: { ok: boolean; failures: string[] }): void {
  const rows = manifest.partitions.reduce((a, p) => a + p.rows, 0);
  const bytes = manifest.files.reduce((a, f) => a + f.bytes, 0);
  console.log("");
  console.log(`archive range   : ${manifest.range.from} → ${manifest.range.to} (UTC, half-open)`);
  console.log(`parquet files   : ${manifest.files.length}`);
  console.log(`event partitions: ${manifest.partitions.length}`);
  console.log(`analytics rows  : ${rows.toLocaleString("en-US")}`);
  console.log(`compressed size : ${(bytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`verification    : ${result.ok ? "PASS — every partition matches" : "FAIL"}`);
  for (const f of result.failures) console.log(`  ⛔ ${f}`);
}

export function main(argv: readonly string[]): number {
  let creds = { ref: "", password: "" };
  try {
    const command = parseArgs(argv);
    assertUnderArchiveRoot(path.join(ARCHIVE_DIR, "manifest.json"));
    mkdirSync(path.join(ARCHIVE_DIR, "account_first_seen"), { recursive: true });
    mkdirSync(path.join(ARCHIVE_DIR, "session_first_seen"), { recursive: true });

    if (command.kind === "verify") {
      const manifestPath = assertUnderArchiveRoot(path.resolve(REPO_ROOT, command.manifestPath));
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
      const result = verifyManifest(manifest.partitions, observedFromArchive());
      for (const entry of manifest.files) {
        const file = path.join(ARCHIVE_DIR, entry.filename);
        if (sha256(file) !== entry.sha256) result.failures.push(`${entry.filename}: sha256 changed`);
      }
      result.ok = result.failures.length === 0;
      report(manifest, result);
      return result.ok ? 0 : 1;
    }

    creds = credentials();
    let range: DateRange;
    if (command.kind === "export-all") {
      const [min, max] = psql(
        "SELECT min(created_at)::text, max(created_at)::text FROM analytics_events",
        creds,
      ).trim().split("|");
      range = resolveAllRange(min!, max!);
      console.log(`--all resolved from production: ${range.from} → ${range.to}`);
    } else {
      range = command.range;
    }

    duckWithPg(buildExportSql(range), creds);
    const source = sourcePartitions(range, creds);
    const manifest = buildManifest(range, source);
    const result = verifyManifest(manifest.partitions, observedFromArchive());
    writeFileSync(
      assertUnderArchiveRoot(path.join(ARCHIVE_DIR, "manifest.json")),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    report(manifest, result);
    return result.ok ? 0 : 1;
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const text = `${e.stdout ?? ""}${e.stderr ?? ""}${e.message ?? ""}`;
    console.error(redactSecrets(text, creds).slice(0, 2_000));
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
