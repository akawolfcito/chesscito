/**
 * Source guard — the only real defence against the defect coming back.
 *
 * The page this replaces counted distinct sessions in JS over rows PostgREST
 * had already capped at 1,000. Every ranged read was ordered newest-first, so
 * "last 30 days" silently became "last 15 minutes" and /stats published 46
 * sessions against a real 3,928.
 *
 * ⚠️ The constant that caused it (`9999`) travelled between two files
 * TOGETHER WITH ITS FALSE COMMENT claiming the explicit range dodged the cap.
 * Prose replicates exactly like code does, so this guard checks the prose too.
 *
 * Ported from apps/web/src/lib/stats/__tests__/public-aggregator-truncation.test.ts.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it, vi } from "vitest";

// The aggregator reaches `lib/supabase/server`, which imports `server-only`.
// That package throws outside a React Server Component, which is exactly its
// job — so it is stubbed here rather than worked around in production code.
vi.mock("server-only", () => ({}));

import { STATS_RPCS } from "../aggregator";

const APP_ROOT = process.cwd();
const STATS_ROOT = join(APP_ROOT, "src/lib/stats");
const SELF = "aggregator-source-guard.test.ts";

/** The three telemetry tables the truncation defect lived on. `victories`,
 *  `scores` and `peones_ledger` are NOT here on purpose: the on-chain block
 *  reads them with a ranged scan, that scan is whole today, and its comment
 *  says so honestly. */
const TELEMETRY_TABLES = [
  "analytics_events",
  "account_first_seen",
  "session_first_seen",
];

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name) && entry.name !== SELF) out.push(full);
  }
  return out;
}

const FILES = sourceFiles(STATS_ROOT);
const rel = (f: string) => relative(APP_ROOT, f);
const read = (f: string) => readFileSync(f, "utf8");

/**
 * The same text with comments removed.
 *
 * Two kinds of assertion live in this file and they need OPPOSITE views:
 *
 *  - What the CODE must not do (`.range(`, `new Set(`, `unstable_cache`) has to
 *    be checked on `code`, because the prose deliberately NAMES those things to
 *    explain why they are absent — checking the raw text fails on the
 *    documentation instead of on the code.
 *  - What the PROSE must not claim ("explicit range bypasses") has to be
 *    checked on the raw text, because the false comment is the artefact: it was
 *    copied between two files together with the constant it lied about.
 */
const code = (f: string) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("stats source guard — coverage", () => {
  it("scans the stats module", () => {
    expect(FILES.length).toBeGreaterThan(4);
  });

  it("includes the aggregator itself", () => {
    expect(FILES.map(rel)).toContain("src/lib/stats/aggregator.ts");
  });

  it("the comment stripper leaves the code standing", () => {
    // Guards the guard: if the stripper swallowed the body, every code-level
    // assertion below would pass against an empty string.
    const src = code(join(STATS_ROOT, "aggregator.ts"));
    expect(src).toContain("export async function getPublicStats");
    expect(src).toContain("Promise.all");
    expect(src).not.toContain("There is a source guard");
  });
});

describe("no telemetry table is ever read by row", () => {
  for (const table of TELEMETRY_TABLES) {
    it(`no file queries ${table}`, () => {
      const offenders = FILES.filter((f) => read(f).includes(`"${table}"`)).map(rel);
      expect(offenders).toEqual([]);
    });
  }

  it("the aggregator contains no .range( at all", () => {
    expect(code(join(STATS_ROOT, "aggregator.ts"))).not.toMatch(/\.range\s*\(/);
  });

  it("the aggregator builds no Set over rows", () => {
    // Counting distinct anything in JS is the defect. If a future edit needs a
    // distinct count, it belongs in SQL.
    expect(code(join(STATS_ROOT, "aggregator.ts"))).not.toMatch(/new Set\s*\(/);
  });
});

describe("the false comment cannot come back", () => {
  for (const phrase of ["explicit range bypasses", "dodge PostgREST"]) {
    it(`no file claims "${phrase}"`, () => {
      const offenders = FILES.filter((f) =>
        read(f).toLowerCase().includes(phrase.toLowerCase()),
      ).map(rel);
      expect(offenders).toEqual([]);
    });
  }

  it("the 9999 ceiling is not reintroduced in any file that queries", () => {
    // Scoped to the query layer on purpose. `identity.ts` legitimately carries
    // a 9999 (the avatar number is 0..9999) and has nothing to do with a row
    // ceiling; a repo-wide match here would be a guard that cries wolf, and a
    // guard nobody trusts gets deleted.
    const QUERY_FILES = ["aggregator.ts", "onchain.ts", "players-census.ts"];
    const offenders = QUERY_FILES.filter((f) =>
      /\b9_?999\b/.test(read(join(STATS_ROOT, f))),
    );
    expect(offenders).toEqual([]);
  });

  it("the on-chain scan keeps the corrected 999 bound", () => {
    const src = read(join(STATS_ROOT, "onchain.ts"));
    expect(src).toMatch(/ONCHAIN_QUERY_MAX_ROWS\s*=\s*999\b/);
  });
});

describe("cache policy — Phase C introduces none", () => {
  for (const token of [
    "unstable_cache",
    "revalidateTag",
    "revalidatePath",
    "export const revalidate",
  ]) {
    it(`no stats file uses ${token}`, () => {
      const offenders = FILES.filter((f) => code(f).includes(token)).map(rel);
      expect(offenders).toEqual([]);
    });
  }

  it("the Supabase client opts out of Next's fetch cache explicitly", () => {
    const src = code(join(APP_ROOT, "src/lib/supabase/server.ts"));
    expect(src).toMatch(/cache:\s*"no-store"/);
    expect(src).toMatch(/global:\s*\{\s*fetch:/);
  });
});

describe("the eight RPCs", () => {
  it("are exactly the eight the migration created", () => {
    expect([...STATS_RPCS].sort()).toEqual([
      "stats_access_funnel",
      "stats_account_lifecycle",
      "stats_activation_funnel",
      "stats_activity_trend",
      "stats_habit_depth",
      "stats_install_counts",
      "stats_retention",
      "stats_top_countries",
    ]);
  });

  it("the aggregator names no other stats_ function", () => {
    const src = read(join(STATS_ROOT, "aggregator.ts"));
    const named = new Set([...src.matchAll(/"(stats_\w+)"/g)].map((m) => m[1]));
    expect([...named].sort()).toEqual([...STATS_RPCS].sort());
  });

  it("the literal string 'all' never reaches an RPC argument", () => {
    // `all` is the UI's word for "no filter"; SQL spells it null. A literal
    // 'all' would match zero rows and every card would read 0.
    const src = read(join(STATS_ROOT, "filters.ts"));
    expect(src).toMatch(/value === "all" \? null/);
  });
});
