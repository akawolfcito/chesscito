/**
 * Pure logic for the Supabase backup/restore scripts.
 *
 * Everything here is a function over strings. Nothing in this file opens a
 * socket, starts a container, or touches a database — which is exactly why the
 * dangerous parts live here: the anti-production guard and the dump parsers can
 * be tested exhaustively without Docker, without the network, and without a
 * database that a wrong test could destroy.
 */
import path from "node:path";

/** The local Supabase stack's Postgres port (apps/web/supabase/config.toml). */
export const LOCAL_DB_PORT = 55322;
export const LOCAL_DB_HOSTS = ["127.0.0.1", "localhost"] as const;
/** project_id = "web" ⇒ container supabase_db_web. */
export const LOCAL_CONTAINER_PREFIX = "supabase_db_";

/** The tables the post-restore check verifies. Not the whole schema — these are
 *  the ones whose loss would make the migration rehearsal meaningless. */
export const CRITICAL_TABLES = [
  "public.peones_ledger",
  "public.treasury_payment_intents",
  "public.treasury_payment_consumptions",
] as const;

export const DUMP_FILES = [
  "roles.sql",
  "schema.sql",
  "data.sql",
  "migration_history.sql",
] as const;

export const MANIFEST_NAME = "manifest.json";

const DEFAULT_ROOT_SEGMENTS = ["backups", "chesscito", "db"];

/** True when `child` is at or under `parent`, by path segment — not by string
 *  prefix, which would call /repo-backups a child of /repo. */
function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * Where backups go. Outside the repo by construction: a production dump that
 * never enters the working tree cannot be staged by a distracted `git add`,
 * gitignore or not — and this project has broken main that way once already.
 */
export function resolveBackupRoot(
  env: NodeJS.ProcessEnv,
  home: string,
  repoRoot: string,
): string {
  const override = env.CHESSCITO_BACKUP_DIR?.trim();
  const raw =
    override && override.length > 0 ? override : path.join(home, ...DEFAULT_ROOT_SEGMENTS);
  const expanded = raw.startsWith("~") ? path.join(home, raw.slice(1)) : raw;
  const resolved = path.resolve(expanded);

  if (isInside(resolved, path.resolve(repoRoot))) {
    throw new Error(
      `Refusing to write backups inside the repo: ${resolved}\n` +
        `Production dumps stay out of the working tree. Unset CHESSCITO_BACKUP_DIR ` +
        `or point it somewhere outside ${repoRoot}.`,
    );
  }
  return resolved;
}

/** UTC, colon-free, sortable. The stamp ends up in a path a human will paste. */
export function formatBackupStamp(date: Date): string {
  return date.toISOString().replace(/\.\d+Z$/, "Z").replace(/:/g, "-");
}

/**
 * The guard. `restore-local` DROPs the database it is pointed at, so this runs
 * before any destructive statement is emitted and fails closed on anything it
 * cannot positively identify as the local Supabase stack.
 *
 * It never echoes the connection string: that string contains the password, and
 * a guard that leaks a secret into a stack trace has traded one hazard for
 * another. Errors describe the rule that was broken, not the input.
 */
export function assertLocalTarget(dbUrl: string, containerName: string): void {
  const refuse = (why: string): never => {
    throw new Error(
      `Refusing to restore: ${why}.\n` +
        `Target must be host ${LOCAL_DB_HOSTS.join(" or ")}, port ${LOCAL_DB_PORT}, ` +
        `container ${LOCAL_CONTAINER_PREFIX}*. Connection string withheld on purpose.`,
    );
  };

  let url: URL;
  try {
    url = new URL(dbUrl);
  } catch {
    return refuse("the database URL could not be parsed");
  }

  if (!LOCAL_DB_HOSTS.includes(url.hostname as (typeof LOCAL_DB_HOSTS)[number])) {
    return refuse("the host is not loopback");
  }
  // An absent port is refused rather than defaulted: assuming 5432 here is how
  // a guard silently starts pointing at somebody's real local Postgres.
  if (url.port !== String(LOCAL_DB_PORT)) {
    return refuse(`the port is not ${LOCAL_DB_PORT}`);
  }
  if (!containerName.startsWith(LOCAL_CONTAINER_PREFIX)) {
    return refuse("the container is not a local Supabase container");
  }
}

/** Bump when the manifest's meaning changes. parseManifest refuses anything
 *  newer, because a post-restore check comparing the wrong fields is worse
 *  than a restore that refuses to start. */
export const MANIFEST_VERSION = 1;

export interface BackupFileEntry {
  name: string;
  bytes: number;
  sha256: string;
}

export interface BackupManifest {
  version: number;
  createdAt: string;
  gitSha: string;
  latestMigration: string;
  cliVersion: string;
  files: BackupFileEntry[];
  /** Only the CRITICAL_TABLES. Deliberately not the whole schema. */
  criticalTableRows: Record<string, number>;
}

export function parseManifest(raw: string): BackupManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("manifest.json is not valid JSON");
  }
  const m = parsed as Partial<BackupManifest>;

  if (m.version !== MANIFEST_VERSION) {
    throw new Error(
      `manifest.json version ${String(m.version)} is not supported (expected ${MANIFEST_VERSION})`,
    );
  }
  if (!Array.isArray(m.files) || m.files.length === 0) {
    throw new Error("manifest.json has no files list");
  }
  for (const file of m.files) {
    if (typeof file?.sha256 !== "string" || file.sha256.length !== 64) {
      throw new Error(`manifest.json entry ${String(file?.name)} has no valid sha256`);
    }
  }
  if (!m.criticalTableRows || typeof m.criticalTableRows !== "object") {
    throw new Error("manifest.json has no criticalTableRows");
  }
  return m as BackupManifest;
}

/** Matches the COPY header for one exact qualified table, quoted or not. */
function copyHeaderPattern(qualifiedTable: string): RegExp {
  const [schema, table] = qualifiedTable.split(".");
  const q = (s: string) => `"?${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"?`;
  return new RegExp(`^COPY\\s+${q(schema)}\\.${q(table)}\\s*\\(.*\\)\\s+FROM\\s+stdin;`, "i");
}

/**
 * Count the rows of one table inside a `--data-only --use-copy` dump.
 *
 * Reading the dump beats querying production a second time: the number then
 * describes the artifact we actually hold, and cannot drift from it between
 * the dump and the count.
 *
 * Returns null when the table has no COPY block at all. Absent and empty are
 * different findings — one is a broken backup, the other is a fact about prod.
 */
export function countCopyRows(sql: string, qualifiedTable: string): number | null {
  const header = copyHeaderPattern(qualifiedTable);
  const lines = sql.split("\n");
  const start = lines.findIndex((line) => header.test(line.trim()));
  if (start === -1) return null;

  let rows = 0;
  for (let i = start + 1; i < lines.length; i += 1) {
    // pg_dump escapes backslashes in COPY output, so the terminator is the only
    // line that is exactly \. — a value containing those characters is not.
    if (lines[i] === "\\.") return rows;
    rows += 1;
  }
  return rows;
}

/**
 * Versions from the supabase_migrations ledger dump, ascending.
 *
 * This is what tells the restored copy which migrations production had already
 * run — without it, `supabase migration up` would try all 29 instead of the one
 * that is actually pending.
 */
export function parseAppliedMigrationVersions(sql: string): string[] {
  const header = copyHeaderPattern("supabase_migrations.schema_migrations");
  const lines = sql.split("\n");
  const start = lines.findIndex((line) => header.test(line.trim()));
  if (start === -1) return [];

  const versions: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i] === "\\.") break;
    const version = lines[i].split("\t")[0]?.trim();
    if (version) versions.push(version);
  }
  return versions.sort();
}

/**
 * Read one key out of a dotenv file's contents. Deliberately minimal: this is
 * only ever used for SUPABASE_DB_PASSWORD, and the value must never be logged.
 * Returns null when absent so callers can tell "missing" from "empty".
 */
export function parseEnvValue(contents: string, key: string): string | null {
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() !== key) continue;

    let value = trimmed.slice(eq + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length > 1) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return null;
}
