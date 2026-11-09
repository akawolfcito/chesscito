/**
 * Phase A verifier — the eight /stats RPCs, checked against the REAL database.
 *
 * Plan:  docs/plans/2026-08-04-stats-consolidation-execution-plan.md (Phase A)
 * Audit: docs/audits/2026-08-04-public-stats-accuracy-audit.md (§6, §13, §22)
 *
 * ⛔ WHY THIS EXISTS AT ALL
 * ------------------------
 * `supabase/migrations/__tests__/stats-rpc-privileges.test.ts` reads the
 * migration text. It cannot see an effective privilege. A migration that
 * revoked from PUBLIC only passed every text assertion while
 * `has_function_privilege('anon', …, 'EXECUTE')` still returned TRUE, because
 * Supabase's default privileges hand anon and authenticated their own EXPLICIT
 * grant. Only the database can answer that question, so this file asks it.
 *
 * It checks six things:
 *   1. the eight functions exist, with the (text, text) signature;
 *   2. each is SECURITY DEFINER with search_path pinned to public;
 *   3. `proacl` and `has_function_privilege` agree that public, anon and
 *      authenticated hold NO execute on any of them;
 *   4. parity — every RPC against a hand-written reference query over the same
 *      window and the same filters;
 *   5. the invariants: activation monotone, lifecycle partition closed,
 *      retention buckets present, trend exactly 30 dense rows, countries capped
 *      and ordered;
 *   6. the whole 3x3 filter grid: surface all/learn/play x container
 *      all/minipay/browser.
 *
 * ── READ-ONLY, AND HOW THAT IS ENFORCED ──────────────────────────────────
 *
 * Every statement goes through `assertReadOnlySql` — the monitor's guard, which
 * allows exactly one statement, requires it to start with SELECT or WITH, and
 * rejects any DML/DDL keyword on a word boundary. This script never applies the
 * migration: it verifies one that is already there, and exits non-zero saying
 * so if it is not.
 *
 * ── TRANSPORT ────────────────────────────────────────────────────────────
 *
 * `psql` inside a throwaway container, same as the launch monitor and for the
 * same reasons: there is no local psql, the direct DB host is IPv6-only, and
 * the session-mode pooler at `aws-1-…` is the address that resolves (`aws-0-…`
 * answers "tenant or user not found"). The connection string travels as a
 * container ENV VAR, never as an argv element — argv is visible in `ps`.
 *
 * ── WHAT IS NEVER PRINTED ────────────────────────────────────────────────
 *
 * No wallet, no `account_ref`, no `session_id`, no credential. The RPCs return
 * none of those by contract, and the reference queries return only aggregates.
 *
 * ── WHY NO PRODUCTION COUNT IS PINNED ────────────────────────────────────
 *
 * Parity compares the RPC against a reference query run in the SAME statement,
 * so both see the same instant and drift cancels. What is NEVER asserted is a
 * literal from the audit: 3,927 sessions was true at 18:15 UTC on 2026-08-04
 * and is false by dinner. A test that pins a live count fails for being alive.
 */

import { execFileSync } from "node:child_process";

import { assertReadOnlySql } from "./lib/read-only-guard";
import { loadOpsEnv, parseSupabaseRef, type OpsEnv } from "./lib/env";
import { childEnv } from "./lib/child-env";

export const POOLER_HOST = "aws-1-us-east-1.pooler.supabase.com";
export const POOLER_PORT = 5432;
export const DOCKER_PG_IMAGE = "postgres:16-alpine";
export const TIMEOUT_MS = 30_000;

/** The eight, in the order the plan lists them. */
export const STATS_RPCS = [
  "stats_install_counts",
  "stats_activation_funnel",
  "stats_access_funnel",
  "stats_top_countries",
  "stats_retention",
  "stats_account_lifecycle",
  "stats_habit_depth",
  "stats_activity_trend",
] as const;

export type StatsRpc = (typeof STATS_RPCS)[number];

/** Roles that must hold NO execute. `service_role` is the intended reader and
 *  is deliberately absent from this list. */
export const FORBIDDEN_ROLES = ["public", "anon", "authenticated"] as const;

/**
 * The ONLY two functions allowed to raise work_mem, and the exact value.
 *
 * §8bis of the Phase A review measured three `external merge` spills — two in
 * `stats_top_countries` (surface=play, container=minipay) and one in
 * `stats_habit_depth` (surface=play). The mitigation is scoped to those two.
 *
 * This is checked as a CLOSED SET in both directions: the two must have it and
 * the other six must not. A setting that quietly spreads across all eight is a
 * database-wide memory decision taken by accident, on an instance where memory
 * is the scarce resource.
 */
export const WORK_MEM_FUNCTIONS = ["stats_top_countries", "stats_habit_depth"] as const;
export const EXPECTED_WORK_MEM = "work_mem=8MB";
export const EXPECTED_SEARCH_PATH = "search_path=public";

/** The filter grid. `null` is "no filter" — the value `all` never reaches SQL. */
export const SURFACES = [null, "learn", "play"] as const;
export const CONTAINERS = [null, "minipay", "browser"] as const;

export type Filters = { surface: string | null; container: string | null };

export type Finding = {
  ok: boolean;
  check: string;
  detail: string;
};

/* ════════════════════════════════════════════════════════════════════════
   1. Catalog — existence, signature, SECURITY DEFINER, search_path
   ════════════════════════════════════════════════════════════════════════ */

/**
 * `prosecdef` is the flag, `proconfig` is where a `SET` clause on the function
 * lands (as `search_path=public`). Reading both in one row means a function
 * that is SECURITY DEFINER with an UNPINNED search_path — the actually
 * dangerous combination — is visible rather than inferred.
 */
export function buildCatalogSql(): string {
  const names = STATS_RPCS.map((n) => `'${n}'`).join(", ");
  return `
select coalesce(json_agg(row_to_json(t) order by t.name), '[]'::json) as catalog
  from (
    select p.proname                                   as name,
           pg_get_function_identity_arguments(p.oid)   as args,
           pg_get_function_result(p.oid)               as result,
           p.prosecdef                                 as security_definer,
           p.provolatile                               as volatility,
           coalesce(p.proconfig, array[]::text[])      as config,
           coalesce(p.proacl::text, '')                as acl
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (${names})
  ) t`;
}

export type CatalogRow = {
  name: string;
  args: string;
  result: string;
  security_definer: boolean;
  volatility: string;
  config: string[];
  acl: string;
};

export function checkCatalog(rows: CatalogRow[]): Finding[] {
  const findings: Finding[] = [];
  const byName = new Map(rows.map((r) => [r.name, r]));

  for (const name of STATS_RPCS) {
    const row = byName.get(name);
    if (!row) {
      findings.push({
        ok: false,
        check: `${name} · exists`,
        detail: "not found in schema public — has the migration been applied?",
      });
      continue;
    }
    findings.push({ ok: true, check: `${name} · exists`, detail: "" });

    const args = row.args.replace(/\s+/g, " ").trim().toLowerCase();
    findings.push({
      ok: args === "p_surface text, p_container text",
      check: `${name} · signature`,
      detail: args,
    });

    findings.push({
      ok: row.security_definer === true,
      check: `${name} · security definer`,
      detail: String(row.security_definer),
    });

    // `s` = stable. `i` (immutable) would be a lie: every one reads now().
    findings.push({
      ok: row.volatility === "s",
      check: `${name} · stable`,
      detail: `provolatile=${row.volatility}`,
    });

    const config = row.config ?? [];
    const searchPath = config.find((c) => c.startsWith("search_path="));
    findings.push({
      // Exact match, never `startsWith`: `search_path=public, extensions` would
      // pass a loose check and is precisely what must not slip through.
      ok: searchPath === EXPECTED_SEARCH_PATH,
      check: `${name} · search_path pinned`,
      detail: searchPath ?? "(unset — a SECURITY DEFINER function with an unpinned search_path is the dangerous combination)",
    });

    // work_mem: a closed set, checked in BOTH directions.
    const workMem = config.find((c) => c.startsWith("work_mem="));
    const shouldHave = (WORK_MEM_FUNCTIONS as readonly string[]).includes(name);
    findings.push({
      ok: shouldHave ? workMem === EXPECTED_WORK_MEM : workMem === undefined,
      check: shouldHave
        ? `${name} · work_mem raised to 8MB`
        : `${name} · work_mem NOT set`,
      detail: shouldHave
        ? (workMem ?? "(unset — the measured spill will come back)")
        : (workMem ?? ""),
    });

    // Nothing else may ride along in proconfig: a SECURITY DEFINER function
    // carrying an unreviewed GUC is a surface nobody signed off on.
    const unexpected = config.filter(
      (c) => !c.startsWith("search_path=") && !c.startsWith("work_mem="),
    );
    findings.push({
      ok: unexpected.length === 0,
      check: `${name} · no unexpected proconfig settings`,
      detail: unexpected.join(", ") || "none",
    });
  }

  // A ninth `stats_*` function would be an unreviewed SECURITY DEFINER surface.
  const unexpected = rows
    .map((r) => r.name)
    .filter((n) => !(STATS_RPCS as readonly string[]).includes(n));
  findings.push({
    ok: unexpected.length === 0,
    check: "catalog · no unexpected stats_* functions",
    detail: unexpected.join(", ") || "none",
  });

  return findings;
}

/* ════════════════════════════════════════════════════════════════════════
   2. Privileges — proacl AND has_function_privilege, both
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Two independent reads of the same fact, because they fail differently.
 *
 * `proacl` is the stored list: NULL there means "default privileges", which on
 * Supabase means anon and authenticated CAN execute — an empty-looking acl is
 * the exposed state, not the safe one.
 *
 * `has_function_privilege` is the effective answer and accounts for role
 * membership, which an acl string does not. If the two ever disagree, the
 * effective one wins and the disagreement is itself a finding.
 */
export function buildPrivilegeSql(): string {
  const rows = STATS_RPCS.flatMap((fn) =>
    FORBIDDEN_ROLES.map(
      (role) =>
        `select '${fn}'::text as fn, '${role}'::text as role,
                has_function_privilege('${role}', 'public.${fn}(text, text)', 'EXECUTE') as granted,
                coalesce((select p.proacl::text from pg_proc p
                            join pg_namespace n on n.oid = p.pronamespace
                           where n.nspname = 'public' and p.proname = '${fn}'), '') as acl`,
    ),
  ).join("\n union all ");
  return `select coalesce(json_agg(row_to_json(t)), '[]'::json) as privileges from (${rows}) t`;
}

export type PrivilegeRow = {
  fn: string;
  role: string;
  granted: boolean;
  acl: string;
};

export function checkPrivileges(rows: PrivilegeRow[]): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    seen.add(`${row.fn}:${row.role}`);
    findings.push({
      ok: row.granted === false,
      check: `${row.fn} · ${row.role} has no EXECUTE`,
      detail: row.granted
        ? `EXPOSED — has_function_privilege returned true. acl=${row.acl || "(null → Supabase defaults apply)"}`
        : "",
    });
    // An `acl` that still names the role is a revoke that did not take, even
    // when the effective check happens to pass through some other path.
    if (row.role !== "public" && row.acl.includes(`${row.role}=X`)) {
      findings.push({
        ok: false,
        check: `${row.fn} · ${row.role} absent from proacl`,
        detail: `proacl still grants EXECUTE: ${row.acl}`,
      });
    }
  }

  // A missing row is not a pass. An absent answer must never read as "safe".
  for (const fn of STATS_RPCS) {
    for (const role of FORBIDDEN_ROLES) {
      if (!seen.has(`${fn}:${role}`)) {
        findings.push({
          ok: false,
          check: `${fn} · ${role} has no EXECUTE`,
          detail: "no answer returned for this pair",
        });
      }
    }
  }

  return findings;
}

/* ════════════════════════════════════════════════════════════════════════
   3. Parity + invariants — one statement per filter combination
   ════════════════════════════════════════════════════════════════════════ */

/** A SQL literal for an optional filter. Values come from the closed lists
 *  above, never from input, but the quoting is still done in one place. */
function lit(value: string | null): string {
  if (value === null) return "null";
  if (!/^[a-z]+$/.test(value)) throw new Error(`unexpected filter value: ${value}`);
  return `'${value}'`;
}

/** The shared WHERE fragment of every reference query over analytics_events. */
function eventScope(f: Filters, since: string): string {
  return `e.created_at >= ${since}
      and e.session_id is not null
      and e.session_id <> ''
      and (${lit(f.surface)}::text is null or e.surface = ${lit(f.surface)})
      and (${lit(f.container)}::text is null or e.container = ${lit(f.container)})`;
}

/**
 * The comparison statement.
 *
 * Both sides run inside ONE statement so they observe the same instant: the
 * table takes ~2,000 new rows every 40 minutes, so two round trips would differ
 * by real traffic and every comparison would need a tolerance nobody can
 * justify. With one statement the tolerance is zero and stays zero.
 *
 * The reference side is written DIFFERENTLY on purpose — `count(distinct …)`
 * with correlated subqueries where the RPC uses `bool_or` + `filter`. Two
 * spellings of the same contract cross-check each other; a copy of the RPC's
 * own SQL would only prove the query is deterministic.
 */
export function buildComparisonSql(f: Filters): string {
  const s = lit(f.surface);
  const c = lit(f.container);
  const since30 = `now() - interval '30 days'`;
  const since7 = `now() - interval '7 days'`;

  return `
select json_build_object(
  'filters', json_build_object('surface', ${s}::text, 'container', ${c}::text),

  'install_counts_rpc', (
    select row_to_json(t) from public.stats_install_counts(${s}, ${c}) t
  ),
  'install_counts_ref', (
    select json_build_object(
      'sessions_7d', (
        select count(distinct e.session_id) from public.analytics_events e
         where ${eventScope(f, since7)}
      ),
      'sessions_30d', (
        select count(distinct e.session_id) from public.analytics_events e
         where ${eventScope(f, since30)}
      ),
      'app_opens_rows_30d', (
        select count(*) from public.analytics_events e
         where ${eventScope(f, since30)} and e.event = 'app_opened'
      ),
      'app_open_sessions_30d', (
        select count(distinct e.session_id) from public.analytics_events e
         where ${eventScope(f, since30)} and e.event = 'app_opened'
      )
    )
  ),

  'activation_rpc', (
    select coalesce(json_agg(row_to_json(t)), '[]'::json)
      from public.stats_activation_funnel(${s}, ${c}) t
  ),

  'access_rpc', (
    select coalesce(json_agg(row_to_json(t)), '[]'::json)
      from public.stats_access_funnel(${s}, ${c}) t
  ),
  'access_ref_gate', (
    select count(distinct e.session_id) from public.analytics_events e
     where ${eventScope(f, since30)} and e.event = 'web_access_gate_viewed'
  ),

  'countries_rpc', (
    select coalesce(json_agg(row_to_json(t)), '[]'::json)
      from public.stats_top_countries(${s}, ${c}) t
  ),
  'countries_ref', (
    select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
      select e.country, count(distinct e.session_id) as sessions
        from public.analytics_events e
       where ${eventScope(f, since30)}
         and e.country is not null and e.country <> ''
       group by e.country
       order by 2 desc, 1 asc
       limit 8
    ) t
  ),

  'retention_rpc', (
    select coalesce(json_agg(row_to_json(t)), '[]'::json)
      from public.stats_retention(${s}, ${c}) t
  ),
  'retention_ref', (
    select coalesce(json_agg(row_to_json(t) order by t.ord), '[]'::json) from (
      select b.ord,
             b.bucket,
             count(*) filter (
               where exists (
                 select 1
                   from public.analytics_events e
                  where e.session_id = f.session_id
                    and e.created_at >= ${since30}
                    and e.session_id is not null
                    and e.session_id <> ''
                    and (${s}::text is null or e.surface = ${s})
                    and (${c}::text is null or e.container = ${c})
                    and (e.created_at at time zone 'utc')::date
                        between (f.first_seen at time zone 'utc')::date + b.from_off
                            and (f.first_seen at time zone 'utc')::date + b.to_off
               )
             ) as returned,
             count(f.session_id) as cohort
        from (values (1,'d1',1,1,1,8),(2,'d7',7,7,7,14),(3,'week3',15,21,21,28))
             as b(ord, bucket, from_off, to_off, min_age, max_age)
        left join public.session_first_seen f
          on ((now() at time zone 'utc')::date
                - (f.first_seen at time zone 'utc')::date)
             between b.min_age and b.max_age
         and f.session_id is not null
         and f.session_id <> ''
         and (${s}::text is null or f.first_surface = ${s})
         and (${c}::text is null or f.first_container = ${c})
       group by b.ord, b.bucket
    ) t
  ),

  'lifecycle_rpc', (
    select row_to_json(t) from public.stats_account_lifecycle(${s}, ${c}) t
  ),
  'lifecycle_ref', (
    select json_build_object(
      'known', (
        select count(*) from public.account_first_seen a
         where a.account_ref is not null and a.account_ref <> ''
           and (${s}::text is null or a.first_surface = ${s})
           and (${c}::text is null or a.first_container = ${c})
      ),
      'new_today', (
        select count(*) from public.account_first_seen a
         where a.account_ref is not null and a.account_ref <> ''
           and (${s}::text is null or a.first_surface = ${s})
           and (${c}::text is null or a.first_container = ${c})
           and a.first_seen >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc')
      ),
      'new_7d', (
        select count(*) from public.account_first_seen a
         where a.account_ref is not null and a.account_ref <> ''
           and (${s}::text is null or a.first_surface = ${s})
           and (${c}::text is null or a.first_container = ${c})
           and a.first_seen >= ${since7}
      ),
      'active_7d', (
        select count(*) from public.account_first_seen a
         where a.account_ref is not null and a.account_ref <> ''
           and (${s}::text is null or a.first_surface = ${s})
           and (${c}::text is null or a.first_container = ${c})
           and exists (
             select 1 from public.analytics_events e
              where e.account_ref = a.account_ref
                and e.account_ref <> ''
                and (${s}::text is null or e.surface = ${s})
                and (${c}::text is null or e.container = ${c})
                and e.created_at >= ${since7}
           )
      ),
      'dormant', (
        select count(*) from public.account_first_seen a
         where a.account_ref is not null and a.account_ref <> ''
           and (${s}::text is null or a.first_surface = ${s})
           and (${c}::text is null or a.first_container = ${c})
           and exists (
             select 1 from public.analytics_events e
              where e.account_ref = a.account_ref
                and e.account_ref <> ''
                and (${s}::text is null or e.surface = ${s})
                and (${c}::text is null or e.container = ${c})
                and e.created_at >= ${since30}
                and e.created_at <  ${since7}
           )
           and not exists (
             select 1 from public.analytics_events e
              where e.account_ref = a.account_ref
                and e.account_ref <> ''
                and (${s}::text is null or e.surface = ${s})
                and (${c}::text is null or e.container = ${c})
                and e.created_at >= ${since7}
           )
      ),
      'inactive', (
        select count(*) from public.account_first_seen a
         where a.account_ref is not null and a.account_ref <> ''
           and (${s}::text is null or a.first_surface = ${s})
           and (${c}::text is null or a.first_container = ${c})
           and not exists (
             select 1 from public.analytics_events e
              where e.account_ref = a.account_ref
                and e.account_ref <> ''
                and (${s}::text is null or e.surface = ${s})
                and (${c}::text is null or e.container = ${c})
                and e.created_at >= ${since30}
           )
      )
    )
  ),

  'habit_rpc', (
    select coalesce(json_agg(row_to_json(t)), '[]'::json)
      from public.stats_habit_depth(${s}, ${c}) t
  ),
  'habit_ref_cohort', (
    select count(*) from (
      select e.session_id from public.analytics_events e
       where ${eventScope(f, since30)}
       group by e.session_id
    ) x
  ),

  'trend_rpc', (
    select coalesce(json_agg(row_to_json(t) order by t.day), '[]'::json)
      from public.stats_activity_trend(${s}, ${c}) t
  )
) as comparison`;
}

/* ── Pure invariant checkers ─────────────────────────────────────────────
   Separated from the transport so the suite can exercise them against
   fixtures. A checker that only ever runs against production is a checker
   nobody has tested. */

export type Comparison = {
  filters: Filters;
  install_counts_rpc: Record<string, number> | null;
  install_counts_ref: Record<string, number> | null;
  activation_rpc: Array<{ step: string; sessions: number }>;
  access_rpc: Array<{ step: string; sessions: number; failed_sessions: number }>;
  access_ref_gate: number;
  countries_rpc: Array<{ country: string; sessions: number }>;
  countries_ref: Array<{ country: string; sessions: number }>;
  retention_rpc: Array<{ bucket: string; returned: number; cohort: number }>;
  retention_ref: Array<{ bucket: string; returned: number; cohort: number }>;
  lifecycle_rpc: Record<string, number> | null;
  lifecycle_ref: Record<string, number> | null;
  habit_rpc: Array<{
    min_days: number;
    installs: number;
    cohort: number;
    median_active_days: number;
  }>;
  habit_ref_cohort: number;
  trend_rpc: Array<{
    day: string;
    sessions: number;
    new_installs: number;
    returning_installs: number;
  }>;
};

function label(f: Filters): string {
  return `surface=${f.surface ?? "all"} container=${f.container ?? "all"}`;
}

/** Every field of two objects, compared exactly. Both sides were read in the
 *  same statement, so there is no drift to tolerate and no tolerance to tune. */
export function compareParity(
  scope: string,
  rpc: Record<string, number> | null,
  ref: Record<string, number> | null,
): Finding[] {
  if (!rpc || !ref) {
    return [{ ok: false, check: `${scope} · parity`, detail: "a side came back null" }];
  }
  return Object.keys(ref).map((key) => ({
    ok: Number(rpc[key]) === Number(ref[key]),
    check: `${scope} · ${key}`,
    detail: `rpc=${rpc[key]} ref=${ref[key]}`,
  }));
}

export function checkActivationMonotone(c: Comparison): Finding[] {
  const f = label(c.filters);
  const steps = c.activation_rpc;
  const findings: Finding[] = [
    {
      ok: steps.length === 5,
      check: `${f} · activation has 5 steps`,
      detail: `${steps.length}`,
    },
  ];
  for (let i = 1; i < steps.length; i += 1) {
    const prev = steps[i - 1]!;
    const cur = steps[i]!;
    findings.push({
      ok: Number(cur.sessions) <= Number(prev.sessions),
      check: `${f} · activation ${prev.step} >= ${cur.step}`,
      detail: `${prev.sessions} -> ${cur.sessions}`,
    });
  }
  return findings;
}

export function checkAccessFunnel(c: Comparison): Finding[] {
  const f = label(c.filters);
  const steps = c.access_rpc;
  const findings: Finding[] = [
    { ok: steps.length === 5, check: `${f} · access has 5 steps`, detail: `${steps.length}` },
  ];
  const gate = steps.find((s) => s.step === "gate_viewed");
  findings.push({
    ok: gate !== undefined && Number(gate.sessions) === Number(c.access_ref_gate),
    check: `${f} · access gate cohort parity`,
    detail: `rpc=${gate?.sessions} ref=${c.access_ref_gate}`,
  });
  // Cohort-scoped, not prefix-nested: only the first step bounds the rest.
  for (const step of steps.slice(1)) {
    findings.push({
      ok: Number(step.sessions) <= Number(gate?.sessions ?? -1),
      check: `${f} · access ${step.step} within cohort`,
      detail: `${step.sessions} <= ${gate?.sessions}`,
    });
  }
  // One funnel-level counter, repeated — never five different numbers.
  const failed = new Set(steps.map((s) => Number(s.failed_sessions)));
  findings.push({
    ok: failed.size <= 1,
    check: `${f} · failed_sessions is one repeated scalar`,
    detail: [...failed].join(", "),
  });
  return findings;
}

export function checkLifecyclePartition(c: Comparison): Finding[] {
  const f = label(c.filters);
  const l = c.lifecycle_rpc;
  if (!l) {
    return [{ ok: false, check: `${f} · lifecycle`, detail: "no row returned" }];
  }
  const sum = Number(l.active_7d) + Number(l.dormant) + Number(l.inactive);
  return [
    {
      ok: sum === Number(l.known),
      check: `${f} · active + dormant + inactive = known`,
      detail: `${l.active_7d} + ${l.dormant} + ${l.inactive} = ${sum} vs known ${l.known}`,
    },
    {
      // A subset of active, never a fourth bucket.
      ok: Number(l.resurrected_7d) <= Number(l.active_7d),
      check: `${f} · resurrected_7d subset of active_7d`,
      detail: `${l.resurrected_7d} <= ${l.active_7d}`,
    },
    {
      ok: Number(l.new_today) <= Number(l.new_7d),
      check: `${f} · new_today within new_7d`,
      detail: `${l.new_today} <= ${l.new_7d}`,
    },
    {
      ok: Number(l.new_7d) <= Number(l.known),
      check: `${f} · new_7d within known`,
      detail: `${l.new_7d} <= ${l.known}`,
    },
  ];
}

export function checkRetention(c: Comparison): Finding[] {
  const f = label(c.filters);
  const buckets = c.retention_rpc.map((r) => r.bucket);
  const findings: Finding[] = [
    {
      ok: JSON.stringify(buckets) === JSON.stringify(["d1", "d7", "week3"]),
      check: `${f} · retention returns d1/d7/week3 in order`,
      detail: buckets.join(", ") || "(none)",
    },
  ];
  for (const row of c.retention_rpc) {
    findings.push({
      ok: Number(row.returned) <= Number(row.cohort),
      check: `${f} · retention ${row.bucket} returned <= cohort`,
      detail: `${row.returned} <= ${row.cohort}`,
    });
  }
  const refByBucket = new Map(c.retention_ref.map((r) => [r.bucket, r]));
  for (const row of c.retention_rpc) {
    const ref = refByBucket.get(row.bucket);
    findings.push({
      ok:
        ref !== undefined &&
        Number(ref.returned) === Number(row.returned) &&
        Number(ref.cohort) === Number(row.cohort),
      check: `${f} · retention ${row.bucket} parity`,
      detail: `rpc=${row.returned}/${row.cohort} ref=${ref?.returned}/${ref?.cohort}`,
    });
  }
  return findings;
}

export function checkTopCountries(c: Comparison): Finding[] {
  const f = label(c.filters);
  const rpc = c.countries_rpc;
  const findings: Finding[] = [
    { ok: rpc.length <= 8, check: `${f} · countries capped at 8`, detail: `${rpc.length}` },
    {
      ok: rpc.every((r) => r.country !== null && r.country !== ""),
      check: `${f} · countries exclude null`,
      detail: rpc.map((r) => r.country).join(" "),
    },
  ];
  for (let i = 1; i < rpc.length; i += 1) {
    const prev = rpc[i - 1]!;
    const cur = rpc[i]!;
    const ordered =
      Number(cur.sessions) < Number(prev.sessions) ||
      (Number(cur.sessions) === Number(prev.sessions) && cur.country > prev.country);
    findings.push({
      ok: ordered,
      check: `${f} · countries order is total at ${i}`,
      detail: `${prev.country}:${prev.sessions} then ${cur.country}:${cur.sessions}`,
    });
  }
  findings.push({
    ok:
      JSON.stringify(rpc.map((r) => [r.country, Number(r.sessions)])) ===
      JSON.stringify(c.countries_ref.map((r) => [r.country, Number(r.sessions)])),
    check: `${f} · countries parity`,
    detail: `rpc=${rpc.map((r) => `${r.country}:${r.sessions}`).join(" ")} ref=${c.countries_ref
      .map((r) => `${r.country}:${r.sessions}`)
      .join(" ")}`,
  });
  return findings;
}

export function checkHabitDepth(c: Comparison): Finding[] {
  const f = label(c.filters);
  const rows = c.habit_rpc;
  const findings: Finding[] = [
    {
      ok: JSON.stringify(rows.map((r) => Number(r.min_days))) === JSON.stringify([1, 3, 7, 14, 21]),
      check: `${f} · habit bands are 1/3/7/14/21`,
      detail: rows.map((r) => r.min_days).join(", "),
    },
    {
      ok: new Set(rows.map((r) => Number(r.cohort))).size <= 1,
      check: `${f} · habit cohort is one repeated scalar`,
      detail: [...new Set(rows.map((r) => r.cohort))].join(", "),
    },
    {
      ok: rows.length === 0 || Number(rows[0]!.cohort) === Number(c.habit_ref_cohort),
      check: `${f} · habit cohort parity`,
      detail: `rpc=${rows[0]?.cohort} ref=${c.habit_ref_cohort}`,
    },
  ];
  // Cumulative: each band is a subset of the one before it.
  for (let i = 1; i < rows.length; i += 1) {
    findings.push({
      ok: Number(rows[i]!.installs) <= Number(rows[i - 1]!.installs),
      check: `${f} · habit ${rows[i - 1]!.min_days}+ >= ${rows[i]!.min_days}+`,
      detail: `${rows[i - 1]!.installs} -> ${rows[i]!.installs}`,
    });
  }
  return findings;
}

export function checkTrend(c: Comparison): Finding[] {
  const f = label(c.filters);
  const rows = c.trend_rpc;
  const days = rows.map((r) => String(r.day).slice(0, 10));
  const findings: Finding[] = [
    { ok: rows.length === 30, check: `${f} · trend has exactly 30 rows`, detail: `${rows.length}` },
    {
      ok: new Set(days).size === days.length,
      check: `${f} · trend days are distinct`,
      detail: `${new Set(days).size} of ${days.length}`,
    },
    {
      ok: [...days].sort().join() === days.join(),
      check: `${f} · trend is oldest-first`,
      detail: `${days[0]} … ${days[days.length - 1]}`,
    },
  ];
  // Dense: consecutive UTC days with no holes, zeros included.
  for (let i = 1; i < days.length; i += 1) {
    const prev = Date.parse(`${days[i - 1]}T00:00:00Z`);
    const cur = Date.parse(`${days[i]}T00:00:00Z`);
    findings.push({
      ok: cur - prev === 86_400_000,
      check: `${f} · trend gap at ${days[i]}`,
      detail: `${days[i - 1]} -> ${days[i]}`,
    });
  }
  for (const row of rows) {
    findings.push({
      ok: Number(row.new_installs) + Number(row.returning_installs) === Number(row.sessions),
      check: `${f} · trend ${String(row.day).slice(0, 10)} new + returning = sessions`,
      detail: `${row.new_installs} + ${row.returning_installs} vs ${row.sessions}`,
    });
  }
  return findings;
}

export function checkComparison(c: Comparison): Finding[] {
  const f = label(c.filters);
  return [
    ...compareParity(`${f} · install_counts`, c.install_counts_rpc, c.install_counts_ref),
    ...compareParity(`${f} · lifecycle`, pick(c.lifecycle_rpc, c.lifecycle_ref), c.lifecycle_ref),
    ...checkActivationMonotone(c),
    ...checkAccessFunnel(c),
    ...checkLifecyclePartition(c),
    ...checkRetention(c),
    ...checkTopCountries(c),
    ...checkHabitDepth(c),
    ...checkTrend(c),
  ];
}

/** The lifecycle reference answers six of the seven fields independently —
 *  including all three partition bands, each written as EXISTS/NOT EXISTS pairs
 *  rather than as a `max(created_at)` bucketing, so the two spellings check
 *  each other. `resurrected_7d` is left to the subset assertion. Compare only
 *  the keys the reference actually answers. */
function pick(
  rpc: Record<string, number> | null,
  ref: Record<string, number> | null,
): Record<string, number> | null {
  if (!rpc || !ref) return rpc;
  const out: Record<string, number> = {};
  for (const key of Object.keys(ref)) out[key] = rpc[key]!;
  return out;
}

/* ════════════════════════════════════════════════════════════════════════
   4. Transport + entry point
   ════════════════════════════════════════════════════════════════════════ */

export type RunSql = (conn: string, sql: string, timeoutMs: number) => string;

function defaultRun(conn: string, sql: string, timeoutMs: number): string {
  return execFileSync(
    "docker",
    [
      "run", "--rm", "-i",
      // ⛔ Names only. The reasoning below was always right and the code did
      // not keep it: `-e NAME=value` IS argv. See lib/child-env.ts.
      // argv is visible in `ps` on the host; the container env is not.
      "-e", "PGCONN",
      "-e", "PGQUERY",
      DOCKER_PG_IMAGE,
      "sh", "-c",
      'psql "$PGCONN" -v ON_ERROR_STOP=1 -t -A -c "$PGQUERY"',
    ],
    {
      encoding: "utf8",
      timeout: timeoutMs,
      stdio: ["pipe", "pipe", "pipe"],
      env: childEnv({ PGCONN: conn, PGQUERY: sql }),
    },
  );
}

export function buildConnectionString(env: OpsEnv): string | null {
  const ref = parseSupabaseRef(env.get("SUPABASE_URL"));
  const password = env.get("SUPABASE_DB_PASSWORD");
  if (!ref || !password) return null;
  return (
    `postgresql://postgres.${ref}:${encodeURIComponent(password)}` +
    `@${POOLER_HOST}:${POOLER_PORT}/postgres?sslmode=require`
  );
}

export function render(findings: Finding[]): string {
  const failed = findings.filter((f) => !f.ok);
  const lines = [
    "────────────────────────────────────────────────────────────────────────",
    "CHESSCITO — /stats RPC VERIFICATION",
    `checks ${findings.length} · passed ${findings.length - failed.length} · FAILED ${failed.length}`,
    "────────────────────────────────────────────────────────────────────────",
  ];
  if (failed.length === 0) {
    lines.push("🟢 every check passed");
  } else {
    lines.push("🔴 failures:");
    for (const f of failed) {
      lines.push(`  · ${f.check}${f.detail ? ` — ${f.detail}` : ""}`);
    }
  }
  return lines.join("\n");
}

export async function verifyStatsRpcs(
  env: OpsEnv,
  deps: { run?: RunSql } = {},
): Promise<Finding[]> {
  const conn = buildConnectionString(env);
  if (!conn) {
    return [
      {
        ok: false,
        check: "credentials",
        detail:
          "SUPABASE_URL and SUPABASE_DB_PASSWORD are required (values are never printed)",
      },
    ];
  }

  const run = deps.run ?? defaultRun;
  const findings: Finding[] = [];

  const catalog = JSON.parse(
    run(conn, assertReadOnlySql(buildCatalogSql()), TIMEOUT_MS).trim(),
  ) as CatalogRow[];
  findings.push(...checkCatalog(catalog));

  // Without the functions there is nothing to compare, and running the grid
  // would bury the one finding that matters under 200 parse errors.
  if (findings.some((f) => f.check.endsWith("· exists") && !f.ok)) return findings;

  const privileges = JSON.parse(
    run(conn, assertReadOnlySql(buildPrivilegeSql()), TIMEOUT_MS).trim(),
  ) as PrivilegeRow[];
  findings.push(...checkPrivileges(privileges));

  for (const surface of SURFACES) {
    for (const container of CONTAINERS) {
      const filters: Filters = { surface, container };
      const raw = run(conn, assertReadOnlySql(buildComparisonSql(filters)), TIMEOUT_MS);
      const comparison = JSON.parse(raw.trim()) as Comparison;
      findings.push(...checkComparison({ ...comparison, filters }));
    }
  }

  return findings;
}

/* eslint-disable no-console */
async function main(): Promise<void> {
  const repoRoot = process.cwd().replace(/\/apps\/web$/, "");
  const findings = await verifyStatsRpcs(loadOpsEnv(repoRoot));
  console.log(render(findings));
  process.exitCode = findings.some((f) => !f.ok) ? 1 : 0;
}

// Only when executed directly. Importing this module — which the suite does —
// must never open a connection.
if (process.argv[1] && process.argv[1].endsWith("verify-stats-rpcs.ts")) {
  void main();
}
