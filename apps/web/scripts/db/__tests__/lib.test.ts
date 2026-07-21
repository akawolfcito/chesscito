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
