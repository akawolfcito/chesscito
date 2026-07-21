import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The analytics cron migration used to hard-depend on pg_cron, which is
 * enabled on the production project through Supabase and cannot be created by
 * a migration — the local runner connects as `postgres`, which is neither a
 * superuser nor a member of `supabase_admin`.
 *
 * The practical cost was that `supabase start` died at migration 6 of 29 on
 * any clean machine, so nobody could stand the project up locally. These tests
 * pin the guard that fixed it, and pin the shape of the guard: precise enough
 * that a real scheduling failure still surfaces.
 */

const MIGRATION = path.resolve(
  __dirname,
  "../../../supabase/migrations/20260424050843_schedule_analytics_cron.sql",
);

const sql = fs.readFileSync(MIGRATION, "utf8");

/** The executable statements only. Prose that happens to name a forbidden
 *  construct — the header explaining why there is no catch-all, for one — is
 *  documentation, not behaviour, and must not be matched as if it were. */
const code = sql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("analytics cron migration", () => {
  it("guards on the exact cron.schedule signature it calls", () => {
    // Checking for the schema, or for any cron.schedule overload, would let a
    // signature mismatch through and fail at PERFORM time instead.
    expect(code).toMatch(/to_regprocedure\(\s*'cron\.schedule\(text,\s*text,\s*text\)'\s*\)/i);
  });

  it("skips scheduling instead of failing when pg_cron is absent", () => {
    expect(code).toMatch(/raise notice/i);
    expect(code).toMatch(/\breturn\s*;/i);
  });

  it("never swallows errors with a catch-all", () => {
    // The whole point of the guard is that once cron.schedule exists, a failed
    // schedule is a real failure. `exception when others then null` would put
    // that back — silently, and exactly where it did the most damage before.
    expect(code).not.toMatch(/exception\s+when\s+others/i);
  });

  it("keeps the job name, schedule and command untouched", () => {
    expect(code).toContain("prune_analytics_events_monthly");
    expect(code).toContain("0 3 1 * *");
    expect(code).toContain("select prune_analytics_events();");
  });

  it("checks cron.job before unscheduling rather than catching the failure", () => {
    expect(code).toMatch(/from\s+cron\.job\s+where\s+jobname\s*=/i);
  });

  it("records that pg_cron is a production capability, not a migration's job", () => {
    // Without this note the next reader re-adds `create extension pg_cron` and
    // rediscovers the permission error the hard way.
    expect(sql).toMatch(/superuser/i);
    expect(sql).toMatch(/Supabase/);
  });
});

describe("migration ordering", () => {
  it("still runs after the function it schedules is defined", () => {
    const dir = path.dirname(MIGRATION);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql"));
    const cleanup = files.find((f) => f.includes("analytics_cleanup"));
    const cron = path.basename(MIGRATION);
    expect(cleanup).toBeDefined();
    // prune_analytics_events() is created by the cleanup migration; scheduling
    // it earlier would schedule a call to a function that does not exist yet.
    expect(cleanup!.localeCompare(cron)).toBeLessThan(0);
  });
});
