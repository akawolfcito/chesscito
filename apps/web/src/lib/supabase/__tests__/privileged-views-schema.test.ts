/**
 * Guard for `20260805000000_close_public_access_to_privileged_views.sql`
 * (production audit P0, 2026-08-05).
 *
 * WHAT THIS TEST CAN AND CANNOT PROVE. It reads the migration text, so it
 * proves the statements were written and never removed. It CANNOT prove the
 * effective privilege in a live database — that is why the migration itself
 * ends in a `do $$` block that raises on `has_table_privilege`, and why the
 * handoff leaves the prod probe explicitly pending. "The view no longer
 * appears in the UI" is not evidence of anything here; neither is this file.
 *
 * The defect being guarded: a Postgres view does not inherit RLS from its
 * base table. Without `security_invoker = true` these three ran as their
 * owner and read straight past `peones_ledger_own_reads`, while Supabase's
 * default privileges handed anon an explicit SELECT grant.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");
/**
 * ⚠️ The version prefix must be UNIQUE across the whole migration set. Supabase
 * tracks migrations by VERSION, not by filename, so a second file sharing a
 * prefix is not a cosmetic clash: `supabase db push --dry-run` resolved
 * `20260805000000` to `..._stats_aggregation_rpcs.sql` and silently omitted
 * this migration from the push plan. The P0 would have stayed open while the
 * command reported success. Renamed 20260805000000 -> 20260805010000.
 */
const MIGRATION = "20260805010000_close_public_access_to_privileged_views.sql";

const VIEWS = [
  "public.peones_balances",
  "public.leaderboard_full_v",
  "public.leaderboard_combined_v",
] as const;

const code = () => readFileSync(join(MIGRATIONS, MIGRATION), "utf8");

const escape = (name: string) => name.replace(/\./g, "\\.");

describe("privileged views migration — the two required statements", () => {
  it.each(VIEWS)("sets security_invoker on %s", (view) => {
    expect(code()).toMatch(
      new RegExp(`alter view ${escape(view)}\\s+set \\(security_invoker = true\\)`, "i"),
    );
  });

  it.each(VIEWS)("revokes select on %s from every client role", (view) => {
    // Revoking from PUBLIC alone is useless: Supabase's default privileges
    // ALSO grant explicitly to anon/authenticated, and a revoke from PUBLIC
    // does not touch those. Revoking from the two roles alone is equally
    // useless — they still hold it through PUBLIC.
    expect(code()).toMatch(
      new RegExp(
        `revoke select on ${escape(view)}\\s+from public, anon, authenticated`,
        "i",
      ),
    );
  });

  it.each(VIEWS)("keeps service_role's select on %s", (view) => {
    // Every consumer is server-side and holds the service role. Revoking
    // this would take Leaders and the Peones HUD chip down.
    expect(code()).toMatch(
      new RegExp(`grant select on ${escape(view)}\\s+to service_role`, "i"),
    );
  });
});

describe("privileged views migration — asserts its own outcome", () => {
  it("verifies effective privileges in-database, not just the statements", () => {
    const src = code();
    expect(src).toMatch(/has_table_privilege\(v_role, v_rel, 'select'\)/i);
    expect(src).toMatch(/has_table_privilege\('service_role', v_rel, 'select'\)/i);
    expect(src).toMatch(/reloptions @> array\['security_invoker=true'\]/i);
    expect(src).toMatch(/raise exception/i);
  });

  it("documents an explicit rollback", () => {
    expect(code()).toMatch(/security_invoker = false/i);
    expect(code()).toMatch(/grant select on public\.peones_balances\s+to anon, authenticated/i);
  });
});

describe("privileged views migration — additive only", () => {
  it("touches no table, no policy and no row", () => {
    const src = code();
    // Everything below `-- 5. Rollback` is commented out; the guard must not
    // read the rollback recipe as if it were executable.
    const executable = src.split(/^-- 5\. Rollback/m)[0];
    expect(executable).not.toMatch(/^\s*(alter|create|drop) table/im);
    expect(executable).not.toMatch(/^\s*(create|drop|alter) policy/im);
    expect(executable).not.toMatch(/^\s*(insert|update|delete) /im);
    expect(executable).not.toMatch(/^\s*(create|drop) (or replace )?view/im);
  });
});

describe("migration versions are unique", () => {
  /**
   * Caught in production prep, not in review: this migration originally shipped
   * as 20260805000000, colliding with `..._stats_aggregation_rpcs.sql`.
   * Supabase keys migrations on the VERSION prefix, so `db push --dry-run`
   * resolved the version to the stats file and dropped this one from the plan
   * entirely — it would have reported success while leaving anon's SELECT on
   * three views untouched. A duplicate prefix is a silent no-op, not a
   * cosmetic problem, so it is asserted for the whole set rather than for the
   * one file this suite owns.
   */
  it("no two migrations share a version prefix", () => {
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    const byVersion = new Map<string, string[]>();
    for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"))) {
      const version = file.slice(0, file.indexOf("_"));
      byVersion.set(version, [...(byVersion.get(version) ?? []), file]);
    }
    const collisions = [...byVersion.entries()].filter(([, files]) => files.length > 1);
    expect(collisions).toEqual([]);
  });
});

describe("view inventory — no fourth view left open", () => {
  /**
   * The audit is closed only if these are ALL the views. A view added later
   * without the two statements re-opens the same hole, and nothing else in
   * the suite would notice.
   */
  it("every view in the migration set is either closed here or already closed", () => {
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    const created = new Set<string>();
    for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"))) {
      const src = readFileSync(join(MIGRATIONS, file), "utf8");
      for (const m of src.matchAll(
        /create\s+(?:or\s+replace\s+)?view\s+(public\.[a-z0-9_]+)/gi,
      )) {
        created.add(m[1].toLowerCase());
      }
    }

    // `leaderboard_weekly_full_v` shipped correct in 20260801000000 — it is
    // the pattern this migration copies, not an omission.
    const closedElsewhere = new Set(["public.leaderboard_weekly_full_v"]);
    const accounted = new Set<string>([...VIEWS, ...closedElsewhere]);

    expect([...created].filter((v) => !accounted.has(v))).toEqual([]);
  });
});
