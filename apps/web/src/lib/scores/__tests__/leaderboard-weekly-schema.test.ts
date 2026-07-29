/**
 * Slice 2A — weekly leaderboard schema guard.
 *
 * Spec: docs/specs/2026-07-29-leaders-weekly-db.md
 *
 * Text-based, like `score-attempts-schema.test.ts`, and for the same reason:
 * CI has no Postgres, so this catches drift at PR time while the behavioural
 * proof lives in `supabase/tests/leaderboard_weekly_smoke.sql` against a live
 * database.
 *
 * WHAT A TEXT GUARD CAN AND CANNOT CLAIM
 * --------------------------------------
 * It cannot prove that `anon` really lacks EXECUTE — Slice 3 found the opposite
 * of what its migration said, against a live Supabase, because Supabase's
 * default privileges grant explicitly on top of PUBLIC. What it CAN prove is
 * that the lines those guarantees depend on are still written down: both
 * revokes, the service_role grants, `security_invoker`, the index, and — the one
 * that decays silently — that the two RPCs still READ `weekly_ranking` instead
 * of growing their own copy of the window function.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

const migration = readFileSync(
  join(MIGRATIONS, "20260801000000_leaderboard_weekly.sql"),
  "utf-8",
);

/**
 * The migration with `--` comments removed.
 *
 * Presence and order assertions compare TEXT, and prose that names a function
 * counts as a match: the Slice 3 guard failed its first draft because a comment
 * explaining why a step does NOT call `consume_score_write_session` matched a
 * search for that call. A guard a comment can flip is not measuring the code.
 */
function code(): string {
  return migration
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

/** The body of one `create function`, up to the closing `$$;`. */
function functionBody(name: string): string {
  const src = code();
  const start = src.search(
    new RegExp(`create (or replace )?function public\\.${name}\\b`, "i"),
  );
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf("$$;", start);
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end);
}

describe("weekly leaderboard migration — shape", () => {
  it("creates the composite index the weekly aggregate needs", () => {
    // (created_at desc) alone forces a per-row surface filter — degrading
    // exactly as the feature succeeds.
    expect(code()).toMatch(
      /create index if not exists score_attempts_surface_created_idx\s+on public\.score_attempts \(surface, created_at desc\)/i,
    );
  });

  it("declares the three functions with the agreed signatures", () => {
    const src = code();
    expect(src).toMatch(
      /create (or replace )?function public\.weekly_ranking\(\s*p_surface\s+text,\s*p_week_start\s+timestamptz,\s*p_week_end\s+timestamptz\s*\)/i,
    );
    expect(src).toMatch(
      /create (or replace )?function public\.get_weekly_leaderboard\(\s*p_surface\s+text,\s*p_week_start\s+timestamptz,\s*p_week_end\s+timestamptz\s*\)/i,
    );
    expect(src).toMatch(
      /create (or replace )?function public\.get_weekly_player_rank\(\s*p_player\s+text,\s*p_surface\s+text,\s*p_week_start\s+timestamptz,\s*p_week_end\s+timestamptz\s*\)/i,
    );
  });

  it("returns `wallet`, never `player`, and never a has_onchain column", () => {
    const src = code();
    const returns = src.match(/returns table \([^)]*\)/gi) ?? [];
    expect(returns.length).toBe(3);
    for (const r of returns) {
      expect(r).toMatch(/wallet\s+text/i);
      expect(r).toMatch(/total_score\s+int/i);
      expect(r).toMatch(/rank\s+int/i);
      expect(r).toMatch(/is_verified\s+boolean/i);
      // Absent, not false: a present `has_onchain` makes exactly the claim the
      // parent spec's off-chain asymmetry forbids.
      expect(r).not.toMatch(/has_onchain/i);
      // The all-time relations call it `player`. This one must not, or the API
      // mapper reads undefined and derives a rowId from it.
      expect(r).not.toMatch(/\bplayer\b/i);
    }
  });
});

describe("weekly leaderboard migration — one ranking relation", () => {
  it("computes rank() exactly once, inside weekly_ranking", () => {
    // Three copies of one window function drift on the first change, and the
    // symptom is a footer rank that disagrees with the list.
    const occurrences = code().match(/rank\(\)\s+over/gi) ?? [];
    expect(occurrences.length).toBe(1);
    expect(functionBody("weekly_ranking")).toMatch(/rank\(\)\s+over/i);
  });

  it("orders by total_score, then who got there first, then wallet", () => {
    expect(functionBody("weekly_ranking")).toMatch(
      /order by[\s\S]*total_score\s+desc[\s\S]*total_achieved_at\s+asc[\s\S]*wallet\s+asc/i,
    );
  });

  it("derives achieved_at from the rows that TIE the level's best", () => {
    // A one-pass `min(created_at) group by (wallet, level_id)` compiles and is
    // wrong: it credits the player's first attempt on the level, including a bad
    // one. The join back to the attempts on `score = best_score` is the fix, and
    // it is invisible to any score-shaped assertion.
    const body = functionBody("weekly_ranking");
    expect(body).toMatch(/min\(\s*\w+\.created_at\s*\)/i);
    expect(body).toMatch(/\.score\s*=\s*\w+\.best_score/i);
  });

  it("filters by the surface and the half-open window", () => {
    const body = functionBody("weekly_ranking");
    expect(body).toMatch(/surface\s*=\s*p_surface/i);
    expect(body).toMatch(/created_at\s*>=\s*p_week_start/i);
    expect(body).toMatch(/created_at\s*<\s*p_week_end/i);
    // `<=` would put a Monday-00:00:00 attempt in two weeks at once.
    expect(body).not.toMatch(/created_at\s*<=\s*p_week_end/i);
  });

  it("reads score_attempts and nothing else", () => {
    const body = functionBody("weekly_ranking");
    expect(body).toMatch(/public\.score_attempts/i);
    expect(body).not.toMatch(/public\.score_saves/i);
    expect(body).not.toMatch(/from public\.scores\b/i);
  });

  it("makes both RPCs read weekly_ranking instead of re-deriving it", () => {
    expect(functionBody("get_weekly_leaderboard")).toMatch(
      /from public\.weekly_ranking\(\s*p_surface,\s*p_week_start,\s*p_week_end\s*\)/i,
    );
    expect(functionBody("get_weekly_player_rank")).toMatch(
      /from public\.weekly_ranking\(\s*p_surface,\s*p_week_start,\s*p_week_end\s*\)/i,
    );
  });

  it("cuts the board at 10 while the player rank stays uncut", () => {
    expect(functionBody("get_weekly_leaderboard")).toMatch(/limit 10/i);
    const playerRank = functionBody("get_weekly_player_rank");
    expect(playerRank).toMatch(/where\s+\w+\.wallet\s*=\s*p_player/i);
    expect(playerRank).not.toMatch(/limit/i);
  });
});

describe("weekly leaderboard migration — fallback view", () => {
  it("is created with security_invoker so RLS still applies", () => {
    // Defence in depth, not the control: without it the view runs as its OWNER
    // and bypasses score_attempts' deny-all RLS entirely.
    expect(code()).toMatch(
      /create (or replace )?view public\.leaderboard_weekly_full_v\s+with \(security_invoker\s*=\s*true\)/i,
    );
  });

  it("exposes surface as a column so the TS fallback can filter on it", () => {
    expect(code()).toMatch(/values \('learn'[\s\S]{0,40}'play'[\s\S]{0,40}\) \w+\(surface\)/i);
  });

  it("pins the computed window back to UTC", () => {
    // `now() at time zone 'utc'` yields a timestamp WITHOUT time zone; handing
    // that to a timestamptz parameter casts it through the database's TimeZone
    // setting, shifting the whole window on a non-UTC server. A test on a UTC
    // database cannot see it — hence the smoke's DB-22.
    const viewStart = code().search(/create (or replace )?view public\.leaderboard_weekly_full_v/i);
    expect(viewStart).toBeGreaterThan(-1);
    const view = code().slice(viewStart);
    const pinned =
      view.match(/date_trunc\('week', now\(\) at time zone 'utc'\)[\s\S]{0,60}?at time zone 'utc'/gi) ?? [];
    expect(pinned.length).toBe(2);
  });
});

describe("weekly leaderboard migration — privileges", () => {
  const FUNCTIONS = [
    "public.weekly_ranking(text, timestamptz, timestamptz)",
    "public.get_weekly_leaderboard(text, timestamptz, timestamptz)",
    "public.get_weekly_player_rank(text, text, timestamptz, timestamptz)",
  ];

  it.each(FUNCTIONS)("revokes execute on %s from public, anon AND authenticated", (fn) => {
    // BOTH are required and each alone is useless: Postgres grants EXECUTE to
    // PUBLIC by default, and Supabase's default privileges ALSO grant explicitly
    // to anon/authenticated, which a revoke from PUBLIC does not touch.
    const escaped = fn.replace(/[.()]/g, (c) => `\\${c}`);
    expect(code()).toMatch(
      new RegExp(`revoke execute on function ${escaped}\\s+from public, anon, authenticated`, "i"),
    );
  });

  it.each(FUNCTIONS)("grants execute on %s to service_role", (fn) => {
    const escaped = fn.replace(/[.()]/g, (c) => `\\${c}`);
    expect(code()).toMatch(
      new RegExp(`grant execute on function ${escaped}\\s+to service_role`, "i"),
    );
  });

  it("revokes select on the view from every client role", () => {
    expect(code()).toMatch(
      /revoke select\s+on public\.leaderboard_weekly_full_v\s+from public, anon, authenticated/i,
    );
    expect(code()).toMatch(
      /grant select\s+on public\.leaderboard_weekly_full_v\s+to service_role/i,
    );
  });
});

describe("weekly leaderboard migration — additive only", () => {
  it("touches no table and no all-time relation", () => {
    const src = code();
    expect(src).not.toMatch(/alter table/i);
    expect(src).not.toMatch(/drop table/i);
    expect(src).not.toMatch(/create table/i);
    // The all-time path is out of scope for this slice, by spec.
    expect(src).not.toMatch(/leaderboard_full_v|leaderboard_combined_v|get_leaderboard|get_player_rank/i);
  });
});
