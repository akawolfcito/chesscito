/**
 * Restore a backup into the local Supabase stack, then check it is worth using.
 *
 * This script DROPs the database it is pointed at. Everything about its shape
 * follows from that: the target is read from `supabase status` rather than
 * assembled, it is validated by assertLocalTarget before a single destructive
 * statement is emitted, and it fails closed on anything it cannot positively
 * identify as the local stack.
 *
 * It never applies the pending migration. That command is printed for a human.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  CRITICAL_TABLES,
  DUMP_FILES,
  LOCAL_CONTAINER_PREFIX,
  MANIFEST_NAME,
  REQUIRED_MANAGED_SCHEMAS,
  RESTORE_ROLE,
  type RestoreObservation,
  assertLocalTarget,
  assertManagedSchemas,
  assertSuperuserSession,
  evaluatePostRestore,
  parseManifest,
} from "./lib";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const WEB_DIR = path.join(REPO_ROOT, "apps/web");
const CONTAINER = `${LOCAL_CONTAINER_PREFIX}web`; // project_id = "web"

/**
 * The local stack's own password, taken from the DB_URL the guard already
 * validated. Not a constant in this file: it belongs to whatever local stack is
 * running. Never logged, and never passed in argv — `docker exec -e PGPASSWORD`
 * with no value forwards it from this process's environment instead, keeping it
 * out of `ps`, the same way backup.ts handles the production password.
 */
let localPassword = "";

function run(cmd: string, args: string[], input?: string): string {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    input,
    maxBuffer: 512 * 1024 * 1024,
    env: { ...process.env, PGPASSWORD: localPassword },
  });
}

/** psql inside the container: the host has no psql binary. */
function psql(sql: string, database = "postgres"): string {
  return run("docker", [
    "exec",
    "-i",
    "-e",
    "PGPASSWORD",
    CONTAINER,
    "psql",
    "-U",
    RESTORE_ROLE,
    "-d",
    database,
    "-v",
    "ON_ERROR_STOP=1",
    "-t",
    "-A",
    "-F",
    "|",
    "-c",
    sql,
  ]).trim();
}

function psqlFile(sqlText: string): void {
  run(
    "docker",
    [
      "exec",
      "-i",
      "-e",
      "PGPASSWORD",
      CONTAINER,
      "psql",
      "-U",
      RESTORE_ROLE,
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      "-",
    ],
    sqlText,
  );
}

function main(): void {
  const dir = process.argv[2];
  if (!dir) {
    throw new Error("usage: pnpm db:restore-local <backup-dir>");
  }

  // ── Phase A: validate the artifact before touching any database ──────────
  const manifest = parseManifest(fs.readFileSync(path.join(dir, MANIFEST_NAME), "utf8"));
  for (const entry of manifest.files) {
    const buf = fs.readFileSync(path.join(dir, entry.name));
    const actual = createHash("sha256").update(buf).digest("hex");
    if (actual !== entry.sha256) {
      throw new Error(`${entry.name} does not match its checksum — the backup is corrupt`);
    }
  }
  console.log(`Backup verified: ${manifest.files.length} dumps, taken ${manifest.createdAt}`);

  // ── Phase B: the guard ───────────────────────────────────────────────────
  run("supabase", ["start", "--workdir", WEB_DIR]);
  const status = run("supabase", ["status", "--workdir", WEB_DIR, "-o", "env"]);
  const dbUrl = /^DB_URL="?([^"\n]+)"?$/m.exec(status)?.[1] ?? "";
  assertLocalTarget(dbUrl, CONTAINER);
  console.log(`Target verified: ${CONTAINER} on loopback:55322`);

  // Only read after the guard has confirmed this URL is the local stack.
  localPassword = new URL(dbUrl).password;
  if (!localPassword) {
    throw new Error("Refusing to restore: the local stack reported no database password");
  }

  // ── Phase C: restore ─────────────────────────────────────────────────────
  // The privilege the session actually holds, asked of the session itself.
  // The first attempt failed here as `postgres`, which is not a superuser in
  // this container and so could not terminate the stack's own connections.
  const [sessionUser, sessionSuperuser] = psql(
    "select current_user, current_setting('is_superuser')",
  ).split("|");
  assertSuperuserSession(sessionUser ?? "", sessionSuperuser ?? "");
  console.log(`Session verified: ${RESTORE_ROLE}, superuser on`);

  // The database must already be an initialised Supabase one. schema.sql has no
  // CREATE SCHEMA and assumes the managed schemas exist; an earlier design
  // dropped the whole database and discovered that the hard way.
  assertManagedSchemas(psql("select nspname from pg_namespace").split("\n"));
  console.log(`Managed schemas verified: ${REQUIRED_MANAGED_SCHEMAS.join(", ")}`);

  // The migration ledger must exist as a table, since it is truncated rather
  // than dropped — the schema and its primary key survive the restore.
  if (psql("select to_regclass('supabase_migrations.schema_migrations')") === "") {
    throw new Error("Refusing to restore: supabase_migrations.schema_migrations is missing");
  }

  // ── Destructive from here. Exactly three statements, all scoped. ─────────
  // The application schema is replaced wholesale: schema.sql only adds, so
  // anything local and stale would otherwise survive the restore unnoticed.
  // AUTHORIZATION keeps the ownership a fresh Supabase database has.
  console.log("Replacing the public schema …");
  psql("DROP SCHEMA IF EXISTS public CASCADE;");
  psql("CREATE SCHEMA public AUTHORIZATION pg_database_owner;");
  // Truncated, not dropped: the local table and its primary key stay, and
  // migration_history.sql refills it with exactly what production had applied.
  psql("TRUNCATE TABLE supabase_migrations.schema_migrations;");

  for (const name of DUMP_FILES) {
    process.stdout.write(`  applying ${name} … `);
    psqlFile(fs.readFileSync(path.join(dir, name), "utf8"));
    process.stdout.write("ok\n");
  }

  // ── Phase D: post-restore check ──────────────────────────────────────────
  const tableRows = psql(
    `select c.relname, n.nspname from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r' and n.nspname = 'public'`,
  );
  const existingTables = tableRows
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [relname, nspname] = line.split("|");
      return `${nspname}.${relname}`;
    });

  const ledgerPresent = existingTables.includes("public.peones_ledger");
  const observed: RestoreObservation = {
    existingTables,
    migrationCount: Number(psql("select count(*) from supabase_migrations.schema_migrations")),
    latestMigration: psql("select max(version) from supabase_migrations.schema_migrations") || null,
    // Guarded: querying a table that did not come across would error out and
    // hide the other findings behind a stack trace.
    peonesLedgerRows: ledgerPresent ? Number(psql("select count(*) from public.peones_ledger")) : -1,
  };

  const { ok, failures } = evaluatePostRestore(observed, manifest);
  const mark = (pass: boolean) => (pass ? "OK  " : "FAIL");

  console.log("\nPost-restore check");
  for (const table of CRITICAL_TABLES) {
    console.log(`  ${mark(existingTables.includes(table))} ${table}`);
  }
  console.log(
    `  ${mark(observed.migrationCount > 0)} migrations restored: ${observed.migrationCount}`,
  );
  console.log(
    `  ${mark(observed.latestMigration === manifest.latestMigration)} latest: ${observed.latestMigration}`,
  );
  console.log(
    `  ${mark(observed.peonesLedgerRows === manifest.criticalTableRows["public.peones_ledger"])} peones_ledger rows: ${observed.peonesLedgerRows}`,
  );

  if (!ok) {
    console.error("\nRestore is NOT usable:");
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log("\nReplica is faithful. The pending migration is NOT applied.");
  console.log("To rehearse it by hand:");
  console.log(`  supabase migration up --workdir ${WEB_DIR}`);
}

main();
