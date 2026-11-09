/**
 * Read-only SQL **query tool** for Supabase production. Not an executor.
 *
 * Runs a file of SELECT/WITH statements against production and prints the
 * result. It cannot write, and it is not a general psql shell: every statement
 * is checked before the container starts, and the session itself is read-only.
 *
 *   pnpm -C apps/web exec tsx ../../scripts/ops/read-only-query.ts <file.sql>
 *   … --raw   Print output unredacted. Only for output known to carry no
 *             identifiers — the default masks them.
 *
 * ── Why a container ───────────────────────────────────────────────────────
 * There is no local `psql`, and the direct host is IPv6-only. The
 * `postgres:16-alpine` image supplies the CLIENT only — **the database is
 * production**, identical to pasting into the SQL editor. `--rm` so no
 * container and no anonymous volume survives the run.
 *
 * ── What stops a write ────────────────────────────────────────────────────
 *  1. **The server.** Every run starts with
 *     `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`, so Postgres
 *     rejects a write rather than our good intentions doing it.
 *     ⚠️ NOT `PGOPTIONS`: Supavisor drops it silently, so a read-only flag
 *     passed that way looks set and does nothing.
 *  2. **`assertReadOnlySql`**, the guard the health monitor already uses —
 *     reused, not reimplemented. Each statement must be a single SELECT/WITH
 *     with no DML/DDL keyword and no dangerous function.
 *
 * ── What it will not print ────────────────────────────────────────────────
 * Output is redacted by default: wallets, hashes, UUIDs, emails and long digit
 * runs are masked. Nothing is hardcoded and no credential is ever rendered —
 * `SUPABASE_URL` and `SUPABASE_DB_PASSWORD` come from the environment and the
 * password travels only in the child process env, never in argv.
 *
 * The tool holds NO query of its own: what runs is the file you pass it.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadOpsEnv, parseSupabaseRef } from "./lib/env";
import { assertReadOnlySql } from "./lib/read-only-guard";
import { childEnv } from "./lib/child-env";

const POOLER_HOST = "aws-1-us-east-1.pooler.supabase.com";
const POOLER_PORT = 5432;
const DOCKER_PG_IMAGE = "postgres:16-alpine";
const TIMEOUT_MS = 60_000;

/** The session characteristic the RUNNER supplies. It is not user input, which
 *  is why it is allowed to be the one `SET` in the script. */
const READ_ONLY_PREAMBLE = "SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;";

/** psql meta-commands that only affect OUTPUT and can touch no data. Anything
 *  else starting with a backslash is refused rather than guessed about — `\copy`
 *  writes files, `\!` runs a shell. */
const ALLOWED_META = /^\\(echo|qecho|pset|timing|x)\b/;

/**
 * Split a script into the pieces the guard must see, keeping output-only psql
 * meta-commands aside. Reuses `assertReadOnlySql` per statement so a
 * multi-query analysis script stays possible without weakening the guard that
 * the monitor already depends on.
 */
export function assertReadOnlyScript(script: string): void {
  const sqlOnly: string[] = [];
  for (const line of script.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("\\")) {
      if (!ALLOWED_META.test(trimmed)) {
        throw new Error(`refusing to run: unsupported psql meta-command "${trimmed}"`);
      }
      continue; // Output-only; never reaches the guard.
    }
    sqlOnly.push(line);
  }

  const statements = sqlOnly
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (statements.length === 0) throw new Error("refusing to run: no statement found");
  // Each statement individually, because the guard's own contract is one
  // statement at a time — that is the property that makes it trustworthy.
  for (const statement of statements) assertReadOnlySql(statement);
}

/**
 * Mask every identifier shape before anything is printed.
 * Deliberately BROAD: over-masking costs a re-run, under-masking puts a wallet
 * into a transcript that cannot be taken back. For error-message analysis it
 * also helps — it is the normalization that makes two messages from different
 * wallets read as one family.
 */
export function redact(text: string): string {
  return text
    .replace(/0x[a-fA-F0-9]{6,}/g, "0x<hex>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<email>")
    .replace(/\b\d{10,}\b/g, "<n>");
}

/** psql echoes the connection string in several of its failure messages. */
export function sanitizeError(raw: unknown): string {
  const text = raw instanceof Error ? raw.message : String(raw);
  return redact(
    text
      .replace(/postgresql:\/\/[^\s"']+/gi, "postgresql://[REDACTED]")
      .replace(/password=[^\s"'&]+/gi, "password=[REDACTED]"),
  ).slice(0, 2_000);
}

export function main(argv: readonly string[]): number {
  const raw = argv.includes("--raw");
  const file = argv.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("usage: read-only-query.ts <file.sql> [--raw]");
    return 2;
  }

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const script = readFileSync(path.resolve(file), "utf8");
  assertReadOnlyScript(script);

  const env = loadOpsEnv(repoRoot);
  const ref = parseSupabaseRef(env.get("SUPABASE_URL"));
  if (!env.has("SUPABASE_DB_PASSWORD") || !ref) {
    console.error("missing credentials: need SUPABASE_URL (parseable) + SUPABASE_DB_PASSWORD");
    return 3;
  }

  const password = encodeURIComponent(env.get("SUPABASE_DB_PASSWORD")!);
  const conn =
    `postgresql://postgres.${ref}:${password}` +
    `@${POOLER_HOST}:${POOLER_PORT}/postgres?sslmode=require`;

  // Each `docker run` is a FRESH session, so the read-only characteristic has
  // to ride along with the query — setting it in a separate call would not
  // carry over to anything.
  const guarded = `${READ_ONLY_PREAMBLE}\n${script}`;

  try {
    const out = execFileSync(
      "docker",
      [
        "run",
        "--rm",
        "-i",
        // ⛔ Names only. This comment used to say "never argv" while
        // `-e NAME=value` put both there — see lib/child-env.ts.
        "-e",
        "PGCONN",
        "-e",
        "PGQUERY",
        DOCKER_PG_IMAGE,
        "sh",
        "-c",
        // `-f -` and not `-c`: `-c` wraps a multi-statement string in one
        // implicit transaction and rejects backslash commands, so a script with
        // section markers would not print section by section.
        'printf %s "$PGQUERY" | psql "$PGCONN" -v ON_ERROR_STOP=1 -f -',
      ],
      {
        encoding: "utf8",
        timeout: TIMEOUT_MS,
        stdio: ["pipe", "pipe", "pipe"],
        env: childEnv({ PGCONN: conn, PGQUERY: guarded }),
      },
    );
    process.stdout.write(raw ? out : redact(out));
    return 0;
  } catch (err) {
    console.error(sanitizeError(err));
    return 1;
  }
}

// Only when executed directly — importing this module (tests) must not run it.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
