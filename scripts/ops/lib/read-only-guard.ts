/**
 * Read-only SQL guard for the launch-health monitor.
 *
 * The monitor connects to PRODUCTION with a role that can write. The only thing
 * standing between "operational visibility" and "operational accident" is this
 * function, so it is written to be paranoid in one direction and precise in the
 * other.
 *
 * ── Why a naive keyword scan is WRONG here ────────────────────────────────
 *
 * The monitor's own queries legitimately contain substrings that look lethal:
 *
 *   created_at        contains "create"
 *   last_autovacuum   contains "vacuum"
 *   pg_stat_user_...  neighbours "reset" in pg_stat_reset
 *   updated_at        contains "update"
 *
 * A `sql.includes("vacuum")` guard would reject the very queries we need, and
 * the natural "fix" is to weaken the guard — which is how these things end up
 * useless. So matching is done on WORD boundaries, and because `_` counts as a
 * word character in JS regex, `last_autovacuum` does not match `\bvacuum\b`.
 * That property is pinned by tests; do not replace `\b` with a looser matcher.
 *
 * ── What is enforced ──────────────────────────────────────────────────────
 *
 *  1. Exactly ONE statement. Multi-statement strings are how a read turns into
 *     a write via a trailing `; delete from …`.
 *  2. It must START with `select` or `with` (CTEs are how the collector builds
 *     its aggregates).
 *  3. No DML/DDL/maintenance keyword anywhere as a standalone word.
 *  4. No dangerous function call, matched by name (`pg_stat_reset(`), since
 *     those never trip the word-boundary rule.
 *
 * Comments and string literals are stripped before analysis so a keyword inside
 * `'a string'` or `-- a comment` neither trips the guard nor hides a real
 * statement behind it.
 */

/** Statement types that may never appear. */
const FORBIDDEN_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "create",
  "truncate",
  "vacuum",
  "reindex",
  "cluster",
  "grant",
  "revoke",
  "comment",
  "copy",
  "call",
  "do",
  "merge",
  "refresh",
  "lock",
  "notify",
  "prepare",
  "execute",
  "begin",
  "commit",
  "rollback",
  "savepoint",
  "set",
  "reset",
  "discard",
  "listen",
  "unlisten",
  "checkpoint",
  "reassign",
  "security",
] as const;

/**
 * Functions that mutate or disclose beyond read-only intent. Matched by name +
 * `(` because their names embed underscores, so the word-boundary rule above
 * would never catch them.
 */
const FORBIDDEN_FUNCTIONS = [
  "pg_stat_reset",
  "pg_stat_statements_reset",
  "pg_terminate_backend",
  "pg_cancel_backend",
  "pg_reload_conf",
  "pg_rotate_logfile",
  "pg_switch_wal",
  "pg_create_restore_point",
  "pg_read_file",
  "pg_read_binary_file",
  "pg_ls_dir",
  "lo_import",
  "lo_export",
  "dblink",
  "pg_sleep",
] as const;

export class UnsafeSqlError extends Error {
  constructor(
    readonly reason: string,
    readonly detail: string,
  ) {
    super(`Unsafe SQL rejected (${reason}): ${detail}`);
    this.name = "UnsafeSqlError";
  }
}

/** Strip `--` line comments, block comments, and single-quoted literals. */
function stripNoise(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, " '' ");
}

/**
 * Throws {@link UnsafeSqlError} unless `sql` is a single read-only statement.
 * Returns the SQL unchanged so it can be used inline at the call site — the
 * point is that there is no way to run a query without passing through here.
 */
export function assertReadOnlySql(sql: string): string {
  const cleaned = stripNoise(sql);
  const lowered = cleaned.toLowerCase();

  const statements = lowered
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (statements.length === 0) {
    throw new UnsafeSqlError("empty", "no statement found");
  }
  if (statements.length > 1) {
    throw new UnsafeSqlError(
      "multiple-statements",
      `${statements.length} statements; only one is allowed`,
    );
  }

  const statement = statements[0]!;
  if (!/^\s*(select|with)\b/.test(statement)) {
    throw new UnsafeSqlError(
      "not-a-select",
      `must start with SELECT or WITH, got "${statement.slice(0, 24)}…"`,
    );
  }

  for (const keyword of FORBIDDEN_KEYWORDS) {
    // `\b` treats `_` as a word character, so `last_autovacuum` does NOT match
    // `\bvacuum\b`. See the module header — this is load-bearing.
    if (new RegExp(`\\b${keyword}\\b`).test(statement)) {
      throw new UnsafeSqlError("forbidden-keyword", keyword);
    }
  }

  for (const fn of FORBIDDEN_FUNCTIONS) {
    if (new RegExp(`\\b${fn}\\s*\\(`).test(statement)) {
      throw new UnsafeSqlError("forbidden-function", fn);
    }
  }

  return sql;
}

/** Non-throwing variant, for reporting several queries at once. */
export function isReadOnlySql(sql: string): boolean {
  try {
    assertReadOnlySql(sql);
    return true;
  } catch {
    return false;
  }
}
