/**
 * The guard is the only thing between a monitor and a production accident, so
 * it is tested in both directions: it must refuse writes, AND it must accept
 * the monitor's real queries — several of which contain substrings that a naive
 * keyword scan would flag.
 */

import { describe, expect, it } from "vitest";

import {
  UnsafeSqlError,
  assertReadOnlySql,
  isReadOnlySql,
} from "../lib/read-only-guard";
import { SUPABASE_SNAPSHOT_SQL } from "../collectors/supabase";

describe("rejects writes", () => {
  const writes = [
    "delete from analytics_events where created_at < now()",
    "DELETE FROM analytics_events",
    "insert into analytics_events (event) values ('x')",
    "update analytics_events set event = 'x'",
    "drop table analytics_events",
    "alter table analytics_events add column x text",
    "truncate analytics_events",
    "vacuum full analytics_events",
    "reindex table analytics_events",
    "create index foo on analytics_events (event)",
    "grant all on analytics_events to anon",
    "revoke all on analytics_events from anon",
  ];

  for (const sql of writes) {
    it(`rejects: ${sql.slice(0, 46)}`, () => {
      expect(() => assertReadOnlySql(sql)).toThrow(UnsafeSqlError);
    });
  }
});

describe("rejects smuggled statements", () => {
  it("rejects a write appended after a legitimate select", () => {
    expect(() =>
      assertReadOnlySql("select 1; delete from analytics_events"),
    ).toThrow(/multiple-statements/);
  });

  it("rejects a write hidden behind a comment", () => {
    // Stripping the comment must EXPOSE the delete, not hide it.
    expect(() =>
      assertReadOnlySql("select 1 -- harmless\n; delete from analytics_events"),
    ).toThrow(UnsafeSqlError);
  });

  it("rejects pg_stat_reset — underscores dodge the word-boundary rule", () => {
    expect(() => assertReadOnlySql("select pg_stat_reset()")).toThrow(
      /forbidden-function/,
    );
  });

  it("rejects other side-effecting functions", () => {
    for (const sql of [
      "select pg_terminate_backend(123)",
      "select pg_stat_statements_reset()",
      "select pg_read_file('/etc/passwd')",
      "select pg_sleep(60)",
    ]) {
      expect(() => assertReadOnlySql(sql), sql).toThrow(/forbidden-function/);
    }
  });

  it("rejects anything that is not a SELECT or WITH", () => {
    expect(() => assertReadOnlySql("explain analyze select 1")).toThrow(
      /not-a-select/,
    );
    expect(() => assertReadOnlySql("")).toThrow(/empty/);
  });
});

describe("accepts the monitor's real queries — no false positives", () => {
  it("accepts the full Supabase snapshot query", () => {
    // The regression this whole test file exists for: the real query mentions
    // created_at, last_autovacuum and last_analyze, and must still pass.
    expect(() => assertReadOnlySql(SUPABASE_SNAPSHOT_SQL)).not.toThrow();
  });

  it("`created_at` does not read as CREATE", () => {
    expect(isReadOnlySql("select created_at from analytics_events")).toBe(true);
  });

  it("`last_autovacuum` does not read as VACUUM", () => {
    // `\b` treats `_` as a word character, so `\bvacuum\b` cannot match inside
    // `last_autovacuum`. If someone loosens that regex, this test fails.
    expect(
      isReadOnlySql("select last_autovacuum, last_analyze from pg_stat_user_tables"),
    ).toBe(true);
  });

  it("`updated_at` does not read as UPDATE", () => {
    expect(isReadOnlySql("select updated_at from t")).toBe(true);
  });

  it("accepts a CTE, which the collector relies on", () => {
    expect(isReadOnlySql("with x as (select 1) select * from x")).toBe(true);
  });

  it("accepts a trailing semicolon and surrounding whitespace", () => {
    expect(isReadOnlySql("  select 1;  ")).toBe(true);
  });

  it("does not trip on a forbidden word inside a string literal", () => {
    expect(isReadOnlySql("select 'delete from x' as label")).toBe(true);
  });
});
