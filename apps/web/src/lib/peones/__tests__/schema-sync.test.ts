/**
 * Sprint 3 commit A — schema sync guard.
 *
 * Parses the Supabase migration file shipped in commit A and asserts
 * that the SQL CHECK lists for `event_type` and `source` match the
 * TypeScript enums in `lib/peones/types.ts`. Without this guard a
 * future author could add a new TS literal (or a new SQL value) and
 * the drift would surface only at runtime when an INSERT explodes
 * with a check_violation. We catch it at test time instead.
 *
 * The cap value (10) is also pinned because the TS-side constant
 * `PEONES_DAILY_CAP` MUST match the SQL helper
 * `peones_balance_with_caps` magic number; otherwise the client
 * thinks more headroom exists than the server enforces.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  PEONES_DAILY_CAP,
  PEONES_DAILY_CAP_SOURCES,
  type PeonesLedgerEventType,
  type PeonesLedgerSource,
} from "@/lib/peones/types";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260607000000_peones_ledger_init.sql",
);

/** Sprint 4 commit J added `welcome_pack` to the source CHECK via a
 *  follow-up migration. The schema-sync guard merges that migration's
 *  source list into the original one so the assertion captures the
 *  effective DB state, not just the Sprint 3 snapshot. */
const WELCOME_PACK_MIGRATION_PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260608010000_peones_welcome_pack_source.sql",
);

/** Economy recalibration 2026-06-10 (Slice C1) CREATE OR REPLACEs
 *  `peones_balance_with_caps` (cap 10→6, +exercise_completion). The cap +
 *  daily-source assertions below read this forward migration so they
 *  reflect the effective DB state, not the Sprint 3 snapshot. */
const CAP_RECALIBRATION_MIGRATION_PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260610010000_peones_daily_cap_recalibration.sql",
);

/** Training Path Slice 4 (2026-06-11) adds `labyrinth_completion` to the
 *  source CHECK and CREATE OR REPLACEs `peones_balance_with_caps` again
 *  (+labyrinth_completion in the capped set, cap stays 6). This is now
 *  the EFFECTIVE helper definition, so the cap assertions read it. */
const LABYRINTH_MIGRATION_PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260611010000_peones_labyrinth_completion_source.sql",
);

const migration = readFileSync(MIGRATION_PATH, "utf-8");
const welcomePackMigration = readFileSync(
  WELCOME_PACK_MIGRATION_PATH,
  "utf-8",
);
const capRecalibrationMigration = readFileSync(
  CAP_RECALIBRATION_MIGRATION_PATH,
  "utf-8",
);
const labyrinthMigration = readFileSync(LABYRINTH_MIGRATION_PATH, "utf-8");
void capRecalibrationMigration; // superseded by labyrinthMigration's CREATE OR REPLACE

/**
 * Extracts the values inside `check (column in (...))` for the given
 * column name. Tolerates whitespace + newlines inside the parens.
 */
function extractCheckList(column: string): string[] {
  const pattern = new RegExp(
    `${column}\\s+text\\s+not\\s+null\\s*[\\s\\S]*?check\\s*\\(\\s*${column}\\s+in\\s*\\(([\\s\\S]*?)\\)\\s*\\)`,
    "i",
  );
  const match = migration.match(pattern);
  if (!match) {
    throw new Error(
      `Could not find check list for column "${column}" in migration. ` +
        `Has the schema changed without updating this guard?`,
    );
  }
  return match[1]!
    .split(",")
    .map((token) => token.trim().replace(/^'(.*)'$/, "$1"))
    .filter(Boolean);
}

/** TS enum literals — must stay in lockstep with the SQL CHECK lists. */
const TS_EVENT_TYPES: PeonesLedgerEventType[] = [
  "earn",
  "spend",
  "adjustment",
  "rollback",
];

const TS_SOURCES: PeonesLedgerSource[] = [
  "daily_tactic",
  "daily_streak_bonus",
  "daily_lab",
  "exercise_completion",
  "labyrinth_completion",
  "senda_milestone",
  "pack_purchase",
  "welcome_pack",
  "coach",
  "hint",
  "retry",
  "save_game",
  "labyrinth_key",
  "admin_grant",
];

describe("peones_ledger — schema ↔ types sync", () => {
  it("event_type SQL check matches the TypeScript PeonesLedgerEventType union", () => {
    const sql = new Set(extractCheckList("event_type"));
    const ts = new Set(TS_EVENT_TYPES);
    expect(sql).toEqual(ts);
  });

  it("source SQL check matches the TypeScript PeonesLedgerSource union", () => {
    // Sprint 3 snapshot.
    const sqlOriginal = new Set(extractCheckList("source"));
    // Sprint 4 commit J follow-up — parses the welcome_pack migration
    // and unions in its CHECK list so the test reflects the effective
    // DB state after both migrations apply.
    const wpMatch = welcomePackMigration.match(
      /check\s*\(\s*source\s+in\s*\(([\s\S]*?)\)\s*\)/i,
    );
    expect(wpMatch, "welcome_pack migration must declare a CHECK list").not.toBeNull();
    const wpSources = wpMatch![1]!
      .split(",")
      .map((t) => t.trim().replace(/^'(.*)'$/, "$1"))
      .filter(Boolean);
    // Slice 4 follow-up: the labyrinth_completion migration swaps the
    // constraint again — its CHECK list is the latest full snapshot.
    const labMatch = labyrinthMigration.match(
      /check\s*\(\s*source\s+in\s*\(([\s\S]*?)\)\s*\)/i,
    );
    expect(labMatch, "labyrinth migration must declare a CHECK list").not.toBeNull();
    const labSources = labMatch![1]!
      .split(",")
      .map((t) => t.trim().replace(/^'(.*)'$/, "$1"))
      .filter(Boolean);
    const effective = new Set([...sqlOriginal, ...wpSources, ...labSources]);
    const ts = new Set(TS_SOURCES);
    expect(effective).toEqual(ts);
  });

  it("PEONES_DAILY_CAP_SOURCES is a subset of PeonesLedgerSource", () => {
    const allSources = new Set<PeonesLedgerSource>(TS_SOURCES);
    for (const cap of PEONES_DAILY_CAP_SOURCES) {
      expect(allSources.has(cap), `${cap} must be a declared source`).toBe(
        true,
      );
    }
  });

  it("the cap-aware SQL helper uses the same set of daily sources as PEONES_DAILY_CAP_SOURCES", () => {
    // The helper hard-codes the daily-family list in its filter. Pull
    // it back out and assert it matches the TS constant. Reads the
    // recalibration migration (the effective CREATE OR REPLACE).
    const helperMatch = labyrinthMigration.match(
      /and\s+source\s+in\s*\(\s*([\s\S]*?)\)\s*\n\s*and\s+day_utc\s+=\s+p_day_utc/i,
    );
    expect(
      helperMatch,
      "Could not locate the daily-source filter inside peones_balance_with_caps",
    ).not.toBeNull();
    const sqlSet = new Set(
      helperMatch![1]!
        .split(",")
        .map((t) => t.trim().replace(/^'(.*)'$/, "$1"))
        .filter(Boolean),
    );
    const tsSet = new Set<string>(PEONES_DAILY_CAP_SOURCES);
    expect(sqlSet).toEqual(tsSet);
  });

  it("PEONES_DAILY_CAP matches the magic number in peones_balance_with_caps", () => {
    // The helper hard-codes `N::integer as daily_cap`. If product changes
    // the cap, both this constant AND the SQL helper must move together.
    // Reads the recalibration migration (the effective CREATE OR REPLACE).
    const capMatch = labyrinthMigration.match(
      /(\d+)\s*::\s*integer\s+as\s+daily_cap/i,
    );
    expect(capMatch, "Could not find daily_cap value in SQL helper").not.toBeNull();
    expect(Number(capMatch![1])).toBe(PEONES_DAILY_CAP);
  });
});
