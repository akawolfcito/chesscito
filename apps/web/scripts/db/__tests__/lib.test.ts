import { describe, expect, it } from "vitest";

import {
  COPY_PARSED_DUMPS,
  CRITICAL_TABLES,
  DUMP_ARGS,
  DUMP_FILES,
  MANIFEST_VERSION,
  type BackupManifest,
  parseManifest,
  type RestoreObservation,
  assertLocalTarget,
  countCopyRows,
  evaluatePostRestore,
  formatBackupStamp,
  parseAppliedMigrationVersions,
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

describe("assertLocalTarget", () => {
  const LOCAL = "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

  it("accepts the local stack on 127.0.0.1 and on localhost", () => {
    expect(() => assertLocalTarget(LOCAL, "supabase_db_web")).not.toThrow();
    expect(() =>
      assertLocalTarget(
        "postgresql://postgres:postgres@localhost:55322/postgres",
        "supabase_db_web",
      ),
    ).not.toThrow();
  });

  // Everything below is the point of the function. restore-local DROPs the
  // database it is handed; each of these, if allowed through, destroys data
  // that has no backup other than the one being restored.

  it("rejects a Supabase-hosted host", () => {
    expect(() =>
      assertLocalTarget(
        "postgresql://postgres:pw@db.example-ref.supabase.co:5432/postgres",
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

/** Shape of a real `supabase db dump --data-only --use-copy` file: quoted
 *  identifiers, a column list, tab-separated rows, a lone backslash-dot. */
const DATA_SQL = [
  "SET statement_timeout = 0;",
  "--",
  "-- Data for Name: peones_ledger; Type: TABLE DATA; Schema: public",
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
    const result = evaluatePostRestore({ ...good, latestMigration: "20260406000000" }, manifest);
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

describe("constants", () => {
  it("names the three tables the post-restore check cares about", () => {
    expect(CRITICAL_TABLES).toEqual([
      "public.peones_ledger",
      "public.treasury_payment_intents",
      "public.treasury_payment_consumptions",
    ]);
  });

  it("asks for COPY on every dump whose contents get parsed back", () => {
    // The bug this pins: migration_history.sql was dumped without --use-copy,
    // so the CLI passed --column-inserts and the file came back as INSERTs.
    // parseAppliedMigrationVersions reads COPY blocks only, found none, and the
    // backup aborted. The fixtures could not catch it — they were hand-written
    // COPY blocks describing a format the script never requested.
    for (const name of COPY_PARSED_DUMPS) {
      expect(DUMP_ARGS[name]).toContain("--use-copy");
    }
  });

  it("does not ask for COPY on dumps that carry no table data", () => {
    // --use-copy is meaningless without --data-only, and passing it here would
    // only obscure which dumps the parsers actually depend on.
    expect(DUMP_ARGS["roles.sql"]).not.toContain("--use-copy");
    expect(DUMP_ARGS["schema.sql"]).not.toContain("--use-copy");
  });

  it("scopes the migration history dump to the supabase_migrations schema", () => {
    expect(DUMP_ARGS["migration_history.sql"]).toContain("supabase_migrations");
  });

  it("lists the four dumps, migration history included", () => {
    // migration_history.sql is the one that makes `supabase migration up` apply
    // only the pending migration instead of all 29.
    expect(DUMP_FILES).toContain("migration_history.sql");
    expect(DUMP_FILES).toHaveLength(4);
  });
});
