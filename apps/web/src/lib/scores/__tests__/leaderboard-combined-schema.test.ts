/**
 * SaveScore off-chain — Slice 4 leaderboard schema guard.
 *
 * Parses the migration that ships the combined leaderboard view and
 * asserts the contract approved in docs/specs/savescore-offchain-peones.md
 * (§Leaderboard integration) + the founder decision 2026-06-10
 * (baseline IF NOT EXISTS):
 *
 *   1. Self-contained baseline: CREATE TABLE IF NOT EXISTS for both
 *      `scores` and `passport_cache` so the view's dependencies resolve
 *      from a clean `supabase db reset` (no-op on hosted where they
 *      already exist via schema.sql).
 *   2. New view `leaderboard_combined_v` that UNION ALLs the legacy
 *      on-chain `scores` with the off-chain `score_saves`, takes the best
 *      score per (player, level), sums per player, ranks, LIMIT 10.
 *   3. `is_verified` comes from `passport_cache` (COALESCE …, false), so
 *      pure off-chain (score_saves-only) players surface unverified.
 *   4. `get_leaderboard()` reads from `leaderboard_combined_v` — one
 *      source of truth shared with the TS fallback (P1
 *      leaderboard-view-undefined).
 *   5. NEVER alters `leaderboard_v` and performs NO destructive
 *      DROP / data-mutating ALTER.
 *
 * Text-based (not a live DB call) on purpose — mirrors the Slice 1
 * `save-basic-score-schema.test.ts` harness: catch drift at PR time
 * without spinning up Supabase. The behavioural SQL smoke (against
 * local supabase/Docker) is documented in the slice handoff.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260610000000_leaderboard_combined_view.sql",
);

const migration = readFileSync(MIGRATION_PATH, "utf-8");

/** Isolate the body of the combined view for scoped asserts. */
function viewBody(): string {
  const startIdx = migration.search(
    /create (or replace )?view public\.leaderboard_combined_v/i,
  );
  expect(startIdx).toBeGreaterThan(-1);
  // Slice to the next top-level statement (the get_leaderboard function).
  const fnIdx = migration.search(
    /create (or replace )?function public\.get_leaderboard/i,
  );
  return migration.slice(startIdx, fnIdx > startIdx ? fnIdx : undefined);
}

/** Isolate the body of the get_leaderboard function. */
function fnBody(): string {
  const startIdx = migration.search(
    /create (or replace )?function public\.get_leaderboard/i,
  );
  expect(startIdx).toBeGreaterThan(-1);
  return migration.slice(startIdx);
}

describe("leaderboard combined — self-contained baseline", () => {
  it("materialises scores via CREATE TABLE IF NOT EXISTS (idempotent)", () => {
    expect(migration).toMatch(
      /create table if not exists public\.scores/i,
    );
  });

  it("materialises passport_cache via CREATE TABLE IF NOT EXISTS", () => {
    expect(migration).toMatch(
      /create table if not exists public\.passport_cache/i,
    );
  });
});

describe("leaderboard_combined_v — migration shape", () => {
  it("creates the combined view", () => {
    expect(migration).toMatch(
      /create (or replace )?view public\.leaderboard_combined_v/i,
    );
  });

  it("UNION ALLs the two score sources", () => {
    expect(viewBody()).toMatch(/union all/i);
  });

  it("reads from the legacy scores table", () => {
    expect(viewBody()).toMatch(/from public\.scores/i);
  });

  it("reads from the off-chain score_saves table (wallet as player)", () => {
    const body = viewBody();
    expect(body).toMatch(/from public\.score_saves/i);
    expect(body).toMatch(/wallet\s+as\s+player/i);
  });

  it("takes the best (MAX) score per player+level", () => {
    expect(viewBody()).toMatch(/max\(\s*score\s*\)/i);
  });

  it("sums best scores per player", () => {
    expect(viewBody()).toMatch(/sum\([\s\S]*?best_score[\s\S]*?\)/i);
  });

  it("ranks by total score desc then player asc", () => {
    expect(viewBody()).toMatch(/rank\(\) over \(order by/i);
  });

  it("derives is_verified from passport_cache, defaulting false", () => {
    const body = viewBody();
    expect(body).toMatch(/coalesce\(\s*pc\.is_verified\s*,\s*false\s*\)/i);
    expect(body).toMatch(/left join public\.passport_cache/i);
  });

  it("limits to the top 10", () => {
    expect(viewBody()).toMatch(/limit 10/i);
  });
});

describe("get_leaderboard() — reads the combined view", () => {
  it("is re-created with CREATE OR REPLACE", () => {
    expect(migration).toMatch(
      /create or replace function public\.get_leaderboard/i,
    );
  });

  it("returns the legacy 4-column shape", () => {
    const body = fnBody();
    expect(body).toMatch(/player\s+text/i);
    expect(body).toMatch(/total_score\s+int/i);
    expect(body).toMatch(/rank\s+int/i);
    expect(body).toMatch(/is_verified\s+boolean/i);
  });

  it("selects from leaderboard_combined_v (single source of truth)", () => {
    expect(fnBody()).toMatch(/from public\.leaderboard_combined_v/i);
  });
});

describe("leaderboard combined — isolation & safety guarantees", () => {
  it("NEVER issues DDL against the legacy leaderboard_v view", () => {
    // Prose comments may name `leaderboard_v`; what must never appear is a
    // statement targeting it (create/alter/drop on the qualified object).
    expect(migration).not.toMatch(/public\.leaderboard_v\b/i);
    expect(migration).not.toMatch(
      /(create|alter|drop)[\s\S]{0,30}?view\s+leaderboard_v\b/i,
    );
  });

  it("performs NO destructive DROP", () => {
    expect(migration).not.toMatch(/\bdrop\s+(table|view|function)\b/i);
  });

  it("performs NO data-mutating ALTER / TRUNCATE on scores", () => {
    expect(migration).not.toMatch(/alter table public\.scores\b/i);
    expect(migration).not.toMatch(/truncate/i);
  });
});
