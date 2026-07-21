# Supabase Backup & Local Restore — Implementation Plan (v1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/specs/2026-07-21-supabase-backup-restore-spec.md`

**Goal:** Dump production Supabase to disk, restore it into the local Docker stack behind a hard anti-production guard, and confirm the ledger and migration history survived — so `20260721030000_peones_v1_economy.sql` can be rehearsed by hand before it ever touches prod.

**Architecture:** One pure-logic module (`lib.ts`) holds everything that can be silently wrong — the guard, the COPY-block parsers, the manifest schema, the post-restore evaluation. Two thin entry scripts (`backup.ts`, `restore-local.ts`) do I/O only: shell out to the Supabase CLI and to `docker exec … psql`. Tests cover `lib.ts` exclusively; Docker and the network are never under test. This mirrors `apps/web/scripts/preflight-disk.ts`, which is the house pattern for a guard script.

**Tech Stack:** TypeScript run with `tsx`, Vitest, Supabase CLI 2.98.2, Docker 29.2.0, Node `node:crypto` / `node:child_process` (no new dependencies).

## Global Constraints

- **No `cd` in any command.** Every Supabase CLI call passes `--workdir apps/web`. Every git/pnpm call uses `-C <abs-path>`. (CLAUDE.md command hygiene.)
- **Never print secrets.** The DB password is passed to child processes via the `SUPABASE_DB_PASSWORD` env var, never in argv (argv is visible in `ps`). It is never logged, never written to the manifest, never included in an error message. Same for the connection string and the project ref.
- **Backups live outside the repo.** Default root `$HOME/backups/chesscito/db`; override with `CHESSCITO_BACKUP_DIR`. `resolveBackupRoot` **throws** if the resolved path lands inside the repo.
- **This plan never writes to production.** It only reads. No remote migration, no data mutation, no merge.
- **The pending migration is never applied automatically** — not to prod, not to local. The command is printed for a human to run.
- **Local DB target is exactly** host ∈ {`127.0.0.1`, `localhost`}, port `55322`, container name prefix `supabase_db_`.
- Scripts live in `apps/web/scripts/db/`; tests in `apps/web/scripts/db/__tests__/`. `apps/web/vitest.config.ts:13` already globs `scripts/**/__tests__/**/*.test.{ts,tsx}` — **no config change is needed or permitted**.
- Commit style: Conventional Commits, signature line `Wolfcito 🐾 @akawolfcito`. No backticks inside `git commit -m` (zsh eats them).
- Run the full suite before each commit; report the pass count in the commit body.

**Test command (used in every task):**
`pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web vitest run scripts/db`

---

### Task 1: Constants, backup root resolution, and env parsing

**Files:**
- Create: `apps/web/scripts/db/lib.ts`
- Test: `apps/web/scripts/db/__tests__/lib.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `LOCAL_DB_PORT: 55322`, `LOCAL_DB_HOSTS: readonly string[]`, `LOCAL_CONTAINER_PREFIX: "supabase_db_"`
  - `CRITICAL_TABLES: readonly ["public.peones_ledger", "public.treasury_payment_intents", "public.treasury_payment_consumptions"]`
  - `DUMP_FILES: readonly ["roles.sql", "schema.sql", "data.sql", "migration_history.sql"]`
  - `resolveBackupRoot(env: NodeJS.ProcessEnv, home: string, repoRoot: string): string`
  - `formatBackupStamp(date: Date): string`
  - `parseEnvValue(contents: string, key: string): string | null`

- [ ] **Step 1: Write the failing test**

Create `apps/web/scripts/db/__tests__/lib.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  CRITICAL_TABLES,
  DUMP_FILES,
  formatBackupStamp,
  parseEnvValue,
  resolveBackupRoot,
} from "../lib";

const HOME = "/Users/dev";
const REPO = "/Users/dev/code/chesscito";

describe("resolveBackupRoot", () => {
  it("defaults to $HOME/backups/chesscito/db — outside any repo", () => {
    expect(resolveBackupRoot({}, HOME, REPO)).toBe("/Users/dev/backups/chesscito/db");
  });

  it("honours CHESSCITO_BACKUP_DIR as the root", () => {
    const env = { CHESSCITO_BACKUP_DIR: "/Volumes/ext/chesscito-dumps" };
    expect(resolveBackupRoot(env, HOME, REPO)).toBe("/Volumes/ext/chesscito-dumps");
  });

  it("expands a leading ~ in the override", () => {
    const env = { CHESSCITO_BACKUP_DIR: "~/elsewhere" };
    expect(resolveBackupRoot(env, HOME, REPO)).toBe("/Users/dev/elsewhere");
  });

  it("treats an empty or whitespace override as unset", () => {
    expect(resolveBackupRoot({ CHESSCITO_BACKUP_DIR: "   " }, HOME, REPO)).toBe(
      "/Users/dev/backups/chesscito/db",
    );
  });

  it("refuses any destination inside the repo", () => {
    // A production dump inside the working tree can be staged by a distracted
    // git add. Gitignore is a mitigation; staying out of the tree is a fix.
    expect(() =>
      resolveBackupRoot({ CHESSCITO_BACKUP_DIR: `${REPO}/private/backups` }, HOME, REPO),
    ).toThrow(/inside the repo/i);
    expect(() => resolveBackupRoot({ CHESSCITO_BACKUP_DIR: REPO }, HOME, REPO)).toThrow(
      /inside the repo/i,
    );
  });

  it("does not mistake a sibling directory with the same prefix for the repo", () => {
    // /repo-backups is NOT inside /repo, despite the string prefix.
    const env = { CHESSCITO_BACKUP_DIR: `${REPO}-backups` };
    expect(resolveBackupRoot(env, HOME, REPO)).toBe(`${REPO}-backups`);
  });
});

describe("formatBackupStamp", () => {
  it("produces a filesystem-safe UTC stamp", () => {
    // Colons are legal on APFS but hostile everywhere else, including in the
    // shell paths a human will paste back into the restore command.
    expect(formatBackupStamp(new Date("2026-07-21T18:04:11.000Z"))).toBe("2026-07-21T18-04-11Z");
  });
});

describe("parseEnvValue", () => {
  const ENV_FILE = [
    "# comment",
    "SUPABASE_URL=https://example.supabase.co",
    'SUPABASE_DB_PASSWORD="p@ss w:rd#1"',
    "OTHER=x",
  ].join("\n");

  it("reads the requested key", () => {
    expect(parseEnvValue(ENV_FILE, "SUPABASE_DB_PASSWORD")).toBe("p@ss w:rd#1");
  });

  it("strips surrounding quotes but keeps inner punctuation", () => {
    expect(parseEnvValue("K='a=b#c'", "K")).toBe("a=b#c");
  });

  it("returns null for a missing key rather than an empty string", () => {
    // Missing and empty are different failures and get different messages.
    expect(parseEnvValue(ENV_FILE, "NOPE")).toBeNull();
  });

  it("does not match a key that merely ends with the requested name", () => {
    expect(parseEnvValue("MY_SUPABASE_DB_PASSWORD=nope", "SUPABASE_DB_PASSWORD")).toBeNull();
  });
});

describe("constants", () => {
  it("names the three tables the post-restore check cares about", () => {
    expect(CRITICAL_TABLES).toEqual([
      "public.peones_ledger",
      "public.treasury_payment_intents",
      "public.treasury_payment_consumptions",
    ]);
  });

  it("lists the four dumps, migration history included", () => {
    // migration_history.sql is the one that makes `supabase migration up` apply
    // only the pending migration instead of all 29.
    expect(DUMP_FILES).toContain("migration_history.sql");
    expect(DUMP_FILES).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web vitest run scripts/db`
Expected: FAIL — `Failed to resolve import "../lib"`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/scripts/db/lib.ts`:

```ts
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
    override && override.length > 0
      ? override
      : path.join(home, ...DEFAULT_ROOT_SEGMENTS);
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
 * Read one key out of a .env file's contents. Deliberately minimal: this is
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web vitest run scripts/db`
Expected: PASS — 12 tests.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/scripts/db/lib.ts apps/web/scripts/db/__tests__/lib.test.ts
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(db): resolve a backup root that cannot land inside the repo

Path-segment containment, not string prefix, so a sibling directory
sharing the repo name is not mistaken for the repo itself.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 2: The anti-production guard

**Files:**
- Modify: `apps/web/scripts/db/lib.ts` (append)
- Test: `apps/web/scripts/db/__tests__/lib.test.ts` (append)

**Interfaces:**
- Consumes: `LOCAL_DB_PORT`, `LOCAL_DB_HOSTS`, `LOCAL_CONTAINER_PREFIX` from Task 1.
- Produces: `assertLocalTarget(dbUrl: string, containerName: string): void` — returns `void` on success, throws `Error` otherwise.

This is the single most important function in the plan. `restore-local.ts` drops the database it points at. Its tests are written to prove what it **rejects**.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/scripts/db/__tests__/lib.test.ts` (and add `assertLocalTarget` to the import from `../lib`):

```ts
describe("assertLocalTarget", () => {
  const LOCAL = "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

  it("accepts the local stack on 127.0.0.1 and on localhost", () => {
    expect(() => assertLocalTarget(LOCAL, "supabase_db_web")).not.toThrow();
    expect(() =>
      assertLocalTarget("postgresql://postgres:postgres@localhost:55322/postgres", "supabase_db_web"),
    ).not.toThrow();
  });

  // Everything below is the point of the function. restore-local DROPs the
  // database it is handed; each of these, if allowed through, destroys data
  // that has no backup other than the one being restored.

  it("rejects a Supabase-hosted host", () => {
    expect(() =>
      assertLocalTarget(
        "postgresql://postgres:pw@db.brsbdzpuvotxsadmcxyj.supabase.co:5432/postgres",
        "supabase_db_web",
      ),
    ).toThrow(/refusing/i);
  });

  it("rejects any non-loopback host, even on the right port", () => {
    expect(() =>
      assertLocalTarget("postgresql://postgres:pw@10.0.0.7:55322/postgres", "supabase_db_web"),
    ).toThrow(/refusing/i);
  });

  it("rejects the right host on the wrong port", () => {
    // 5432 on loopback could be a real local Postgres holding real work.
    expect(() =>
      assertLocalTarget("postgresql://postgres:pw@127.0.0.1:5432/postgres", "supabase_db_web"),
    ).toThrow(/refusing/i);
  });

  it("rejects a URL with no port at all rather than assuming the default", () => {
    expect(() =>
      assertLocalTarget("postgresql://postgres:pw@127.0.0.1/postgres", "supabase_db_web"),
    ).toThrow(/refusing/i);
  });

  it("rejects a container that is not a Supabase local container", () => {
    expect(() => assertLocalTarget(LOCAL, "postgres")).toThrow(/refusing/i);
    expect(() => assertLocalTarget(LOCAL, "")).toThrow(/refusing/i);
  });

  it("rejects empty and malformed input instead of failing open", () => {
    expect(() => assertLocalTarget("", "supabase_db_web")).toThrow(/refusing/i);
    expect(() => assertLocalTarget("not a url", "supabase_db_web")).toThrow(/refusing/i);
    expect(() => assertLocalTarget("127.0.0.1:55322", "supabase_db_web")).toThrow(/refusing/i);
  });

  it("never puts the connection string in the error it throws", () => {
    // The URL carries the password. A guard that leaks it into a stack trace
    // or CI log trades one hazard for another.
    const secret = "postgresql://postgres:hunter2@db.example.supabase.co:5432/postgres";
    expect(() => assertLocalTarget(secret, "supabase_db_web")).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining("hunter2") }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web vitest run scripts/db`
Expected: FAIL — `assertLocalTarget is not a function` / import error.

- [ ] **Step 3: Write minimal implementation**

Append to `apps/web/scripts/db/lib.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web vitest run scripts/db`
Expected: PASS — 20 tests.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/scripts/db/lib.ts apps/web/scripts/db/__tests__/lib.test.ts
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(db): fail closed on any restore target that is not the local stack

Tested by what it rejects: hosted Supabase, non-loopback hosts, the
right host on 5432, a missing port, a foreign container, and garbage.
The error never quotes the connection string, which carries the password.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 3: Reading the dumps — COPY row counts and applied migrations

**Files:**
- Modify: `apps/web/scripts/db/lib.ts` (append)
- Test: `apps/web/scripts/db/__tests__/lib.test.ts` (append)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `countCopyRows(sql: string, qualifiedTable: string): number | null` — `null` means the table has no COPY block at all (absent), `0` means present but empty.
  - `parseAppliedMigrationVersions(sql: string): string[]` — ascending.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/scripts/db/__tests__/lib.test.ts` (add both names to the `../lib` import):

```ts
/** Shape of a real `supabase db dump --data-only --use-copy` file: quoted
 *  identifiers, a column list, tab-separated rows, a lone backslash-dot. */
const DATA_SQL = [
  "SET statement_timeout = 0;",
  "--",
  '-- Data for Name: peones_ledger; Type: TABLE DATA; Schema: public',
  "--",
  'COPY "public"."peones_ledger" ("id", "wallet", "amount") FROM stdin;',
  "1\t0xaaa\t10",
  "2\t0xbbb\t-5",
  "3\t0xccc\t7",
  "\\.",
  "",
  'COPY "public"."treasury_payment_intents" ("id", "state") FROM stdin;',
  "\\.",
  "",
].join("\n");

describe("countCopyRows", () => {
  it("counts the rows of a table's COPY block", () => {
    expect(countCopyRows(DATA_SQL, "public.peones_ledger")).toBe(3);
  });

  it("returns 0 for a table that is present but empty", () => {
    expect(countCopyRows(DATA_SQL, "public.treasury_payment_intents")).toBe(0);
  });

  it("returns null for a table with no COPY block — absent is not empty", () => {
    // The manifest reports these differently, and so must this: a table missing
    // from the dump is a broken backup, an empty table is a fact about prod.
    expect(countCopyRows(DATA_SQL, "public.treasury_payment_consumptions")).toBeNull();
  });

  it("accepts unquoted identifiers", () => {
    const sql = ["COPY public.scores (id) FROM stdin;", "1", "2", "\\."].join("\n");
    expect(countCopyRows(sql, "public.scores")).toBe(2);
  });

  it("does not stop at a backslash-dot that appears inside a value", () => {
    // pg_dump escapes backslashes in COPY output, so a data line can never be
    // exactly \. — but it CAN contain the two characters. Count must not trip.
    const sql = [
      "COPY public.notes (id, body) FROM stdin;",
      "1\tends with \\\\. inside",
      "2\tplain",
      "\\.",
    ].join("\n");
    expect(countCopyRows(sql, "public.notes")).toBe(2);
  });

  it("does not confuse a table whose name is a suffix of another", () => {
    const sql = [
      "COPY public.peones_ledger_archive (id) FROM stdin;",
      "1",
      "\\.",
      "COPY public.peones_ledger (id) FROM stdin;",
      "1",
      "2",
      "\\.",
    ].join("\n");
    expect(countCopyRows(sql, "public.peones_ledger")).toBe(2);
  });
});

describe("parseAppliedMigrationVersions", () => {
  const HISTORY_SQL = [
    'COPY "supabase_migrations"."schema_migrations" ("version", "statements", "name") FROM stdin;',
    "20260406000000\t\\N\tinitial_remote_schema",
    "20260721020000\t\\N\tget_peones_intent_expiry_reuse",
    "20260607000000\t\\N\tpeones_ledger_init",
    "\\.",
  ].join("\n");

  it("reads the version column of every applied migration", () => {
    expect(parseAppliedMigrationVersions(HISTORY_SQL)).toEqual([
      "20260406000000",
      "20260607000000",
      "20260721020000",
    ]);
  });

  it("sorts ascending so the last element is the newest applied migration", () => {
    // The dump's row order is not guaranteed; the manifest's latestMigration is.
    const versions = parseAppliedMigrationVersions(HISTORY_SQL);
    expect(versions.at(-1)).toBe("20260721020000");
  });

  it("returns an empty array when the ledger block is missing", () => {
    // Callers treat this as a failed backup, not as a virgin database.
    expect(parseAppliedMigrationVersions("SET statement_timeout = 0;")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web vitest run scripts/db`
Expected: FAIL — the two new functions are not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `apps/web/scripts/db/lib.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web vitest run scripts/db`
Expected: PASS — 29 tests.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/scripts/db/lib.ts apps/web/scripts/db/__tests__/lib.test.ts
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(db): count dump rows from the artifact, not from a second query

A number read out of data.sql describes the backup we hold. A number
read from prod a second time can already disagree with it.

Absent returns null, empty returns 0. One is a broken backup.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 4: The manifest

**Files:**
- Modify: `apps/web/scripts/db/lib.ts` (append)
- Test: `apps/web/scripts/db/__tests__/lib.test.ts` (append)

**Interfaces:**
- Consumes: `DUMP_FILES`, `CRITICAL_TABLES`.
- Produces:
  - `MANIFEST_VERSION: 1`
  - `interface BackupFileEntry { name: string; bytes: number; sha256: string }`
  - `interface BackupManifest { version: number; createdAt: string; gitSha: string; latestMigration: string; cliVersion: string; files: BackupFileEntry[]; criticalTableRows: Record<string, number> }`
  - `parseManifest(raw: string): BackupManifest`

- [ ] **Step 1: Write the failing test**

Append to `apps/web/scripts/db/__tests__/lib.test.ts` (add `MANIFEST_VERSION`, `parseManifest`, and `type BackupManifest` to the import):

```ts
describe("parseManifest", () => {
  const valid: BackupManifest = {
    version: MANIFEST_VERSION,
    createdAt: "2026-07-21T18:04:11Z",
    gitSha: "b084f9fc",
    latestMigration: "20260721020000",
    cliVersion: "2.98.2",
    files: [{ name: "data.sql", bytes: 39122, sha256: "a".repeat(64) }],
    criticalTableRows: { "public.peones_ledger": 1420 },
  };

  it("accepts a well-formed manifest", () => {
    expect(parseManifest(JSON.stringify(valid))).toEqual(valid);
  });

  it("rejects a manifest written by a future version of these scripts", () => {
    // Restoring against a manifest whose meaning has changed is worse than
    // refusing: the post-restore check would compare the wrong fields.
    const raw = JSON.stringify({ ...valid, version: MANIFEST_VERSION + 1 });
    expect(() => parseManifest(raw)).toThrow(/version/i);
  });

  it("rejects a manifest with no files list", () => {
    const { files: _files, ...rest } = valid;
    expect(() => parseManifest(JSON.stringify(rest))).toThrow(/files/i);
  });

  it("rejects a manifest with no criticalTableRows", () => {
    const { criticalTableRows: _rows, ...rest } = valid;
    expect(() => parseManifest(JSON.stringify(rest))).toThrow(/criticalTableRows/i);
  });

  it("rejects a file entry missing its checksum", () => {
    const raw = JSON.stringify({ ...valid, files: [{ name: "data.sql", bytes: 1 }] });
    expect(() => parseManifest(raw)).toThrow(/sha256/i);
  });

  it("rejects input that is not JSON at all", () => {
    expect(() => parseManifest("<html>")).toThrow(/manifest/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web vitest run scripts/db`
Expected: FAIL — `parseManifest` / `MANIFEST_VERSION` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `apps/web/scripts/db/lib.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web vitest run scripts/db`
Expected: PASS — 35 tests.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/scripts/db/lib.ts apps/web/scripts/db/__tests__/lib.test.ts
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(db): version the manifest and refuse anything newer

A post-restore check that compares the wrong fields is worse than a
restore that will not start.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 5: `backup.ts` — production to disk

**Files:**
- Create: `apps/web/scripts/db/backup.ts`
- Modify: `apps/web/package.json` (scripts block, after line 32)

**Interfaces:**
- Consumes: `resolveBackupRoot`, `formatBackupStamp`, `parseEnvValue`, `countCopyRows`, `parseAppliedMigrationVersions`, `DUMP_FILES`, `CRITICAL_TABLES`, `MANIFEST_VERSION`, `MANIFEST_NAME`, `BackupManifest`.
- Produces: a backup directory; no exported API consumed by later tasks.

No unit tests: this file is I/O orchestration over already-tested functions. Its verification is Task 8's live run.

- [ ] **Step 1: Write the script**

Create `apps/web/scripts/db/backup.ts`:

```ts
/**
 * Dump production Supabase to disk.
 *
 * The free tier has no automatic backups, so this is the only copy that exists.
 * It follows from that: a partial backup that looks complete is worse than no
 * backup at all, so any failed dump deletes the whole directory on the way out.
 *
 * Reads production. Never writes to it.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
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
        ["db", "dump", "--linked", "--workdir", WEB_DIR, "-f", path.join(dir, name), ...DUMP_ARGS[name]],
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
```

- [ ] **Step 2: Register the npm script**

In `apps/web/package.json`, add after the `"migrate-exercises"` entry (line 32) — remember the preceding line needs a trailing comma:

```json
    "db:backup": "tsx scripts/db/backup.ts",
    "db:restore-local": "tsx scripts/db/restore-local.ts"
```

- [ ] **Step 3: Typecheck**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec tsc --noEmit`
Expected: no errors. (`db:restore-local` points at a file that does not exist yet — that is fine, `tsc` does not resolve npm scripts.)

- [ ] **Step 4: Verify the script refuses without a password**

Run: `CHESSCITO_BACKUP_DIR=/tmp/does-not-matter SUPABASE_DB_PASSWORD= pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web db:backup`
Expected: this only proves the happy path is reachable if `.env` has the key. Do **not** treat a real dump here as the verification — that is Task 8. If it starts dumping, let it finish and delete the directory.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/scripts/db/backup.ts apps/web/package.json
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(db): dump production to disk, or leave nothing behind

Four dumps plus a manifest. Any failure removes the whole directory:
on the free tier this is the only copy, and a partial backup that looks
complete is worse than none.

The password goes to children through the environment, never argv,
because argv is readable in ps.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 6: Post-restore evaluation (pure)

**Files:**
- Modify: `apps/web/scripts/db/lib.ts` (append)
- Test: `apps/web/scripts/db/__tests__/lib.test.ts` (append)

**Interfaces:**
- Consumes: `BackupManifest`, `CRITICAL_TABLES`.
- Produces:
  - `interface RestoreObservation { existingTables: string[]; migrationCount: number; latestMigration: string | null; peonesLedgerRows: number }`
  - `evaluatePostRestore(observed: RestoreObservation, manifest: BackupManifest): { ok: boolean; failures: string[] }`

- [ ] **Step 1: Write the failing test**

Append to `apps/web/scripts/db/__tests__/lib.test.ts` (add `evaluatePostRestore` and `type RestoreObservation` to the import):

```ts
describe("evaluatePostRestore", () => {
  const manifest: BackupManifest = {
    version: MANIFEST_VERSION,
    createdAt: "2026-07-21T18:04:11Z",
    gitSha: "b084f9fc",
    latestMigration: "20260721020000",
    cliVersion: "2.98.2",
    files: [{ name: "data.sql", bytes: 1, sha256: "a".repeat(64) }],
    criticalTableRows: { "public.peones_ledger": 1420 },
  };

  const good: RestoreObservation = {
    existingTables: [...CRITICAL_TABLES],
    migrationCount: 29,
    latestMigration: "20260721020000",
    peonesLedgerRows: 1420,
  };

  it("passes when the replica matches the manifest", () => {
    expect(evaluatePostRestore(good, manifest)).toEqual({ ok: true, failures: [] });
  });

  it("fails when a critical table is missing, naming it", () => {
    const observed = {
      ...good,
      existingTables: ["public.peones_ledger", "public.treasury_payment_intents"],
    };
    const result = evaluatePostRestore(observed, manifest);
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toMatch(/treasury_payment_consumptions/);
  });

  it("fails when the migration ledger is empty", () => {
    // An empty ledger means `supabase migration up` would replay all 29
    // migrations instead of the one pending — the rehearsal would be worthless.
    const result = evaluatePostRestore({ ...good, migrationCount: 0 }, manifest);
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toMatch(/migration/i);
  });

  it("fails when the newest restored migration is not the one the manifest recorded", () => {
    const result = evaluatePostRestore(
      { ...good, latestMigration: "20260406000000" },
      manifest,
    );
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toMatch(/20260721020000/);
  });

  it("fails on a ledger row-count mismatch, showing both numbers", () => {
    const result = evaluatePostRestore({ ...good, peonesLedgerRows: 1419 }, manifest);
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toMatch(/1420/);
    expect(result.failures.join("\n")).toMatch(/1419/);
  });

  it("reports every failure at once, not just the first", () => {
    // One round trip per problem turns a five-minute check into an afternoon.
    const result = evaluatePostRestore(
      { existingTables: [], migrationCount: 0, latestMigration: null, peonesLedgerRows: 0 },
      manifest,
    );
    expect(result.failures.length).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web vitest run scripts/db`
Expected: FAIL — `evaluatePostRestore` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `apps/web/scripts/db/lib.ts`:

```ts
export interface RestoreObservation {
  existingTables: string[];
  migrationCount: number;
  latestMigration: string | null;
  peonesLedgerRows: number;
}

/**
 * The minimum that has to be true for the restored copy to be worth rehearsing
 * a migration against. Not a full-schema comparison — three tables and the
 * migration ledger answer the question this v1 was built to answer.
 *
 * Collects every failure instead of stopping at the first: one round trip per
 * problem turns a five-minute check into an afternoon.
 */
export function evaluatePostRestore(
  observed: RestoreObservation,
  manifest: BackupManifest,
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];

  for (const table of CRITICAL_TABLES) {
    if (!observed.existingTables.includes(table)) {
      failures.push(`missing table: ${table}`);
    }
  }
  if (observed.migrationCount === 0) {
    failures.push(
      "supabase_migrations.schema_migrations is empty — migration up would replay everything",
    );
  }
  if (observed.latestMigration !== manifest.latestMigration) {
    failures.push(
      `latest migration is ${observed.latestMigration ?? "none"}, manifest recorded ${manifest.latestMigration}`,
    );
  }
  const expectedRows = manifest.criticalTableRows["public.peones_ledger"];
  if (observed.peonesLedgerRows !== expectedRows) {
    failures.push(
      `public.peones_ledger has ${observed.peonesLedgerRows} rows, manifest recorded ${expectedRows}`,
    );
  }

  return { ok: failures.length === 0, failures };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web vitest run scripts/db`
Expected: PASS — 41 tests.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/scripts/db/lib.ts apps/web/scripts/db/__tests__/lib.test.ts
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(db): judge a restored replica on three tables and the ledger

Reports every failure at once. One round trip per problem turns a
five-minute check into an afternoon.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 7: `restore-local.ts` — disk to the local stack

**Files:**
- Create: `apps/web/scripts/db/restore-local.ts`

**Interfaces:**
- Consumes: `assertLocalTarget`, `parseManifest`, `evaluatePostRestore`, `DUMP_FILES`, `CRITICAL_TABLES`, `MANIFEST_NAME`, `LOCAL_CONTAINER_PREFIX`, `RestoreObservation`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the script**

Create `apps/web/scripts/db/restore-local.ts`:

```ts
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
  LOCAL_CONTAINER_PREFIX,
  MANIFEST_NAME,
  DUMP_FILES,
  type RestoreObservation,
  assertLocalTarget,
  evaluatePostRestore,
  parseManifest,
} from "./lib";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const WEB_DIR = path.join(REPO_ROOT, "apps/web");
const CONTAINER = `${LOCAL_CONTAINER_PREFIX}web`; // project_id = "web"

function run(cmd: string, args: string[], input?: string): string {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    input,
    maxBuffer: 512 * 1024 * 1024,
  });
}

/** psql inside the container: the host has no psql binary. */
function psql(sql: string, database = "postgres"): string {
  return run(
    "docker",
    ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-F", "|", "-c", sql],
  ).trim();
}

function psqlFile(sqlText: string): void {
  run(
    "docker",
    ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-f", "-"],
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

  // ── Phase C: restore ─────────────────────────────────────────────────────
  // Connect to template1 to drop `postgres`; FORCE evicts the stack's own
  // pooled connections, which reconnect on their own afterwards.
  console.log("Recreating the local database …");
  psql("DROP DATABASE IF EXISTS postgres WITH (FORCE);", "template1");
  psql("CREATE DATABASE postgres;", "template1");

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

  console.log("\nPost-restore check");
  for (const table of CRITICAL_TABLES) {
    console.log(`  ${existingTables.includes(table) ? "OK  " : "FAIL"} ${table}`);
  }
  console.log(`  ${observed.migrationCount > 0 ? "OK  " : "FAIL"} migrations restored: ${observed.migrationCount}`);
  console.log(`  ${observed.latestMigration === manifest.latestMigration ? "OK  " : "FAIL"} latest: ${observed.latestMigration}`);
  console.log(`  ${observed.peonesLedgerRows === manifest.criticalTableRows["public.peones_ledger"] ? "OK  " : "FAIL"} peones_ledger rows: ${observed.peonesLedgerRows}`);

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
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Prove the guard refuses a bad target, end to end**

Confirm the script aborts before any destructive statement when the target is wrong. Temporarily point it at a fake status by running with the stack stopped:

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web db:restore-local /tmp/nonexistent-backup`
Expected: fails at Phase A (`ENOENT … manifest.json`) — **before** `supabase start`, before any DROP.

- [ ] **Step 4: Run the full script test suite**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web vitest run scripts/db`
Expected: PASS — 41 tests.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/scripts/db/restore-local.ts
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(db): restore into the local stack behind the guard, then grade it

Checksums first, guard second, DROP third. The target is read from
supabase status and validated, never assembled from assumptions.

The pending migration is printed, not run. A person watches that one.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 8: Runbook, live run, and the rehearsal

**Files:**
- Create: `docs/runbooks/supabase-backup-restore.md`

This is the task that produces the actual deliverable: a real backup on disk and a real rehearsal of the pending migration. **It requires the founder's machine, network access to production, and Docker running.**

- [ ] **Step 1: Take a real backup**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web db:backup`
Expected: four dumps plus `manifest.json` under `$HOME/backups/chesscito/db/<stamp>/`, and a printed row count for each critical table. Record the actual counts — they go in the runbook as the first known-good reference.

- [ ] **Step 2: Restore it locally**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web db:restore-local "$HOME/backups/chesscito/db/<stamp>"`
Expected: `Replica is faithful.` and exit code 0. If any line reads `FAIL`, stop — do not proceed to Step 3, and do not apply anything to production.

- [ ] **Step 3: Rehearse the pending migration, by hand**

Run: `supabase migration up --workdir /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web`
Expected: exactly one migration applied — `20260721030000_peones_v1_economy.sql`. If the CLI tries to apply more than one, the migration ledger did not restore correctly; stop and investigate rather than forcing it.

- [ ] **Step 4: Write the runbook**

Create `docs/runbooks/supabase-backup-restore.md` covering: the three commands in order; where backups land and how to override with `CHESSCITO_BACKUP_DIR`; what each `FAIL` line in the post-restore check means and what to do about it; the observed row counts from Step 1 as a reference point; and an explicit note that nothing here writes to production and that applying a migration to prod is a separate, human decision outside this runbook.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add docs/runbooks/supabase-backup-restore.md
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "docs(runbook): three commands from production dump to migration rehearsal

Records the first known-good row counts, so the next restore has
something to disagree with.

Wolfcito 🐾 @akawolfcito"
```

---

## Self-review against the spec

| Spec requirement | Task |
|---|---|
| `roles.sql`, `schema.sql`, `data.sql`, `migration_history.sql` | 1 (`DUMP_FILES`), 5 (`DUMP_ARGS`) |
| SHA-256 checksums | 4 (schema), 5 (write), 7 (verify) |
| Basic manifest: timestamp, git SHA, latest migration, CLI version, sizes, checksums, critical counts | 4, 5 |
| Strict anti-production guard | 2, 7 (Phase B) |
| Target validated as `localhost`/`127.0.0.1:55322` | 2 |
| Rejection tests for `assertLocalTarget` | 2 (seven rejection cases) |
| No separate `verify-restore.ts` | 7 (Phase D is inside `restore-local.ts`) |
| Minimal post-restore check: 3 tables, ledger non-empty, latest migration, `peones_ledger` count | 6, 7 |
| Default `$HOME/backups/chesscito/db/<timestamp>` | 1 |
| `CHESSCITO_BACKUP_DIR` override | 1 |
| `private/backups` not used | 1 (`resolveBackupRoot` throws on any in-repo path) |
| No rotation, deletion, off-site, or encryption | Absent by construction |
| Pending migration not auto-applied; command documented | 7 (Step 1 prints it), 8 |
| No merge, no prod migration, no remote mutation | No task performs any |

**Open risk carried into execution:** Task 7 Phase C drops and recreates the local `postgres` database via `template1` with `WITH (FORCE)`. If the Supabase stack's services hold connections that block it, the fallback is `supabase stop && supabase start` before re-running. This is verified for real in Task 8 Step 2 — it is the one step of the plan that cannot be proven by unit tests.
