/**
 * SaveScore off-chain — Slice 1 schema guard.
 *
 * Parses the migration that ships `score_saves` + the atomic
 * `save_basic_score` RPC and asserts the contract approved in
 * docs/specs/savescore-offchain-peones.md (P0-closed revision):
 *
 *   1. New table `score_saves` with `save_id` UNIQUE NOT NULL, the
 *      per-wallet index, and the documented CHECK constraints.
 *   2. The `save_basic_score` RPC exists with the approved signature
 *      and returns jsonb.
 *   3. The paid path REUSES `peones_spend` (never a raw insert into
 *      `peones_ledger`), serialises per wallet via advisory lock, and
 *      catches the P0001 insufficient_balance to return
 *      `insufficient_peones` without inserting a row.
 *   4. The migration NEVER touches `scores` or `leaderboard_v`.
 *
 * Text-based (not a live DB call) on purpose — mirrors the Sprint 4
 * `spend-rpc-schema.test.ts` harness: catch drift at PR time without
 * spinning up Supabase. The behavioural SQL smoke (against local
 * supabase/Docker) is documented in the slice handoff.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { FREE_SCORE_SAVE_LIMIT } from "../save-service";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260609000000_score_saves_init.sql",
);

/** Economy recalibration 2026-06-10 (Slice C3) CREATE OR REPLACEs
 *  save_basic_score with c_free_limit 5 → 3. The lockstep guard below
 *  reads this forward migration so TS ↔ SQL can't drift. */
const QUOTA_RECALIBRATION_MIGRATION_PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260610020000_savescore_quota_recalibration.sql",
);

/** MiniPay Delivery Lote 2 (2026-07-08): off-chain save is ALWAYS FREE. The
 *  forward CREATE OR REPLACE removes the paid branch entirely — no peones_spend,
 *  no P0001 catch, no insufficient_peones, always mode='free'. This is the
 *  currently-live definition; the asserts below pin its shape. */
const ALWAYS_FREE_MIGRATION_PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260708120000_savescore_always_free.sql",
);

const migration = readFileSync(MIGRATION_PATH, "utf-8");
const quotaRecalibrationMigration = readFileSync(
  QUOTA_RECALIBRATION_MIGRATION_PATH,
  "utf-8",
);
const alwaysFreeMigration = readFileSync(ALWAYS_FREE_MIGRATION_PATH, "utf-8");

/** Isolate the body of the always-free save_basic_score for scoped asserts. */
function alwaysFreeRpcBody(): string {
  const startIdx = alwaysFreeMigration.search(
    /create or replace function public\.save_basic_score/i,
  );
  expect(startIdx).toBeGreaterThan(-1);
  return alwaysFreeMigration.slice(startIdx);
}

/** Isolate the body of the save_basic_score function for scoped asserts. */
function rpcBody(): string {
  const startIdx = migration.search(
    /create (or replace )?function public\.save_basic_score/i,
  );
  expect(startIdx).toBeGreaterThan(-1);
  return migration.slice(startIdx);
}

describe("score_saves table — migration shape", () => {
  it("creates the score_saves table", () => {
    expect(migration).toMatch(/create table public\.score_saves/i);
  });

  it("declares save_id text NOT NULL UNIQUE", () => {
    expect(migration).toMatch(/save_id\s+text\s+not null\s+unique/i);
  });

  it("declares wallet text NOT NULL", () => {
    expect(migration).toMatch(/wallet\s+text\s+not null/i);
  });

  it("constrains level_id between 1 and 6", () => {
    expect(migration).toMatch(/level_id\s+int\s+not null\s+check \(level_id between 1 and 6\)/i);
  });

  it("constrains score > 0", () => {
    expect(migration).toMatch(/score\s+int\s+not null\s+check \(score > 0\)/i);
  });

  it("constrains time_ms > 0", () => {
    expect(migration).toMatch(/time_ms\s+int\s+not null\s+check \(time_ms > 0\)/i);
  });

  it("declares game_id text NOT NULL", () => {
    expect(migration).toMatch(/game_id\s+text\s+not null/i);
  });

  it("constrains mode to free|peones", () => {
    expect(migration).toMatch(/mode\s+text\s+not null\s+check \(mode in \('free','peones'\)\)/i);
  });

  it("constrains peones_spent default 0 in (0,1)", () => {
    expect(migration).toMatch(
      /peones_spent\s+int\s+not null\s+default 0\s+check \(peones_spent in \(0,1\)\)/i,
    );
  });

  it("creates the per-wallet index", () => {
    expect(migration).toMatch(
      /create index score_saves_wallet_idx\s+on public\.score_saves \(wallet\)/i,
    );
  });
});

describe("save_basic_score RPC — migration shape", () => {
  it("declares save_basic_score with the approved signature", () => {
    expect(migration).toMatch(
      /create (or replace )?function public\.save_basic_score\([\s\S]*?p_save_id\s+text,[\s\S]*?p_wallet\s+text,[\s\S]*?p_level_id\s+int,[\s\S]*?p_score\s+int,[\s\S]*?p_time_ms\s+int,[\s\S]*?p_game_id\s+text,[\s\S]*?p_attestation_hash\s+text,[\s\S]*?p_metadata\s+jsonb default null[\s\S]*?\)/i,
    );
  });

  it("returns jsonb", () => {
    const body = rpcBody();
    expect(body).toMatch(/returns jsonb/i);
  });

  it("serialises per wallet via advisory lock", () => {
    const body = rpcBody();
    expect(body).toMatch(/pg_advisory_xact_lock\(\s*hashtext\(\s*lower\(/i);
  });

  it("reuses peones_spend for the paid path", () => {
    const body = rpcBody();
    expect(body).toMatch(/public\.peones_spend\(/i);
  });

  it("passes p_attestation_hash through to the spend", () => {
    const body = rpcBody();
    // The attestation hash param must appear in the peones_spend call args.
    expect(body).toMatch(/peones_spend\([\s\S]*?p_attestation_hash[\s\S]*?\)/i);
  });

  it("NEVER inserts raw into peones_ledger (reuse, not replicate)", () => {
    const body = rpcBody();
    expect(body).not.toMatch(/insert into public\.peones_ledger/i);
  });

  it("catches the P0001 insufficient_balance from peones_spend", () => {
    const body = rpcBody();
    expect(body).toMatch(/when sqlstate 'P0001'/i);
  });

  it("returns insufficient_peones on the caught insufficiency", () => {
    const body = rpcBody();
    expect(body).toMatch(/'?insufficient_peones'?/i);
  });

  it("returns a duplicate status when save_id already exists", () => {
    const body = rpcBody();
    expect(body).toMatch(/'?duplicate'?/i);
  });

  it("builds the save_game idempotency key as spend:save_game:{saveId}", () => {
    const body = rpcBody();
    expect(body).toMatch(/spend:save_game:/i);
  });

  it("uses the save_game spend target", () => {
    const body = rpcBody();
    expect(body).toMatch(/'save_game'/i);
  });
});

describe("save_basic_score migration — isolation guarantees", () => {
  it("does NOT alter the legacy scores table", () => {
    expect(migration).not.toMatch(/alter table public\.scores\b/i);
    // The whole migration must not reference the legacy `scores` table.
    expect(migration).not.toMatch(/\bpublic\.scores\b/i);
  });

  it("does NOT alter the leaderboard_v view", () => {
    expect(migration).not.toMatch(/leaderboard_v/i);
  });
});

describe("save_basic_score quota recalibration (Slice C3) — TS↔SQL lockstep", () => {
  it("the recalibration migration re-creates save_basic_score", () => {
    expect(quotaRecalibrationMigration).toMatch(
      /create or replace function public\.save_basic_score/i,
    );
  });

  it("c_free_limit in the recalibration migration matches FREE_SCORE_SAVE_LIMIT", () => {
    const m = quotaRecalibrationMigration.match(
      /c_free_limit\s+constant\s+int\s*:=\s*(\d+)/i,
    );
    expect(m, "Could not find c_free_limit in the recalibration migration").not.toBeNull();
    expect(Number(m![1])).toBe(FREE_SCORE_SAVE_LIMIT);
    expect(Number(m![1])).toBe(3);
  });

  it("reuses peones_spend (no raw ledger insert) — same atomic contract", () => {
    expect(quotaRecalibrationMigration).toMatch(/public\.peones_spend\(/i);
    expect(quotaRecalibrationMigration).not.toMatch(/insert into public\.peones_ledger/i);
  });
});

describe("save_basic_score ALWAYS-FREE (MiniPay Lote 2) — live definition", () => {
  it("re-creates save_basic_score with the approved signature", () => {
    expect(alwaysFreeMigration).toMatch(
      /create or replace function public\.save_basic_score\([\s\S]*?p_save_id\s+text,[\s\S]*?p_wallet\s+text,[\s\S]*?p_attestation_hash\s+text,[\s\S]*?p_metadata\s+jsonb default null[\s\S]*?\)/i,
    );
  });

  it("keeps the per-wallet advisory lock + duplicate guard", () => {
    const body = alwaysFreeRpcBody();
    expect(body).toMatch(/pg_advisory_xact_lock\(\s*hashtext\(\s*lower\(/i);
    expect(body).toMatch(/'?duplicate'?/i);
  });

  it("NEVER calls peones_spend (the save_game sink never fires)", () => {
    const body = alwaysFreeRpcBody();
    expect(body).not.toMatch(/public\.peones_spend\(/i);
  });

  it("has NO paid branch — no P0001 catch, no insufficient_peones", () => {
    const body = alwaysFreeRpcBody();
    expect(body).not.toMatch(/when sqlstate 'P0001'/i);
    expect(body).not.toMatch(/insufficient_peones/i);
  });

  it("always inserts mode='free', peones_spent=0", () => {
    const body = alwaysFreeRpcBody();
    // The only score_saves insert must be the free one.
    expect(body).toMatch(/'free',\s*0/);
    expect(body).not.toMatch(/'peones',\s*c_cost/i);
  });

  it("never inserts raw into peones_ledger", () => {
    const body = alwaysFreeRpcBody();
    expect(body).not.toMatch(/insert into public\.peones_ledger/i);
  });

  it("does NOT touch the legacy scores table or leaderboard_v", () => {
    expect(alwaysFreeMigration).not.toMatch(/\bpublic\.scores\b/i);
    expect(alwaysFreeMigration).not.toMatch(/leaderboard_v/i);
  });
});
