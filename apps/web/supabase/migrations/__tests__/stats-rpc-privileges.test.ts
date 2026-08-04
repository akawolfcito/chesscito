import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  ACCESS_FUNNEL,
  ACTIVATION_FUNNEL,
  CANONICAL_EVENTS,
  ACCESS_EVENTS,
  ACCESS_FAILURE_EVENT,
} from "../../../src/lib/analytics/canonical-events";

/**
 * Phase A guard — the migration TEXT.
 *
 * Plan: docs/plans/2026-08-04-stats-consolidation-execution-plan.md
 *
 * ⛔ WHAT THIS FILE CANNOT PROVE. There is no live database in the suite, so
 * every assertion here is about the statement, never about the effective
 * privilege. A migration that revokes from PUBLIC only passes every test below
 * while `has_function_privilege('anon', …, 'EXECUTE')` still returns TRUE —
 * that exact combination shipped once. The proof lives in
 * `scripts/ops/verify-stats-rpcs.ts`, which asks the database.
 *
 * What this file DOES prove is that the statements are present and complete:
 * the three revokes are three separate lines, so a missing role shows up as a
 * missing line rather than as a subtly short list.
 */

const MIGRATION_PATH =
  "supabase/migrations/20260805000000_stats_aggregation_rpcs.sql";

const migration = fs.readFileSync(
  path.resolve(process.cwd(), MIGRATION_PATH),
  "utf8",
);

/** The eight, in the order the plan lists them. */
const FUNCTIONS = [
  "stats_install_counts",
  "stats_activation_funnel",
  "stats_access_funnel",
  "stats_top_countries",
  "stats_retention",
  "stats_account_lifecycle",
  "stats_habit_depth",
  "stats_activity_trend",
] as const;

/** Comments legitimately discuss the very things some assertions forbid (the
 *  header explains why `visit_id` is unusable, names `account_ref`, quotes the
 *  failed revoke). Claims about the STATEMENTS run against this. */
const ddl = migration.replace(/--[^\n]*/g, "");

/** The body of one `create or replace function` block, header included. */
function bodyOf(name: string): string {
  const start = ddl.indexOf(`create or replace function public.${name}(`);
  expect(start, `${name} not found`).toBeGreaterThanOrEqual(0);
  const end = ddl.indexOf("$$;", start);
  expect(end, `${name} has no terminator`).toBeGreaterThan(start);
  return ddl.slice(start, end + 3);
}

describe("stats aggregation RPCs — catalog", () => {
  it("declares exactly the eight functions the plan names", () => {
    for (const name of FUNCTIONS) {
      expect(ddl).toContain(`create or replace function public.${name}(`);
    }
    const declared = [...ddl.matchAll(/create or replace function public\.(\w+)\(/g)]
      .map((m) => m[1]!)
      .sort();
    expect(declared).toEqual([...FUNCTIONS].sort());
  });

  it("gives every function the same two optional filter parameters", () => {
    for (const name of FUNCTIONS) {
      const body = bodyOf(name);
      expect(body, name).toMatch(/p_surface\s+text\s+default\s+null/);
      expect(body, name).toMatch(/p_container\s+text\s+default\s+null/);
    }
  });

  it("makes every function SECURITY DEFINER with a pinned search_path", () => {
    for (const name of FUNCTIONS) {
      const body = bodyOf(name);
      expect(body, name).toMatch(/\bsecurity definer\b/);
      // EXACTLY `public` — not `public, extensions`, not anything wider. The
      // work_mem setting below must never be allowed to loosen this.
      expect(body, name).toMatch(/^set search_path = public$/m);
      // `stable`, never `immutable`: every one of them reads now().
      expect(body, name).toMatch(/\bstable\b/);
      expect(body, name).not.toMatch(/\bimmutable\b/);
    }
  });

  it("raises work_mem on EXACTLY the two functions with measured spills", () => {
    // §8bis of the Phase A review: three measured `external merge` spills, in
    // two functions. The mitigation is scoped to those two — a global work_mem
    // change would be a database-wide decision taken to fix two queries.
    const WITH_WORK_MEM = ["stats_top_countries", "stats_habit_depth"];
    for (const name of WITH_WORK_MEM) {
      expect(bodyOf(name), name).toMatch(/^set work_mem = '8MB'$/m);
    }
    for (const name of FUNCTIONS) {
      if (WITH_WORK_MEM.includes(name)) continue;
      expect(bodyOf(name), `${name} must NOT set work_mem`).not.toContain("work_mem");
    }
  });

  it("sets work_mem exactly twice, at exactly 8MB", () => {
    // A count, not just presence: a third function acquiring it — or a value
    // drifting to 64MB on a Micro — is the failure this pins.
    expect(ddl.match(/^set work_mem = /gm)).toHaveLength(2);
    expect(ddl.match(/^set work_mem = '8MB'$/gm)).toHaveLength(2);
  });

  it("keeps search_path pinned to exactly public on all eight", () => {
    // The work_mem lines sit directly beside the search_path lines; this is the
    // assertion that catches a careless edit widening the search_path while
    // adding or moving one.
    expect(ddl.match(/^set search_path = public$/gm)).toHaveLength(8);
    expect(ddl).not.toMatch(/set search_path = public\s*,/);
  });

  it("types every count as bigint", () => {
    for (const name of FUNCTIONS) {
      const body = bodyOf(name);
      const returns = body.slice(body.indexOf("returns table ("));
      const columns = returns.slice(0, returns.indexOf(")"));
      // No count-shaped column may be a plain `int` — a 32-bit counter on a
      // table already past 150k rows is a future silent overflow.
      expect(columns, name).not.toMatch(/\b(sessions|installs|known|cohort|returned)\s+int\b/);
    }
    expect(bodyOf("stats_install_counts")).toMatch(/sessions_7d\s+bigint/);
    expect(bodyOf("stats_activity_trend")).toMatch(/sessions\s+bigint/);
    expect(bodyOf("stats_habit_depth")).toMatch(/installs\s+bigint/);
  });

  it("returns no raw identifier from any function", () => {
    for (const name of FUNCTIONS) {
      const body = bodyOf(name);
      const returns = body.slice(body.indexOf("returns table ("));
      const columns = returns.slice(0, returns.indexOf(")"));
      for (const forbidden of ["session_id", "account_ref", "wallet", "visit_id", "player"]) {
        expect(columns, `${name} returns ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});

describe("stats aggregation RPCs — filters and null handling", () => {
  it("treats a null filter as 'no filter' in every function", () => {
    for (const name of FUNCTIONS) {
      const body = bodyOf(name);
      expect(body, name).toMatch(/p_surface\s+is null\s+or\s+\w+\.(surface|first_surface)\s+= p_surface/);
      expect(body, name).toMatch(/p_container\s+is null\s+or\s+\w+\.(container|first_container)\s+= p_container/);
    }
  });

  it("never compares a filter against the sentinel string 'all'", () => {
    // `all` is the URL-level default; it reaches SQL as NULL. A literal 'all'
    // inside a column comparison would be a sentinel a real dimension could
    // one day collide with.
    expect(ddl).not.toMatch(/=\s*'all'/);
  });

  it("excludes null and empty session_id from every install-scoped read", () => {
    for (const name of FUNCTIONS) {
      if (name === "stats_account_lifecycle") continue; // account-scoped, below
      const body = bodyOf(name);
      expect(body, name).toMatch(/session_id is not null/);
      expect(body, name).toMatch(/session_id <> ''/);
    }
  });

  it("excludes null and empty account_ref from the account partition", () => {
    const body = bodyOf("stats_account_lifecycle");
    expect(body.match(/account_ref is not null/g)).toHaveLength(2); // denominator + activity
    expect(body.match(/account_ref <> ''/g)).toHaveLength(2);
  });
});

describe("stats aggregation RPCs — invariants, as far as text can carry them", () => {
  it("scopes activation to the app_opened cohort AND prefix-nests the steps", () => {
    const body = bodyOf("stats_activation_funnel");
    // The cohort gate: nothing outside `app_opened` reaches any step.
    expect(body).toMatch(/cohort as \(\s*select \* from per_install where s1\s*\)/);
    // Nesting: each step carries every predicate above it, so `sessions` is
    // non-increasing as an algebraic property rather than a hope about data.
    expect(body).toContain("where c.s2 and c.s3 and c.s4 and c.s5");
    expect(body).toContain("where c.s2 and c.s3 and c.s4)");
    expect(body).toContain("where c.s2 and c.s3)");
  });

  it("names the five activation steps exactly as the canonical vocabulary does", () => {
    const body = bodyOf("stats_activation_funnel");
    for (const step of ACTIVATION_FUNNEL) {
      expect(body, step).toContain(`'${step}'`);
    }
    // Every alias the TS module maps must be readable by the SQL, or the two
    // funnels silently disagree about what "hub viewed" means.
    for (const alias of Object.values(CANONICAL_EVENTS).flat()) {
      expect(body, alias).toContain(`'${alias}'`);
    }
  });

  it("keeps the access funnel scoped to the gate cohort, and its aliases", () => {
    const body = bodyOf("stats_access_funnel");
    expect(body).toMatch(/cohort as \(\s*select \* from per_install where gate\s*\)/);
    for (const step of ACCESS_FUNNEL) {
      expect(body, step).toContain(`'${step}'`);
    }
    for (const alias of Object.values(ACCESS_EVENTS).flat()) {
      expect(body, alias).toContain(`'${alias}'`);
    }
    expect(body).toContain(`'${ACCESS_FAILURE_EVENT}'`);
    expect(body).toMatch(/failed_sessions\s+bigint/);
  });

  it("partitions the account lifecycle into three exhaustive, exclusive bands", () => {
    const body = bodyOf("stats_account_lifecycle");
    // EXACT ROLLING windows over last_seen — never calendar-day ages. A card
    // labelled "Active (7d)" must not be counting eight days.
    expect(body).toMatch(/last_seen >= c\.t - interval '7 days'/);
    expect(body).toMatch(
      /last_seen >= c\.t - interval '30 days'\s*\n\s*and j\.last_seen\s+<\s+c\.t - interval '7 days'/,
    );
    // The third branch absorbs BOTH "never seen" and "older than the window",
    // or the three do not sum to `known`.
    expect(body).toMatch(
      /last_seen is null\s*\n\s*or j\.last_seen < c\.t - interval '30 days'/,
    );
    // No calendar-day arithmetic survives anywhere in the bands.
    expect(body).not.toContain("last_age");
    expect(body).not.toMatch(/between 8 and 29/);
    // resurrected is a subset of active, never a fourth bucket.
    expect(body).toMatch(/resurrected_7d/);
  });

  it("reads the evaluation instant exactly once, from a clock CTE", () => {
    const body = bodyOf("stats_account_lifecycle");
    expect(body).toMatch(/with clock as \(/);
    expect(body).toMatch(/select now\(\) as t/);
    // Exactly ONE now() in the whole function: every edge is measured from the
    // same instant, structurally, not by trusting statement-level stability.
    expect(body.match(/now\(\)/g)).toHaveLength(1);
    // …and every band reads it through `c.t`.
    expect(body.match(/c\.t - interval/g)!.length).toBeGreaterThanOrEqual(6);
  });

  it("uses half-open, interlocking band edges so no account lands in two", () => {
    const body = bodyOf("stats_account_lifecycle");
    // `>=` on the lower edge and `<` on the upper. An event exactly on
    // t - 7 days is ACTIVE; one microsecond earlier is DORMANT.
    expect(body).toMatch(/>= c\.t - interval '7 days'/);
    expect(body).toMatch(/<\s+c\.t - interval '7 days'/);
    expect(body).toMatch(/>= c\.t - interval '30 days'/);
    expect(body).toMatch(/< c\.t - interval '30 days'/);
  });

  it("uses the UTC calendar day for new_today and a rolling window for new_7d", () => {
    const body = bodyOf("stats_account_lifecycle");
    expect(body).toMatch(
      /date_trunc\('day', c\.t at time zone 'utc'\)\s*at time zone 'utc'/,
    );
    expect(body).toMatch(/first_seen >= c\.t - interval '7 days'/);
  });

  it("returns all three retention buckets even when a cohort is empty", () => {
    const body = bodyOf("stats_retention");
    for (const bucket of ["d1", "d7", "week3"]) {
      expect(body, bucket).toContain(`'${bucket}'`);
    }
    // A LEFT JOIN is what keeps an empty cohort as a zero row instead of a
    // vanished one; an inner join makes "not computed" and "nobody" identical.
    expect(body).toMatch(/left join fs/);
    expect(body).toMatch(/returned\s+bigint/);
    expect(body).toMatch(/cohort\s+bigint/);
    // week3 is a WINDOW (15..21), d1/d7 are exact days.
    expect(body).toMatch(/\(3, 'week3', 15, 21, 21, 28\)/);
    expect(body).toMatch(/\(1, 'd1',\s+1, 1,\s+1,\s+8\)/);
  });

  it("builds the trend spine from generate_series, so it is exactly 30 dense rows", () => {
    const body = bodyOf("stats_activity_trend");
    expect(body).toMatch(/generate_series\(/);
    expect(body).toMatch(/::date - 29/);
    expect(body).toMatch(/interval '1 day'/);
    // Derived from the same active set, so the two series always add up.
    expect(body).toMatch(/count\(a\.session_id\)\s*\n?\s*- count\(a\.session_id\) filter/);
    expect(body).toMatch(/order by d\.day/);
  });

  it("does NOT filter the birthday lookup in the trend", () => {
    const body = bodyOf("stats_activity_trend");
    const born = body.slice(body.indexOf("born as ("), body.indexOf("select d.day"));
    // Filtering it would recount an install born under another surface as new
    // — the shape of the defect that published "100% new, 0% returning".
    expect(born).not.toContain("first_surface");
    expect(born).not.toContain("first_container");
  });

  it("filters the retention cohort, which is a cohort and not a lookup", () => {
    const body = bodyOf("stats_retention");
    expect(body).toContain("f.first_surface   = p_surface");
    expect(body).toContain("f.first_container = p_container");
  });

  it("caps top countries at 8, orders them totally, and drops null country", () => {
    const body = bodyOf("stats_top_countries");
    expect(body).toMatch(/limit 8/);
    expect(body).toMatch(/order by sessions desc, e\.country asc/);
    expect(body).toMatch(/country is not null/);
    expect(body).toMatch(/country <> ''/);
  });

  it("keeps the habit bands cumulative and the median a real observation", () => {
    const body = bodyOf("stats_habit_depth");
    expect(body).toMatch(/active_days >= t\.min_days/);
    expect(body).toMatch(/percentile_disc\(0\.5\)/);
    expect(body).toMatch(/values \(1, 1\), \(2, 3\), \(3, 7\), \(4, 14\), \(5, 21\)/);
    expect(body).toMatch(/median_active_days\s+int/);
  });
});

describe("stats aggregation RPCs — privileges", () => {
  it("revokes EXECUTE from all THREE roles, on its own line, for each function", () => {
    for (const name of FUNCTIONS) {
      for (const role of ["public", "anon", "authenticated"]) {
        expect(
          ddl,
          `${name} is missing: revoke … from ${role}`,
        ).toContain(
          `revoke execute on function public.${name}(text, text) from ${role};`,
        );
      }
    }
  });

  it("revokes exactly 24 times — three roles times eight functions", () => {
    // A count, not just a presence check: a copy-pasted block that repeats one
    // function's revokes and drops another's satisfies every `toContain` above.
    expect(ddl.match(/^revoke execute on function/gm)).toHaveLength(24);
  });

  it("names service_role as the only intended reader", () => {
    for (const name of FUNCTIONS) {
      expect(ddl, name).toContain(
        `grant  execute on function public.${name}(text, text) to service_role;`,
      );
    }
    expect(ddl.match(/^grant\s+execute on function/gm)).toHaveLength(8);
    // Nothing is granted back to the two roles the revokes just cleared.
    expect(ddl).not.toMatch(/grant[\s\S]{0,80}\bto (anon|authenticated)\b/);
  });

  it("says out loud that the statements are not the proof", () => {
    // The lesson that cost a live investigation: a text guard — including this
    // very file — passes green with the function exposed.
    expect(migration).toContain("has_function_privilege");
    expect(migration).toContain("scripts/ops/verify-stats-rpcs.ts");
  });
});

describe("stats aggregation RPCs — rollback", () => {
  it("documents a drop for every one of the eight", () => {
    for (const name of FUNCTIONS) {
      expect(migration, name).toContain(
        `drop function if exists public.${name}(text, text);`,
      );
    }
  });

  it("states that the zero-cost rollback window closes at Phase C", () => {
    expect(migration).toMatch(/no longer free/i);
  });
});

describe("stats aggregation RPCs — blast radius", () => {
  it("creates no table, no column, no index and no trigger", () => {
    // Phase A is functions only. Anything else here would make the rollback
    // something other than `drop function`.
    expect(ddl).not.toMatch(/\bcreate table\b/i);
    expect(ddl).not.toMatch(/\balter table\b/i);
    expect(ddl).not.toMatch(/\bcreate index\b/i);
    expect(ddl).not.toMatch(/\bcreate trigger\b/i);
    expect(ddl).not.toMatch(/\bdrop table\b/i);
    expect(ddl).not.toMatch(/\binsert into\b/i);
    expect(ddl).not.toMatch(/\bupdate\s+public\./i);
    expect(ddl).not.toMatch(/\bdelete from\b/i);
  });

  it("touches only the three telemetry relations", () => {
    const relations = [...ddl.matchAll(/from public\.(\w+)/g)].map((m) => m[1]!);
    expect([...new Set(relations)].sort()).toEqual([
      "account_first_seen",
      "analytics_events",
      "session_first_seen",
    ]);
  });

  it("never reads visit_id, which is both coarser than session_id and 15.5% null", () => {
    expect(ddl).not.toContain("visit_id");
  });
});
