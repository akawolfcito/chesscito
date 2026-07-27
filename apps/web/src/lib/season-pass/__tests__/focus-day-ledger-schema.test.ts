import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Spec: docs/specs/2026-07-27-focus-days-ledger.md (APPROVED).
 *  No live DB in the suite, so the schema contract is asserted against the
 *  migration text — same pattern as get-peones-canary-schema.test.ts. */
const migration = fs.readFileSync(
  path.resolve(process.cwd(), "supabase/migrations/20260728000000_focus_day_ledger.sql"),
  "utf8",
);

describe("focus_day_ledger schema", () => {
  it("keys progress by wallet, season and UTC date", () => {
    expect(migration).toContain("focus_day_ledger");
    expect(migration).toMatch(/unique\s*\(wallet,\s*season_id,\s*date_utc\)/i);
  });

  it("constrains source to the three declared provenances (AC11)", () => {
    expect(migration).toMatch(
      /check\s*\(\s*source\s+in\s*\(\s*'daily',\s*'daily_retry',\s*'backfill_streak'\s*\)\s*\)/i,
    );
  });

  it("indexes the read path the Hub hits on every load", () => {
    expect(migration).toMatch(/create index[\s\S]*on focus_day_ledger\(wallet, season_id\)/i);
  });

  it("latches the backfill in its own table, so a legitimate zero seed still counts", () => {
    expect(migration).toContain("focus_ledger_init");
    expect(migration).toMatch(/primary key\s*\(wallet,\s*season_id\)/i);
    expect(migration).toMatch(/seeded_rows\s+int\s+not null/i);
  });

  it("enables RLS on both tables and denies anon/authenticated (AC21)", () => {
    expect(migration).toMatch(/alter table focus_day_ledger\s+enable row level security/i);
    expect(migration).toMatch(/alter table focus_ledger_init\s+enable row level security/i);
    expect(migration.match(/to anon, authenticated/gi)).toHaveLength(2);
    expect(migration.match(/using \(false\)/gi)).toHaveLength(2);
  });

  it("stores no identity beyond the wallet", () => {
    // Comments stripped first: the claim is about COLUMNS, and the design notes
    // legitimately name the PII this table refuses to hold.
    const ddl = migration.replace(/--.*$/gm, "");
    expect(ddl).not.toMatch(/\b(email|ip_address|device_id|username|display_name)\b/i);
    expect(ddl).toContain("wallet");
  });
});
