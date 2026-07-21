/**
 * Dump production Supabase to disk.
 *
 * The free tier has no automatic backups, so this is the only copy that exists.
 * It follows from that: a partial backup that looks complete is worse than no
 * backup at all, so any failed dump deletes the whole directory on the way out.
 *
 * Reads production. Never writes to it.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  CRITICAL_TABLES,
  DUMP_FILES,
  MANIFEST_NAME,
  MANIFEST_VERSION,
  type BackupManifest,
  countCopyRows,
  formatBackupStamp,
  parseAppliedMigrationVersions,
  parseEnvValue,
  resolveBackupRoot,
} from "./lib";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const WEB_DIR = path.join(REPO_ROOT, "apps/web");

/** Per-file dump arguments. --workdir keeps us off `cd` (CLAUDE.md hygiene). */
const DUMP_ARGS: Record<(typeof DUMP_FILES)[number], string[]> = {
  "roles.sql": ["--role-only"],
  "schema.sql": [],
  "data.sql": ["--data-only", "--use-copy"],
  "migration_history.sql": ["--data-only", "--schema", "supabase_migrations"],
};

function sh(cmd: string, args: string[], env?: NodeJS.ProcessEnv): string {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    env: env ?? process.env,
    maxBuffer: 512 * 1024 * 1024,
  });
}

function main(): void {
  // The password is read here and handed to children through the environment.
  // Never argv: arguments are world-readable in `ps`.
  const envFile = path.join(WEB_DIR, ".env");
  const password = fs.existsSync(envFile)
    ? parseEnvValue(fs.readFileSync(envFile, "utf8"), "SUPABASE_DB_PASSWORD")
    : null;
  if (!password) {
    throw new Error(
      `SUPABASE_DB_PASSWORD not found in ${envFile}.\n` +
        `Add it there (it is gitignored) and re-run. Value is never printed.`,
    );
  }
  const childEnv = { ...process.env, SUPABASE_DB_PASSWORD: password };

  const root = resolveBackupRoot(process.env, process.env.HOME ?? "", REPO_ROOT);
  const dir = path.join(root, formatBackupStamp(new Date()));
  fs.mkdirSync(dir, { recursive: true });

  try {
    for (const name of DUMP_FILES) {
      process.stdout.write(`  dumping ${name} … `);
      sh(
        "supabase",
        [
          "db",
          "dump",
          "--linked",
          "--workdir",
          WEB_DIR,
          "-f",
          path.join(dir, name),
          ...DUMP_ARGS[name],
        ],
        childEnv,
      );
      const bytes = fs.statSync(path.join(dir, name)).size;
      // An empty schema or data dump is a failure, not an empty database.
      if (bytes === 0 && (name === "schema.sql" || name === "data.sql")) {
        throw new Error(`${name} came back empty`);
      }
      process.stdout.write(`${bytes} bytes\n`);
    }

    const dataSql = fs.readFileSync(path.join(dir, "data.sql"), "utf8");
    const historySql = fs.readFileSync(path.join(dir, "migration_history.sql"), "utf8");

    const applied = parseAppliedMigrationVersions(historySql);
    if (applied.length === 0) {
      throw new Error(
        "migration_history.sql contains no applied migrations — the ledger did not come across",
      );
    }

    const criticalTableRows: Record<string, number> = {};
    for (const table of CRITICAL_TABLES) {
      const rows = countCopyRows(dataSql, table);
      if (rows === null) {
        console.warn(`  WARNING: ${table} has no COPY block in data.sql — recording 0`);
      }
      criticalTableRows[table] = rows ?? 0;
    }

    const manifest: BackupManifest = {
      version: MANIFEST_VERSION,
      createdAt: new Date().toISOString(),
      gitSha: sh("git", ["-C", REPO_ROOT, "rev-parse", "--short", "HEAD"]).trim(),
      latestMigration: applied.at(-1)!,
      cliVersion: sh("supabase", ["--version"]).trim().split("\n")[0],
      files: DUMP_FILES.map((name) => {
        const buf = fs.readFileSync(path.join(dir, name));
        return {
          name,
          bytes: buf.length,
          sha256: createHash("sha256").update(buf).digest("hex"),
        };
      }),
      criticalTableRows,
    };
    fs.writeFileSync(path.join(dir, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`);

    console.log(`\nBackup complete: ${dir}`);
    console.log(`  latest applied migration: ${manifest.latestMigration}`);
    for (const [table, rows] of Object.entries(criticalTableRows)) {
      console.log(`  ${table}: ${rows} rows`);
    }
    console.log(`\nNext: pnpm db:restore-local ${dir}`);
  } catch (error) {
    // A half-written backup that looks complete is the failure mode this whole
    // script exists to avoid. Leave nothing behind to be mistaken for one.
    fs.rmSync(dir, { recursive: true, force: true });
    console.error(`\nBackup FAILED — removed the partial directory ${dir}`);
    throw error;
  }
}

main();
