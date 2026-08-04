import { describe, expect, it, vi } from "vitest";

import { isReadOnlySql } from "../lib/read-only-guard";
import {
  buildCatalogSql,
  buildComparisonSql,
  buildConnectionString,
  buildPrivilegeSql,
  checkAccessFunnel,
  checkActivationMonotone,
  checkCatalog,
  checkHabitDepth,
  checkLifecyclePartition,
  checkPrivileges,
  checkRetention,
  checkTopCountries,
  checkTrend,
  compareParity,
  CONTAINERS,
  FORBIDDEN_ROLES,
  render,
  STATS_RPCS,
  SURFACES,
  verifyStatsRpcs,
  WORK_MEM_FUNCTIONS,
  type CatalogRow,
  type Comparison,
  type PrivilegeRow,
} from "../verify-stats-rpcs";
import type { CredentialName, OpsEnv } from "../lib/env";

/**
 * The verifier's own tests.
 *
 * ⚠️ The point of this file: a checker that only ever runs against production
 * is a checker nobody has tested. Every invariant below is exercised against a
 * fixture that VIOLATES it, because a checker that has only seen healthy input
 * has not been shown to reject anything — which is the exact failure mode of
 * the `hitCeiling` guard that compared against an unreachable 10,000 and so
 * never fired once.
 *
 * No database, no docker, no network: `run` is injected.
 */

function envWith(values: Partial<Record<CredentialName, string>>): OpsEnv {
  return {
    get: (name) => values[name],
    has: (name) => Boolean(values[name]),
    statuses: () => [],
  };
}

function catalogRow(over: Partial<CatalogRow> = {}): CatalogRow {
  const name = over.name ?? "stats_install_counts";
  return {
    name: "stats_install_counts",
    args: "p_surface text, p_container text",
    result: "TABLE(sessions_7d bigint, sessions_30d bigint)",
    security_definer: true,
    volatility: "s",
    // The two measured-spill functions carry work_mem; the other six must not.
    config: (WORK_MEM_FUNCTIONS as readonly string[]).includes(name)
      ? ["search_path=public", "work_mem=8MB"]
      : ["search_path=public"],
    acl: "{postgres=X/postgres,service_role=X/postgres}",
    ...over,
  };
}

function fullCatalog(over: Partial<CatalogRow> = {}): CatalogRow[] {
  return STATS_RPCS.map((name) => catalogRow({ name, ...over }));
}

const HEALTHY_TREND = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 6, 6) + i * 86_400_000);
  return {
    day: d.toISOString().slice(0, 10),
    sessions: 10,
    new_installs: 4,
    returning_installs: 6,
  };
});

function comparison(over: Partial<Comparison> = {}): Comparison {
  return {
    filters: { surface: null, container: null },
    install_counts_rpc: {
      sessions_7d: 3927,
      sessions_30d: 6446,
      app_opens_rows_30d: 4695,
      app_open_sessions_30d: 3976,
    },
    install_counts_ref: {
      sessions_7d: 3927,
      sessions_30d: 6446,
      app_opens_rows_30d: 4695,
      app_open_sessions_30d: 3976,
    },
    activation_rpc: [
      { step: "app_opened", sessions: 3976 },
      { step: "hub_viewed", sessions: 3100 },
      { step: "exercise_started", sessions: 1200 },
      { step: "exercise_completed", sessions: 800 },
      { step: "daily_focus_completed", sessions: 700 },
    ],
    access_rpc: [
      { step: "gate_viewed", sessions: 500, failed_sessions: 12 },
      { step: "login_started", sessions: 400, failed_sessions: 12 },
      { step: "login_succeeded", sessions: 380, failed_sessions: 12 },
      { step: "wallet_ready", sessions: 370, failed_sessions: 12 },
      { step: "first_exercise_completed", sessions: 90, failed_sessions: 12 },
    ],
    access_ref_gate: 500,
    countries_rpc: [
      { country: "NG", sessions: 1462 },
      { country: "NL", sessions: 677 },
      { country: "KE", sessions: 281 },
    ],
    countries_ref: [
      { country: "NG", sessions: 1462 },
      { country: "NL", sessions: 677 },
      { country: "KE", sessions: 281 },
    ],
    retention_rpc: [
      { bucket: "d1", returned: 300, cohort: 1562 },
      { bucket: "d7", returned: 20, cohort: 107 },
      { bucket: "week3", returned: 0, cohort: 0 },
    ],
    retention_ref: [
      { bucket: "d1", returned: 300, cohort: 1562 },
      { bucket: "d7", returned: 20, cohort: 107 },
      { bucket: "week3", returned: 0, cohort: 0 },
    ],
    lifecycle_rpc: {
      known: 3063,
      new_today: 1578,
      new_7d: 3058,
      active_7d: 3062,
      dormant: 1,
      inactive: 0,
      resurrected_7d: 4,
    },
    lifecycle_ref: {
      known: 3063,
      new_today: 1578,
      new_7d: 3058,
      active_7d: 3062,
      dormant: 1,
      inactive: 0,
    },
    habit_rpc: [
      { min_days: 1, installs: 6446, cohort: 6446, median_active_days: 1 },
      { min_days: 3, installs: 900, cohort: 6446, median_active_days: 1 },
      { min_days: 7, installs: 120, cohort: 6446, median_active_days: 1 },
      { min_days: 14, installs: 30, cohort: 6446, median_active_days: 1 },
      { min_days: 21, installs: 4, cohort: 6446, median_active_days: 1 },
    ],
    habit_ref_cohort: 6446,
    trend_rpc: HEALTHY_TREND,
    ...over,
  };
}

const failed = (findings: ReturnType<typeof checkTrend>) =>
  findings.filter((f) => !f.ok).map((f) => f.check);

describe("verify-stats-rpcs · SQL is read-only and single-statement", () => {
  it("passes the monitor's guard for every statement it emits", () => {
    expect(isReadOnlySql(buildCatalogSql())).toBe(true);
    expect(isReadOnlySql(buildPrivilegeSql())).toBe(true);
    for (const surface of SURFACES) {
      for (const container of CONTAINERS) {
        expect(
          isReadOnlySql(buildComparisonSql({ surface, container })),
          `surface=${surface} container=${container}`,
        ).toBe(true);
      }
    }
  });

  it("emits no semicolon, so nothing can be appended into a second statement", () => {
    expect(buildCatalogSql()).not.toContain(";");
    expect(buildPrivilegeSql()).not.toContain(";");
    expect(buildComparisonSql({ surface: "learn", container: "minipay" })).not.toContain(";");
  });

  it("covers the whole 3x3 filter grid and sends `all` as NULL, never as a string", () => {
    expect(SURFACES).toEqual([null, "learn", "play"]);
    expect(CONTAINERS).toEqual([null, "minipay", "browser"]);
    const unfiltered = buildComparisonSql({ surface: null, container: null });
    expect(unfiltered).toContain("null::text is null");
    expect(unfiltered).not.toContain("'all'");
  });

  it("rejects a filter value outside the closed list", () => {
    expect(() =>
      buildComparisonSql({ surface: "learn'; drop table analytics_events --", container: null }),
    ).toThrow(/unexpected filter value/);
  });

  it("asks for all eight functions and all three forbidden roles", () => {
    for (const fn of STATS_RPCS) {
      expect(buildCatalogSql()).toContain(`'${fn}'`);
      for (const role of FORBIDDEN_ROLES) {
        expect(buildPrivilegeSql()).toContain(
          `has_function_privilege('${role}', 'public.${fn}(text, text)', 'EXECUTE')`,
        );
      }
    }
    expect(FORBIDDEN_ROLES).toEqual(["public", "anon", "authenticated"]);
  });

  it("never asks about service_role, which is the intended reader", () => {
    expect(buildPrivilegeSql()).not.toContain("'service_role'");
  });
});

describe("verify-stats-rpcs · catalog", () => {
  it("passes a healthy catalog", () => {
    expect(failed(checkCatalog(fullCatalog()))).toEqual([]);
  });

  it("fails when a function is missing rather than reporting nothing", () => {
    const rows = fullCatalog().slice(0, 7);
    expect(failed(checkCatalog(rows))).toContain("stats_activity_trend · exists");
  });

  it("fails a function that is not SECURITY DEFINER", () => {
    const rows = fullCatalog();
    rows[2] = catalogRow({ name: rows[2]!.name, security_definer: false });
    expect(failed(checkCatalog(rows))).toContain(`${rows[2]!.name} · security definer`);
  });

  it("fails an unpinned search_path — the dangerous half of SECURITY DEFINER", () => {
    const rows = fullCatalog();
    rows[0] = catalogRow({ name: rows[0]!.name, config: [] });
    expect(failed(checkCatalog(rows))).toContain(`${rows[0]!.name} · search_path pinned`);
  });

  it("fails a search_path that is pinned to something other than public", () => {
    const rows = fullCatalog();
    rows[0] = catalogRow({ name: rows[0]!.name, config: ["search_path=public, extensions"] });
    expect(failed(checkCatalog(rows))).toContain(`${rows[0]!.name} · search_path pinned`);
  });

  it("fails a wrong signature", () => {
    const rows = fullCatalog();
    rows[1] = catalogRow({ name: rows[1]!.name, args: "p_surface text" });
    expect(failed(checkCatalog(rows))).toContain(`${rows[1]!.name} · signature`);
  });

  it("fails a function declared immutable, which would freeze its window", () => {
    const rows = fullCatalog();
    rows[3] = catalogRow({ name: rows[3]!.name, volatility: "i" });
    expect(failed(checkCatalog(rows))).toContain(`${rows[3]!.name} · stable`);
  });

  it("accepts work_mem on exactly the two measured-spill functions", () => {
    expect(WORK_MEM_FUNCTIONS).toEqual(["stats_top_countries", "stats_habit_depth"]);
    expect(failed(checkCatalog(fullCatalog()))).toEqual([]);
  });

  it("fails when a measured-spill function LOST its work_mem", () => {
    const rows = fullCatalog();
    const i = rows.findIndex((r) => r.name === "stats_top_countries");
    rows[i] = catalogRow({ name: "stats_top_countries", config: ["search_path=public"] });
    expect(failed(checkCatalog(rows))).toContain("stats_top_countries · work_mem raised to 8MB");
  });

  it("fails a work_mem that drifted off 8MB", () => {
    const rows = fullCatalog();
    const i = rows.findIndex((r) => r.name === "stats_habit_depth");
    rows[i] = catalogRow({
      name: "stats_habit_depth",
      config: ["search_path=public", "work_mem=64MB"],
    });
    expect(failed(checkCatalog(rows))).toContain("stats_habit_depth · work_mem raised to 8MB");
  });

  it("fails work_mem SPREADING to a function that never spilled", () => {
    // The closed set, checked in the other direction. A per-function tuning
    // that quietly reaches all eight is a database-wide memory decision taken
    // by accident, on the instance where memory is scarcest.
    const rows = fullCatalog();
    rows[0] = catalogRow({
      name: "stats_install_counts",
      config: ["search_path=public", "work_mem=8MB"],
    });
    expect(failed(checkCatalog(rows))).toContain("stats_install_counts · work_mem NOT set");
  });

  it("fails an unreviewed GUC riding along in proconfig", () => {
    const rows = fullCatalog();
    rows[0] = catalogRow({
      name: "stats_install_counts",
      config: ["search_path=public", "statement_timeout=0"],
    });
    expect(failed(checkCatalog(rows))).toContain(
      "stats_install_counts · no unexpected proconfig settings",
    );
  });

  it("still rejects a widened search_path now that a second setting is legal", () => {
    // The regression this pairing invites: adding work_mem beside search_path
    // and loosening the search_path check to `startsWith` on the way.
    const rows = fullCatalog();
    const i = rows.findIndex((r) => r.name === "stats_top_countries");
    rows[i] = catalogRow({
      name: "stats_top_countries",
      config: ["search_path=public, extensions", "work_mem=8MB"],
    });
    expect(failed(checkCatalog(rows))).toContain("stats_top_countries · search_path pinned");
  });

  it("flags an unexpected ninth stats_* function", () => {
    const rows = [...fullCatalog(), catalogRow({ name: "stats_secret_backdoor" })];
    expect(failed(checkCatalog(rows))).toContain("catalog · no unexpected stats_* functions");
  });
});

describe("verify-stats-rpcs · privileges", () => {
  const healthy: PrivilegeRow[] = STATS_RPCS.flatMap((fn) =>
    FORBIDDEN_ROLES.map((role) => ({
      fn,
      role,
      granted: false,
      acl: "{postgres=X/postgres,service_role=X/postgres}",
    })),
  );

  it("passes when no forbidden role holds EXECUTE", () => {
    expect(failed(checkPrivileges(healthy))).toEqual([]);
  });

  it("fails the exact production defect: revoked from PUBLIC, still granted to anon", () => {
    const rows = healthy.map((r) =>
      r.fn === "stats_retention" && r.role === "anon"
        ? { ...r, granted: true, acl: "{postgres=X/postgres,anon=X/postgres}" }
        : r,
    );
    expect(failed(checkPrivileges(rows))).toContain("stats_retention · anon has no EXECUTE");
  });

  it("fails an acl that still names the role even when the effective check passes", () => {
    // Belt and braces: the two reads answer differently and a disagreement is
    // itself the finding.
    const rows = healthy.map((r) =>
      r.fn === "stats_habit_depth" && r.role === "authenticated"
        ? { ...r, granted: false, acl: "{postgres=X/postgres,authenticated=X/postgres}" }
        : r,
    );
    expect(failed(checkPrivileges(rows))).toContain(
      "stats_habit_depth · authenticated absent from proacl",
    );
  });

  it("treats a MISSING answer as a failure, never as a pass", () => {
    const rows = healthy.filter((r) => !(r.fn === "stats_top_countries" && r.role === "public"));
    expect(failed(checkPrivileges(rows))).toContain("stats_top_countries · public has no EXECUTE");
  });

  it("covers all 24 pairs", () => {
    expect(checkPrivileges(healthy)).toHaveLength(24);
  });
});

describe("verify-stats-rpcs · parity", () => {
  it("passes when every field agrees", () => {
    const c = comparison();
    expect(failed(compareParity("x", c.install_counts_rpc, c.install_counts_ref))).toEqual([]);
  });

  it("fails a single disagreeing field and names it", () => {
    const c = comparison();
    const rpc = { ...c.install_counts_rpc!, sessions_7d: 46 };
    expect(failed(compareParity("x", rpc, c.install_counts_ref))).toEqual(["x · sessions_7d"]);
  });

  it("fails when either side is null instead of silently passing", () => {
    expect(failed(compareParity("x", null, { a: 1 }))).toEqual(["x · parity"]);
    expect(failed(compareParity("x", { a: 1 }, null))).toEqual(["x · parity"]);
  });
});

describe("verify-stats-rpcs · activation is monotone", () => {
  it("passes a monotone funnel", () => {
    expect(failed(checkActivationMonotone(comparison()))).toEqual([]);
  });

  it("catches the exact shape the page shipped: App opened 37 < Hub viewed 41", () => {
    const c = comparison({
      activation_rpc: [
        { step: "app_opened", sessions: 37 },
        { step: "hub_viewed", sessions: 41 },
        { step: "exercise_started", sessions: 15 },
        { step: "exercise_completed", sessions: 8 },
        { step: "daily_focus_completed", sessions: 7 },
      ],
    });
    expect(failed(checkActivationMonotone(c))).toContain(
      "surface=all container=all · activation app_opened >= hub_viewed",
    );
  });

  it("fails a funnel with a missing step", () => {
    const c = comparison({ activation_rpc: comparison().activation_rpc.slice(0, 3) });
    expect(failed(checkActivationMonotone(c))).toContain(
      "surface=all container=all · activation has 5 steps",
    );
  });
});

describe("verify-stats-rpcs · access funnel", () => {
  it("passes a cohort-scoped funnel", () => {
    expect(failed(checkAccessFunnel(comparison()))).toEqual([]);
  });

  it("fails a step that escapes the gate cohort", () => {
    const rows = comparison().access_rpc.map((s) =>
      s.step === "first_exercise_completed" ? { ...s, sessions: 900 } : s,
    );
    expect(failed(checkAccessFunnel(comparison({ access_rpc: rows })))).toContain(
      "surface=all container=all · access first_exercise_completed within cohort",
    );
  });

  it("allows a NON-monotone middle, because access is not prefix-nested", () => {
    const rows = comparison().access_rpc.map((s) =>
      s.step === "login_succeeded" ? { ...s, sessions: 450 } : s,
    );
    expect(failed(checkAccessFunnel(comparison({ access_rpc: rows })))).toEqual([]);
  });

  it("fails when failed_sessions differs between rows", () => {
    const rows = comparison().access_rpc.map((s, i) => ({ ...s, failed_sessions: i }));
    expect(failed(checkAccessFunnel(comparison({ access_rpc: rows })))).toContain(
      "surface=all container=all · failed_sessions is one repeated scalar",
    );
  });

  it("fails a gate cohort that disagrees with the reference count", () => {
    expect(failed(checkAccessFunnel(comparison({ access_ref_gate: 501 })))).toContain(
      "surface=all container=all · access gate cohort parity",
    );
  });
});

describe("verify-stats-rpcs · lifecycle partition", () => {
  it("passes a closed partition", () => {
    expect(failed(checkLifecyclePartition(comparison()))).toEqual([]);
  });

  it("catches the published defect: Inactive 962 against a real 0", () => {
    const c = comparison({
      lifecycle_rpc: {
        known: 3063,
        new_today: 1578,
        new_7d: 3058,
        active_7d: 38,
        dormant: 0,
        inactive: 962,
        resurrected_7d: 0,
      },
    });
    expect(failed(checkLifecyclePartition(c))).toContain(
      "surface=all container=all · active + dormant + inactive = known",
    );
  });

  it("fails resurrected accounted outside active", () => {
    const l = { ...comparison().lifecycle_rpc!, resurrected_7d: 99_999 };
    expect(failed(checkLifecyclePartition(comparison({ lifecycle_rpc: l })))).toContain(
      "surface=all container=all · resurrected_7d subset of active_7d",
    );
  });

  it("fails the three-identical-counts signature of a capped read", () => {
    // known = new_today = new_7d = 1,000 was the tell: one capped list counted
    // three times. Any of them exceeding its container fails.
    const l = { ...comparison().lifecycle_rpc!, new_today: 3058, new_7d: 1000, known: 1000 };
    const out = failed(checkLifecyclePartition(comparison({ lifecycle_rpc: l })));
    expect(out).toContain("surface=all container=all · new_today within new_7d");
  });

  it("fails when no row comes back at all", () => {
    expect(failed(checkLifecyclePartition(comparison({ lifecycle_rpc: null })))).toContain(
      "surface=all container=all · lifecycle",
    );
  });
});

describe("verify-stats-rpcs · retention", () => {
  it("passes three buckets in order, cohort 0 included", () => {
    expect(failed(checkRetention(comparison()))).toEqual([]);
  });

  it("fails when a bucket vanishes instead of reporting a zero cohort", () => {
    const c = comparison({
      retention_rpc: comparison().retention_rpc.slice(0, 2),
    });
    expect(failed(checkRetention(c))).toContain(
      "surface=all container=all · retention returns d1/d7/week3 in order",
    );
  });

  it("fails returned above cohort", () => {
    const rows = comparison().retention_rpc.map((r) =>
      r.bucket === "d7" ? { ...r, returned: 999 } : r,
    );
    expect(failed(checkRetention(comparison({ retention_rpc: rows })))).toContain(
      "surface=all container=all · retention d7 returned <= cohort",
    );
  });

  it("fails a cohort that disagrees with the reference query", () => {
    const ref = comparison().retention_ref.map((r) =>
      r.bucket === "d1" ? { ...r, cohort: 0 } : r,
    );
    expect(failed(checkRetention(comparison({ retention_ref: ref })))).toContain(
      "surface=all container=all · retention d1 parity",
    );
  });
});

describe("verify-stats-rpcs · top countries", () => {
  it("passes a stably ordered top 8", () => {
    expect(failed(checkTopCountries(comparison()))).toEqual([]);
  });

  it("fails more than 8 rows", () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({
      country: `C${i}`,
      sessions: 100 - i,
    }));
    const c = comparison({ countries_rpc: rows, countries_ref: rows });
    expect(failed(checkTopCountries(c))).toContain(
      "surface=all container=all · countries capped at 8",
    );
  });

  it("catches the reorder the page published — KE 3rd printed 8th", () => {
    const rows = [
      { country: "NG", sessions: 20 },
      { country: "NL", sessions: 8 },
      { country: "KE", sessions: 281 },
    ];
    const out = failed(checkTopCountries(comparison({ countries_rpc: rows })));
    expect(out).toContain("surface=all container=all · countries order is total at 2");
    expect(out).toContain("surface=all container=all · countries parity");
  });

  it("fails a tie broken in the wrong direction, so the order is total", () => {
    const rows = [
      { country: "NL", sessions: 100 },
      { country: "KE", sessions: 100 },
    ];
    const c = comparison({ countries_rpc: rows, countries_ref: rows });
    expect(failed(checkTopCountries(c))).toContain(
      "surface=all container=all · countries order is total at 1",
    );
  });

  it("fails a null or empty country in the ranking", () => {
    const rows = [{ country: "", sessions: 10 }];
    const c = comparison({ countries_rpc: rows, countries_ref: rows });
    expect(failed(checkTopCountries(c))).toContain(
      "surface=all container=all · countries exclude null",
    );
  });
});

describe("verify-stats-rpcs · habit depth", () => {
  it("passes cumulative bands", () => {
    expect(failed(checkHabitDepth(comparison()))).toEqual([]);
  });

  it("fails a band that grows, which would mean the bands are not cumulative", () => {
    const rows = comparison().habit_rpc.map((r) =>
      r.min_days === 7 ? { ...r, installs: 5000 } : r,
    );
    expect(failed(checkHabitDepth(comparison({ habit_rpc: rows })))).toContain(
      "surface=all container=all · habit 3+ >= 7+",
    );
  });

  it("fails altered thresholds", () => {
    const rows = comparison().habit_rpc.map((r) =>
      r.min_days === 21 ? { ...r, min_days: 30 } : r,
    );
    expect(failed(checkHabitDepth(comparison({ habit_rpc: rows })))).toContain(
      "surface=all container=all · habit bands are 1/3/7/14/21",
    );
  });

  it("fails a cohort that varies between rows", () => {
    const rows = comparison().habit_rpc.map((r, i) => ({ ...r, cohort: i }));
    expect(failed(checkHabitDepth(comparison({ habit_rpc: rows })))).toContain(
      "surface=all container=all · habit cohort is one repeated scalar",
    );
  });
});

describe("verify-stats-rpcs · activity trend", () => {
  it("passes exactly 30 dense rows", () => {
    expect(failed(checkTrend(comparison()))).toEqual([]);
  });

  it("fails 29 rows", () => {
    const c = comparison({ trend_rpc: HEALTHY_TREND.slice(1) });
    expect(failed(checkTrend(c))).toContain(
      "surface=all container=all · trend has exactly 30 rows",
    );
  });

  it("fails a hole in the middle — the sparse-bucket failure", () => {
    const rows = [...HEALTHY_TREND];
    rows.splice(10, 1);
    rows.push({ ...rows[rows.length - 1]!, day: "2026-08-05" });
    expect(failed(checkTrend(comparison({ trend_rpc: rows }))).some((c) => c.includes("trend gap"))).toBe(
      true,
    );
  });

  it("fails when new + returning does not equal sessions", () => {
    const rows = HEALTHY_TREND.map((r, i) =>
      i === 5 ? { ...r, new_installs: 10, returning_installs: 10 } : r,
    );
    expect(
      failed(checkTrend(comparison({ trend_rpc: rows }))).some((c) =>
        c.includes("new + returning = sessions"),
      ),
    ).toBe(true);
  });

  it("catches the published '100% new, 0% returning' series", () => {
    const rows = HEALTHY_TREND.map((r) => ({
      ...r,
      new_installs: r.sessions,
      returning_installs: r.sessions,
    }));
    expect(
      failed(checkTrend(comparison({ trend_rpc: rows }))).some((c) =>
        c.includes("new + returning = sessions"),
      ),
    ).toBe(true);
  });
});

describe("verify-stats-rpcs · wiring", () => {
  it("stops after the catalog when the migration is not applied, instead of 200 parse errors", () => {
    const run = vi.fn(() => JSON.stringify([]));
    return verifyStatsRpcs(envWith({ SUPABASE_URL: "https://abc.supabase.co", SUPABASE_DB_PASSWORD: "x" }), {
      run,
    }).then((findings) => {
      expect(run).toHaveBeenCalledTimes(1);
      expect(failed(findings)).toContain("stats_install_counts · exists");
    });
  });

  it("reports missing credentials without opening a connection", async () => {
    const run = vi.fn(() => "");
    const findings = await verifyStatsRpcs(envWith({}), { run });
    expect(run).not.toHaveBeenCalled();
    expect(failed(findings)).toEqual(["credentials"]);
  });

  it("never puts a credential in the connection string it returns to a renderer", () => {
    // buildConnectionString is the ONLY place the password appears; nothing
    // downstream renders its return value.
    const conn = buildConnectionString(
      envWith({ SUPABASE_URL: "https://abc.supabase.co", SUPABASE_DB_PASSWORD: "s3cr3t" }),
    );
    expect(conn).toContain("aws-1-us-east-1.pooler.supabase.com");
    expect(render([{ ok: true, check: "x", detail: "" }])).not.toContain("s3cr3t");
  });

  it("renders failures, and exits loud rather than quiet", () => {
    const out = render([
      { ok: true, check: "a", detail: "" },
      { ok: false, check: "b", detail: "because" },
    ]);
    expect(out).toContain("FAILED 1");
    expect(out).toContain("b — because");
    expect(render([{ ok: true, check: "a", detail: "" }])).toContain("every check passed");
  });
});
