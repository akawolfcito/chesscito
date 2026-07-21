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
