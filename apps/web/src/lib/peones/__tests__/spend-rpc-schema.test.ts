/**
 * Sprint 4 commit B — spend RPC schema guard.
 *
 * Parses the migration shipped in commit B and asserts the key
 * contracts documented in the calibration §9.2:
 *
 *   1. The `pro_bypass` column is added with NOT NULL DEFAULT false.
 *   2. The balance view + cap-aware helper exclude pro_bypass = true
 *      spend rows from balance derivation.
 *   3. The `peones_spend` RPC exists with the documented signature
 *      and ordering (idempotency → bypass → balance check → insert).
 *
 * The guard is text-based (not a live DB call) on purpose — the
 * point is to catch drift between calibration and migration at PR
 * time without spinning up Supabase. Sprint 4 commit C will add
 * behavioural tests once the endpoint is wired.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260608000000_peones_spend_rpc.sql",
);

const migration = readFileSync(MIGRATION_PATH, "utf-8");

describe("peones_spend RPC — migration shape", () => {
  it("adds pro_bypass column with NOT NULL DEFAULT false", () => {
    expect(migration).toMatch(
      /add column pro_bypass boolean not null default false/i,
    );
  });

  it("creates a partial index for daily PRO quota tracking", () => {
    expect(migration).toMatch(
      /create index peones_ledger_pro_bypass_quota_idx[\s\S]*?where pro_bypass = true/i,
    );
  });

  it("balance view excludes pro_bypass spend rows from balance derivation", () => {
    expect(migration).toMatch(
      /create or replace view public\.peones_balances/i,
    );
    expect(migration).toMatch(
      /event_type = 'spend' and pro_bypass = false\s+then -amount/i,
    );
  });

  it("cap-aware helper excludes pro_bypass spend rows too", () => {
    expect(migration).toMatch(
      /create or replace function public\.peones_balance_with_caps/i,
    );
    // Slice the migration at the helper declaration and at the next
    // top-level `create` to isolate the helper's body, then assert
    // the pro_bypass exclusion lives inside it.
    const startIdx = migration.search(
      /create or replace function public\.peones_balance_with_caps/i,
    );
    expect(startIdx).toBeGreaterThan(-1);
    const after = migration.slice(startIdx);
    const nextCreateIdx = after.slice(1).search(/\n\s*create\s+/i);
    const helperSlice =
      nextCreateIdx === -1 ? after : after.slice(0, nextCreateIdx + 1);
    expect(helperSlice).toMatch(
      /event_type = 'spend' and pro_bypass = false\s+then -amount/i,
    );
  });

  it("declares peones_spend with the documented signature", () => {
    expect(migration).toMatch(
      /create function public\.peones_spend\([\s\S]*?p_wallet\s+text,[\s\S]*?p_amount\s+integer,[\s\S]*?p_target\s+text,[\s\S]*?p_target_id\s+text,[\s\S]*?p_idempotency_key\s+text,[\s\S]*?p_attestation_hash\s+text,[\s\S]*?p_metadata\s+jsonb,[\s\S]*?p_apply_pro_bypass\s+boolean default false[\s\S]*?\)/i,
    );
  });

  it("returns the documented row shape", () => {
    expect(migration).toMatch(
      /returns table \(\s*ledger_id\s+bigint,\s*debited\s+integer,\s*new_balance\s+bigint,\s*duplicate\s+boolean,\s*pro_bypass_applied\s+boolean\s*\)/i,
    );
  });

  it("performs idempotency check BEFORE balance check", () => {
    const idemIdx = migration.search(
      /from public\.peones_ledger\s+where idempotency_key = p_idempotency_key/i,
    );
    const balanceIdx = migration.search(
      /if v_current_balance < v_actual_debit then/i,
    );
    expect(idemIdx).toBeGreaterThan(-1);
    expect(balanceIdx).toBeGreaterThan(-1);
    expect(idemIdx).toBeLessThan(balanceIdx);
  });

  it("only performs the balance check when debited > 0", () => {
    expect(migration).toMatch(
      /if v_actual_debit > 0 then[\s\S]*?for update;[\s\S]*?if v_current_balance < v_actual_debit then/i,
    );
  });

  it("raises insufficient_balance with errcode P0001", () => {
    expect(migration).toMatch(
      /raise exception 'insufficient_balance' using errcode = 'P0001'/i,
    );
  });

  it("inserts event_type='spend' with amount > 0 preserved", () => {
    expect(migration).toMatch(
      /insert into public\.peones_ledger[\s\S]*?'spend',\s*p_amount,/i,
    );
  });

  it("never permits negative balance: spend amount stays positive + view subtracts conditionally", () => {
    // Sprint 3 CHECK (amount > 0) stays untouched: confirm we never
    // attempt to insert a non-positive amount in this migration.
    expect(migration).not.toMatch(/amount\s*=\s*0/i);
    expect(migration).not.toMatch(/amount\s*<\s*0/i);
  });
});
