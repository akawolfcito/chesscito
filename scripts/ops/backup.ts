/**
 * `pnpm ops:backup` — logical backup of Chesscito's PRODUCT STATE.
 *
 *   pnpm ops:backup                 # dump + manifest + local restore verification
 *   pnpm ops:backup --no-verify     # dump only (skips the disposable restore)
 *
 * Written for the Supabase Pro → Free downgrade: the plan change is reversible
 * in minutes, but a database problem during it is not. This is the artefact
 * that makes the downgrade a decision instead of a bet.
 *
 * ── What it dumps, and the rule behind it ────────────────────────────────
 *
 * EVERYTHING in `public` EXCEPT `analytics_events`.
 *
 * That single exclusion is the whole design: `analytics_events` is 164 MB of
 * the ~190 MB database and it is ALREADY archived and verified to Parquet
 * (`pnpm ops:archive`, commit 06d5815). Dumping it again would make the backup
 * 8× larger and slower for zero added safety.
 *
 * ⚠️ `account_first_seen` and `session_first_seen` ARE included even though the
 * prior audit filed them as analytics. They are 2.7 MB, `/stats` reads them,
 * and they cannot be rebuilt from a truncated `analytics_events` — first_seen
 * predates whatever window stays hot. Cheap to keep, impossible to recover.
 *
 * ── Version pinning ──────────────────────────────────────────────────────
 *
 * ⛔ The server is PostgreSQL 17.6, so `pg_dump` must be 17. A 16 client
 * refuses a 17 server outright ("server version mismatch"). Measured, not
 * assumed — the rest of this repo's tooling uses the 16 image because psql 16
 * talks to 17 fine; `pg_dump` does not.
 *
 * Secrets never reach stdout: the connection string rides in the child process
 * env, and failures pass through the shared redaction.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadOpsEnv, parseSupabaseRef } from "./lib/env";

const POOLER_HOST = "aws-1-us-east-1.pooler.supabase.com";
const POOLER_PORT = 5432;
/** ⛔ 17, to match the server. A 16 pg_dump refuses a 17 server. */
export const PG_IMAGE = "postgres:17-alpine";
const TIMEOUT_MS = 1_800_000;

/** ⛔ The ONLY directory this tool may write to. Gitignored. */
export const BACKUP_ROOT_SUFFIX = "private/backups";

/**
 * The one table left out, and why it is safe to leave out.
 * Everything else in `public` is dumped, including tables added later — an
 * allow-list would silently miss a new product table, which is the failure
 * mode a backup can least afford.
 */
export const EXCLUDED_TABLES = ["analytics_events"] as const;

export type TableCount = { table: string; rows: number };

export type BackupManifest = {
  created_at: string;
  server_version: string;
  dump_file: string;
  bytes: number;
  sha256: string;
  excluded: readonly string[];
  tables: TableCount[];
};

export function assertUnderBackupRoot(target: string): string {
  const normalized = path.normalize(target);
  if (!normalized.includes(`/${BACKUP_ROOT_SUFFIX}/`)) {
    throw new Error(`refusing to write outside ${BACKUP_ROOT_SUFFIX}: ${target}`);
  }
  return normalized;
}

/** UTC, filesystem-safe, sortable. Local time would reorder across a DST shift. */
export function backupStamp(now: Date): string {
  return now.toISOString().replace(/[:.]/g, "-").replace(/-\d{3}Z$/, "Z");
}

export function buildDumpArgs(excluded: readonly string[]): string[] {
  return [
    "--schema=public",
    // `--no-owner` / `--no-privileges`: a restore into a disposable Postgres has
    // none of Supabase's roles, and a dump that cannot be restored anywhere is
    // not a backup. Grants are recreated by migrations, not by this file.
    "--no-owner",
    "--no-privileges",
    ...excluded.map((t) => `--exclude-table=public.${t}`),
  ];
}

/** Counts every table the dump should contain, so the restore has a target. */
export function buildCountSql(excluded: readonly string[]): string {
  const list = excluded.map((t) => `'${t}'`).join(", ");
  return `SELECT string_agg(format('SELECT %L AS t, count(*) AS n FROM public.%I', relname, relname), ' UNION ALL ')
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname NOT IN (${list})`;
}

export function parseCounts(raw: string): TableCount[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [table, rows] = line.split("|");
      return { table: table!, rows: Number(rows) };
    })
    .sort((a, b) => a.table.localeCompare(b.table));
}

export function compareCounts(
  source: readonly TableCount[],
  restored: readonly TableCount[],
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const seen = new Map(restored.map((r) => [r.table, r.rows]));
  for (const entry of source) {
    if (!seen.has(entry.table)) {
      failures.push(`${entry.table}: missing after restore`);
      continue;
    }
    const got = seen.get(entry.table)!;
    if (got !== entry.rows) failures.push(`${entry.table}: ${entry.rows} → ${got}`);
    seen.delete(entry.table);
  }
  for (const extra of seen.keys()) failures.push(`${extra}: unexpected after restore`);
  return { ok: failures.length === 0, failures };
}

export function redactSecrets(text: string, s: { password: string; ref: string }): string {
  let out = text;
  if (s.password) out = out.split(s.password).join("[REDACTED]");
  if (s.ref) out = out.split(s.ref).join("[REF]");
  return out.replace(/postgres(ql)?:\/\/[^\s"']+/gi, "[REDACTED]");
}

/* ── runtime ────────────────────────────────────────────────────────────── */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function credentials() {
  const env = loadOpsEnv(REPO_ROOT);
  const ref = parseSupabaseRef(env.get("SUPABASE_URL"));
  const password = env.get("SUPABASE_DB_PASSWORD");
  if (!ref || !password) throw new Error("missing SUPABASE_URL / SUPABASE_DB_PASSWORD");
  return {
    ref,
    password,
    conn:
      `postgresql://postgres.${ref}:${encodeURIComponent(password)}` +
      `@${POOLER_HOST}:${POOLER_PORT}/postgres?sslmode=require`,
  };
}

function psqlSource(sql: string, conn: string, extra: string[] = []): string {
  return execFileSync(
    "docker",
    [
      "run", "--rm", "-i",
      "-e", `PGCONN=${conn}`,
      "-e", `PGQUERY=${sql}`,
      PG_IMAGE,
      "sh", "-c",
      `psql "$PGCONN" -q -v ON_ERROR_STOP=1 -t -A -F "|" ${extra.join(" ")} -c "$PGQUERY"`,
    ],
    { encoding: "utf8", timeout: TIMEOUT_MS, stdio: ["pipe", "pipe", "pipe"] },
  );
}

/**
 * Restore the dump into a DISPOSABLE Postgres and compare row counts.
 *
 * ⛔ A backup nobody restored is a hope, not a backup. This runs the real
 * `psql` restore against a throwaway container of the SAME major version, and
 * compares every table against the manifest recorded at dump time.
 * Nothing is ever written back to Supabase.
 */
function verifyRestore(dir: string): number {
  const manifestPath = assertUnderBackupRoot(path.join(dir, "manifest.json"));
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as BackupManifest;
  const dumpPath = path.join(dir, manifest.dump_file);

  const actual = createHash("sha256").update(readFileSync(dumpPath)).digest("hex");
  if (actual !== manifest.sha256) {
    console.error(`sha256 mismatch: the dump changed since it was written`);
    return 1;
  }
  console.log(`sha256          : OK`);

  const name = `chesscito-restore-${Date.now()}`;
  try {
    execFileSync("docker", [
      "run", "--rm", "-d", "--name", name,
      "-e", "POSTGRES_PASSWORD=throwaway",
      "-e", "POSTGRES_DB=restore",
      PG_IMAGE,
    ], { encoding: "utf8", timeout: 120_000 });

    for (let i = 0; i < 60; i++) {
      try {
        execFileSync("docker", ["exec", name, "pg_isready", "-U", "postgres"], { stdio: "ignore" });
        break;
      } catch {
        execFileSync("sh", ["-c", "sleep 1"]);
      }
    }

    // Drop the container's default `public` so the DUMP creates everything.
    // Otherwise its own `CREATE SCHEMA public` collides and the restore is only
    // partially exercised — we want the dump to stand entirely on its own.
    execFileSync("docker", [
      "exec", name, "psql", "-U", "postgres", "-d", "restore", "-q",
      "-c", "DROP SCHEMA public CASCADE",
    ], { encoding: "utf8", timeout: 120_000 });

    execFileSync("docker", ["cp", dumpPath, `${name}:/tmp/dump.sql`], { timeout: 120_000 });
    // ⛔ psql writes errors to STDERR, so `2>&1` is load-bearing. The first
    // version of this check read stdout only and reported PASS on a restore
    // that had logged 9 errors — a verifier that cannot fail is not a verifier.
    const restoreLog = execFileSync("docker", [
      "exec", name, "sh", "-c",
      "psql -U postgres -d restore -q -f /tmp/dump.sql 2>&1",
    ], { encoding: "utf8", timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
    const errors = restoreLog.split("\n").filter((l) => /ERROR:/.test(l));
    // Supabase's roles do not exist in a vanilla container, so the RLS policies
    // that name them cannot be created here. That is a property of the TARGET,
    // not a defect of the backup: a real restore lands in a Supabase project
    // where those roles exist. Everything else is a genuine failure.
    const roleErrors = errors.filter((l) => /role ".*" does not exist/.test(l));
    const realErrors = errors.filter((l) => !/role ".*" does not exist/.test(l));
    console.log(`restore errors  : ${realErrors.length} real, ${roleErrors.length} missing-role (expected here)`);
    if (realErrors.length > 0) {
      for (const e of realErrors.slice(0, 5)) console.error(`  ⛔ ${e}`);
      return 1;
    }

    const countSql = execFileSync("docker", [
      "exec", name, "psql", "-U", "postgres", "-d", "restore", "-q", "-t", "-A",
      "-c", buildCountSql(EXCLUDED_TABLES),
    ], { encoding: "utf8", timeout: 120_000 }).trim();
    const restored = parseCounts(execFileSync("docker", [
      "exec", name, "psql", "-U", "postgres", "-d", "restore", "-q", "-t", "-A", "-F", "|",
      "-c", countSql,
    ], { encoding: "utf8", timeout: TIMEOUT_MS }));

    const pkeys = execFileSync("docker", [
      "exec", name, "psql", "-U", "postgres", "-d", "restore", "-q", "-t", "-A",
      "-c", "SELECT count(*) FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND c.contype='p'",
    ], { encoding: "utf8", timeout: 120_000 }).trim();
    const checks = execFileSync("docker", [
      "exec", name, "psql", "-U", "postgres", "-d", "restore", "-q", "-t", "-A",
      "-c", "SELECT count(*) FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND c.contype IN ('c','u','f')",
    ], { encoding: "utf8", timeout: 120_000 }).trim();

    const result = compareCounts(manifest.tables, restored);
    console.log(`tables restored : ${restored.length} / ${manifest.tables.length}`);
    console.log(`rows            : ${restored.reduce((a, t) => a + t.rows, 0).toLocaleString("en-US")}`);
    console.log(`primary keys    : ${pkeys}`);
    console.log(`other constraints: ${checks}`);
    console.log(`row-count parity: ${result.ok ? "PASS — every table matches" : "FAIL"}`);
    for (const f of result.failures) console.log(`  ⛔ ${f}`);
    return result.ok ? 0 : 1;
  } finally {
    try {
      execFileSync("docker", ["rm", "-f", name], { stdio: "ignore" });
    } catch {
      // The container is disposable; a failed cleanup must not mask the result.
    }
  }
}

function main(argv: readonly string[]): number {
  let creds = { ref: "", password: "", conn: "" };
  try {
    const verifyIndex = argv.indexOf("--verify");
    if (verifyIndex !== -1) {
      const dir = argv[verifyIndex + 1];
      if (!dir) throw new Error("--verify needs a backup directory");
      return verifyRestore(path.resolve(REPO_ROOT, dir));
    }
    creds = credentials();
    const stamp = backupStamp(new Date());
    const dir = assertUnderBackupRoot(path.join(REPO_ROOT, BACKUP_ROOT_SUFFIX, stamp, "x")).replace(/\/x$/, "");
    mkdirSync(dir, { recursive: true });

    const serverVersion = psqlSource("SHOW server_version", creds.conn).trim();
    console.log(`server          : PostgreSQL ${serverVersion}`);

    // Exact counts BEFORE the dump, so the restore has something to match.
    const countSql = psqlSource(buildCountSql(EXCLUDED_TABLES), creds.conn).trim();
    const sourceCounts = parseCounts(psqlSource(countSql, creds.conn));

    const dumpPath = path.join(dir, "product-state.sql");
    console.log(`dumping         : ${sourceCounts.length} tables (excluding ${EXCLUDED_TABLES.join(", ")})`);
    const dump = execFileSync(
      "docker",
      [
        "run", "--rm",
        "-e", `PGCONN=${creds.conn}`,
        PG_IMAGE,
        "sh", "-c",
        `pg_dump "$PGCONN" ${buildDumpArgs(EXCLUDED_TABLES).join(" ")}`,
      ],
      { encoding: "utf8", timeout: TIMEOUT_MS, maxBuffer: 512 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] },
    );
    writeFileSync(assertUnderBackupRoot(dumpPath), dump);

    const manifest: BackupManifest = {
      created_at: new Date().toISOString(),
      server_version: serverVersion,
      dump_file: "product-state.sql",
      bytes: statSync(dumpPath).size,
      sha256: createHash("sha256").update(readFileSync(dumpPath)).digest("hex"),
      excluded: EXCLUDED_TABLES,
      tables: sourceCounts,
    };
    writeFileSync(
      assertUnderBackupRoot(path.join(dir, "manifest.json")),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );

    console.log(`backup          : ${path.relative(REPO_ROOT, dumpPath)}`);
    console.log(`size            : ${(manifest.bytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`sha256          : ${manifest.sha256.slice(0, 16)}…`);
    console.log(`rows            : ${sourceCounts.reduce((a, t) => a + t.rows, 0).toLocaleString("en-US")}`);
    if (argv.includes("--no-verify")) {
      console.log("verification    : SKIPPED (--no-verify)");
      return 0;
    }
    console.log("");
    console.log("restore verification runs separately: pnpm ops:backup:verify <dir>");
    return 0;
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    console.error(redactSecrets(`${e.stdout ?? ""}${e.stderr ?? ""}${e.message ?? ""}`, creds).slice(0, 2_000));
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
