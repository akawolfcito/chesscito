/**
 * Slice 3 etapa 4B — `score_attempts` + `save_score_attempt` schema guard.
 *
 * Spec: docs/specs/2026-07-28-attempt-identity-score-attempts.md (v7).
 *
 * Text-based, like `save-basic-score-schema.test.ts`, and for the same reason:
 * CI has no Postgres, so this catches drift at PR time and the behavioural
 * proof lives in `supabase/tests/score_attempts_smoke.sql` against a live DB.
 *
 * WHAT A TEXT GUARD CAN AND CANNOT CLAIM
 * --------------------------------------
 * It cannot prove the transaction rolls back — only the smoke can. What it CAN
 * prove is that the properties the rollback depends on are still written down:
 * the order of the steps, the lock taken before any session UPDATE, the reuse
 * of `save_basic_score` instead of a copy of its body, and the privilege
 * revocation. Every one of those is a line that a well-meaning edit can delete
 * without any test noticing.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { deriveScoreSaveId } from "../save-service";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

const migration = readFileSync(
  join(MIGRATIONS, "20260731000000_score_attempts.sql"),
  "utf-8",
);
const sessionsMigration = readFileSync(
  join(MIGRATIONS, "20260730000000_score_write_sessions.sql"),
  "utf-8",
);

/** The body of `save_score_attempt`, for scoped asserts. */
function rpcBody(): string {
  const start = migration.search(
    /create or replace function public\.save_score_attempt/i,
  );
  expect(start).toBeGreaterThan(-1);
  return migration.slice(start);
}

/**
 * The same body with `--` comments removed.
 *
 * Order assertions compare TEXT POSITIONS, and prose that names a function
 * counts as a match: the first draft of this guard failed because the comment
 * above step 1 mentions `consume_score_write_session` while explaining why that
 * step does not call it. A guard that a comment can flip is not measuring the
 * code. Statement order is a property of statements, so the comments go.
 */
function rpcCode(): string {
  return rpcBody().replace(/--[^\n]*/g, "");
}

/** Index of the first match, or -1. Used for ORDER assertions. */
function at(haystack: string, re: RegExp): number {
  return haystack.search(re);
}

describe("score_attempts table — columns and checks", () => {
  it("creates the table", () => {
    expect(migration).toMatch(/create table if not exists public\.score_attempts/i);
  });

  it("constrains the wallet to a lowercase 0x address", () => {
    expect(migration).toMatch(
      /wallet\s+text\s+not null check \(wallet ~ '\^0x\[0-9a-f\]\{40\}\$'\)/i,
    );
  });

  it("constrains surface to learn|play", () => {
    expect(migration).toMatch(
      /surface\s+text\s+not null check \(surface in \('learn','play'\)\)/i,
    );
  });

  it("constrains level_id between 1 and 6", () => {
    expect(migration).toMatch(
      /level_id\s+int\s+not null check \(level_id between 1 and 6\)/i,
    );
  });

  it("allows a NULL exercise_id, for a legacy bundle that sent none", () => {
    expect(migration).toMatch(
      /exercise_id\s+text\s+null check \(exercise_id is null or length\(exercise_id\) between 1 and 64\)/i,
    );
  });

  it("allows a NULL measure_kind, and otherwise the three grader kinds", () => {
    expect(migration).toMatch(
      /measure_kind\s+text null check \(measure_kind is null or measure_kind in \('moves','failures','coverage'\)\)/i,
    );
  });

  it("admits measure_value 0 — a run can honestly measure zero", () => {
    expect(migration).toMatch(
      /measure_value\s+int\s+null check \(measure_value is null or measure_value >= 0\)/i,
    );
  });

  it("requires a positive measure_ceiling when present", () => {
    expect(migration).toMatch(
      /measure_ceiling\s+int\s+null check \(measure_ceiling is null or measure_ceiling > 0\)/i,
    );
  });

  it("constrains grade_status to graded|starless|ungraded", () => {
    expect(migration).toMatch(
      /grade_status\s+text\s+not null check \(grade_status in \('graded','starless','ungraded'\)\)/i,
    );
  });

  it("admits stars_earned NULL and 0..3 — never 1..3", () => {
    // `between 1 and 3` would abort the insert AND the whole transaction on an
    // honest low run: labyrinthStars returns 0 above optimal+4, tourStars 0
    // below the pass line.
    expect(migration).toMatch(
      /stars_earned\s+int\s+null check \(stars_earned is null or stars_earned between 0 and 3\)/i,
    );
    expect(migration).not.toMatch(/stars_earned between 1 and 3/i);
  });

  it("requires a positive score and time_ms", () => {
    expect(migration).toMatch(/score\s+int\s+not null check \(score > 0\)/i);
    expect(migration).toMatch(/time_ms\s+int\s+not null check \(time_ms > 0\)/i);
  });

  it("constrains save_status, attempt_index and attempt_id_source", () => {
    expect(migration).toMatch(
      /save_status\s+text\s+not null check \(save_status in \('saved','duplicate'\)\)/i,
    );
    expect(migration).toMatch(
      /attempt_index\s+int\s+not null check \(attempt_index > 0\)/i,
    );
    expect(migration).toMatch(
      /attempt_id_source\s+text\s+not null check \(attempt_id_source in \('client','server'\)\)/i,
    );
  });

  it("declares both unique keys", () => {
    expect(migration).toMatch(/unique \(wallet, attempt_id\)/i);
    expect(migration).toMatch(/unique \(wallet, surface, level_id, attempt_index\)/i);
  });

  it("keeps grade_status and stars_earned coherent", () => {
    expect(migration).toMatch(/constraint score_attempts_grade_coherent check \(/i);
    const body = migration.slice(at(migration, /score_attempts_grade_coherent/i));
    expect(body).toMatch(/grade_status = 'graded' and stars_earned is not null/i);
    expect(body).toMatch(
      /grade_status in \('starless','ungraded'\) and stars_earned is null/i,
    );
  });

  it("keeps the measurement triple coherent", () => {
    expect(migration).toMatch(/constraint score_attempts_measure_coherent check \(/i);
    const body = migration.slice(at(migration, /score_attempts_measure_coherent/i));
    expect(body).toMatch(
      /measure_kind is null and measure_value is null and measure_ceiling is null/i,
    );
    expect(body).toMatch(
      /measure_kind in \('moves','failures'\) and measure_value is not null and measure_ceiling is null/i,
    );
    expect(body).toMatch(
      /measure_kind = 'coverage' and measure_value is not null and measure_ceiling is not null/i,
    );
  });

  it("creates exactly the two indexes the spec names", () => {
    expect(migration).toMatch(
      /create index if not exists score_attempts_created_idx\s+on public\.score_attempts \(created_at desc\)/i,
    );
    expect(migration).toMatch(
      /create index if not exists score_attempts_ordinal_idx\s+on public\.score_attempts \(wallet, surface, level_id, attempt_index desc\)/i,
    );
  });

  it("documents that measure_value carries three different quantities", () => {
    const comment = migration.match(
      /comment on column public\.score_attempts\.measure_value is\s+'([^']*)'/i,
    );
    expect(comment, "measure_value has no column comment").not.toBeNull();
    expect(comment![1]).toMatch(/moves/i);
    expect(comment![1]).toMatch(/failures/i);
    expect(comment![1]).toMatch(/reached/i);
  });

  it("documents that the Daily is not in this table", () => {
    const comment = migration.match(
      /comment on table public\.score_attempts is\s+'([^']*)'/i,
    );
    expect(comment, "score_attempts has no table comment").not.toBeNull();
    expect(comment![1]).toMatch(/daily/i);
  });

  it("denies direct client access", () => {
    expect(migration).toMatch(
      /alter table public\.score_attempts enable row level security/i,
    );
    expect(migration).toMatch(/to anon, authenticated/i);
  });
});

describe("save_score_attempt — signature", () => {
  it("declares the thirteen parameters of the spec, in order", () => {
    expect(migration).toMatch(
      /create or replace function public\.save_score_attempt\(\s*p_token_hash\s+text,\s*p_attempt_id\s+text,\s*p_attempt_id_source\s+text,\s*p_level_id\s+int,\s*p_score\s+int,\s*p_time_ms\s+int,\s*p_exercise_id\s+text,\s*p_measure_kind\s+text,\s*p_measure_value\s+int,\s*p_measure_ceiling\s+int,\s*p_grade_status\s+text,\s*p_stars_earned\s+int,\s*p_deployment_surface\s+text\s*\)/i,
    );
  });

  it("returns jsonb", () => {
    expect(rpcBody()).toMatch(/returns jsonb/i);
  });

  it("takes NO wallet parameter — the wallet comes from the session row", () => {
    const signature = migration.slice(
      at(migration, /create or replace function public\.save_score_attempt/i),
    );
    const params = signature.slice(0, signature.indexOf("returns jsonb"));
    expect(params).not.toMatch(/p_wallet/i);
  });
});

describe("save_score_attempt — the order the transaction depends on", () => {
  const body = rpcCode();

  it("takes the wallet advisory lock before consuming the session", () => {
    // Lock order is the invariant: the advisory lock precedes any
    // score_write_sessions UPDATE. `consume_score_write_session` IS that
    // UPDATE, so the lock must come first or two paths can deadlock.
    const lock = at(body, /pg_advisory_xact_lock/i);
    const consume = at(body, /consume_score_write_session/i);
    expect(lock).toBeGreaterThan(-1);
    expect(consume).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(consume);
  });

  it("looks a replay up before consuming anything", () => {
    // A replay consumes 0. If the consume came first, a retry of a failed POST
    // would spend a unit for a row that already exists.
    const replay = at(body, /from public\.score_attempts/i);
    const consume = at(body, /consume_score_write_session/i);
    expect(replay).toBeGreaterThan(-1);
    expect(replay).toBeLessThan(consume);
  });

  it("consumes before calling save_basic_score", () => {
    const consume = at(body, /consume_score_write_session/i);
    const save = at(body, /public\.save_basic_score\(/i);
    expect(save).toBeGreaterThan(-1);
    expect(consume).toBeLessThan(save);
  });

  it("computes attempt_index as max + 1, inside the lock", () => {
    expect(body).toMatch(/coalesce\(max\(attempt_index\),\s*0\)\s*\+\s*1/i);
    const lock = at(body, /pg_advisory_xact_lock/i);
    const index = at(body, /coalesce\(max\(attempt_index\)/i);
    expect(lock).toBeLessThan(index);
  });

  it("scopes attempt_index to (wallet, surface, level_id)", () => {
    const idx = body.slice(at(body, /coalesce\(max\(attempt_index\)/i));
    const where = idx.slice(0, idx.indexOf(";"));
    expect(where).toMatch(/wallet\s*=/i);
    expect(where).toMatch(/surface\s*=/i);
    expect(where).toMatch(/level_id\s*=/i);
  });
});

describe("save_score_attempt — replay", () => {
  const body = rpcCode();

  it("looks the replay up by wallet AND attempt_id", () => {
    // By attempt_id alone it would answer with another wallet's row — a
    // cross-wallet oracle. `unique (wallet, attempt_id)` is the same reasoning.
    const replay = body.slice(at(body, /from public\.score_attempts/i));
    const where = replay.slice(0, replay.indexOf(";"));
    expect(where).toMatch(/wallet\s*=/i);
    expect(where).toMatch(/attempt_id\s*=/i);
  });

  it("returns replayed true and never reaches the consume on that path", () => {
    const replay = body.slice(at(body, /from public\.score_attempts/i));
    const untilReturn = replay.slice(0, at(replay, /consume_score_write_session/i));
    expect(untilReturn).toMatch(/'replayed',\s*true/i);
    expect(untilReturn).toMatch(/\breturn\b/i);
  });

  it("serves the stored row's values, not recomputed ones", () => {
    const replay = body.slice(at(body, /from public\.score_attempts/i));
    const untilConsume = replay.slice(0, at(replay, /consume_score_write_session/i));
    for (const column of [
      "attempt_index",
      "stars_earned",
      "grade_status",
      "save_id",
      "save_status",
    ]) {
      expect(untilConsume, `replay does not serve stored ${column}`).toMatch(
        new RegExp(`\\.${column}`, "i"),
      );
    }
  });
});

describe("save_score_attempt — reuse, not reimplementation", () => {
  const body = rpcCode();

  it("calls save_basic_score", () => {
    expect(body).toMatch(/public\.save_basic_score\(/i);
  });

  it("NEVER inserts into score_saves itself", () => {
    // Copying the body is the failure this guards: two writers of one table,
    // drifting apart at the first change to either.
    expect(body).not.toMatch(/insert into public\.score_saves/i);
  });

  it("derives save_id exactly as deriveScoreSaveId does", () => {
    // TS ↔ SQL lockstep. The RPC has no p_save_id, so the derivation moved
    // into SQL, and a divergence would silently split one level's dedup key
    // into two.
    expect(deriveScoreSaveId("0xAB", 4, "120")).toBe("0xab:4:120");
    expect(body).toMatch(/lower\(/i);
    const derive = body.slice(at(body, /v_save_id\s*:=/i));
    const stmt = derive.slice(0, derive.indexOf(";"));
    expect(stmt).toMatch(/wallet/i);
    expect(stmt).toMatch(/p_level_id/i);
    expect(stmt).toMatch(/':'/);
  });

  it("passes the SESSION's surface to save_basic_score, not the caller's", () => {
    const call = body.slice(at(body, /public\.save_basic_score\(/i));
    const args = call.slice(0, call.indexOf(");"));
    expect(args).not.toMatch(/p_deployment_surface/i);
  });
});

describe("privileges — PUBLIC gets EXECUTE by default, so it must be revoked", () => {
  it("revokes execute on both functions from public", () => {
    expect(migration).toMatch(
      /revoke execute on function public\.save_score_attempt\([^)]*\)\s+from public/i,
    );
    expect(migration).toMatch(
      /revoke execute on function public\.save_basic_score\([^)]*\)\s+from public/i,
    );
  });

  it("grants execute to service_role only", () => {
    expect(migration).toMatch(
      /grant\s+execute on function public\.save_score_attempt\([^)]*\)\s+to service_role/i,
    );
    expect(migration).toMatch(
      /grant\s+execute on function public\.save_basic_score\([^)]*\)\s+to service_role/i,
    );
  });

  it("never grants to anon or authenticated", () => {
    const grants = migration.match(/grant\s+execute[^;]*;/gi) ?? [];
    expect(grants.length).toBeGreaterThan(0);
    for (const g of grants) {
      expect(g).not.toMatch(/\banon\b/i);
      expect(g).not.toMatch(/\bauthenticated\b/i);
    }
  });
});

describe("lock order — nothing else may take the wallet advisory lock", () => {
  it("the session migration takes no advisory lock at all", () => {
    // `/api/scores/authorize` must never take the wallet lock: it would invert
    // the order against the save path, which locks the wallet and then UPDATEs
    // score_write_sessions.
    expect(sessionsMigration).not.toMatch(/pg_advisory/i);
  });

  it("this migration takes the advisory lock in exactly one place", () => {
    const locks = migration.match(/pg_advisory_xact_lock/gi) ?? [];
    expect(locks).toHaveLength(1);
  });

  it("locks on the wallet, never on the token or the session id", () => {
    const body = rpcBody();
    const call = body.slice(at(body, /pg_advisory_xact_lock/i));
    const args = call.slice(0, call.indexOf(")"));
    expect(args).toMatch(/wallet/i);
    expect(args).not.toMatch(/token/i);
    expect(args).not.toMatch(/session_id/i);
  });
});
