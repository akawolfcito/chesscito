/**
 * Peones ledger smoke — Sprint 3 commit J (2026-06-07).
 *
 * Runs against the HOSTED Supabase referenced in apps/web/.env.local.
 * Read-only DB introspection + ledger smoke through the service-role
 * client. NEVER touches the prod tables that don't belong to Peones.
 *
 * Usage:
 *   cd apps/web && node --env-file=.env.local scripts/peones-smoke.mjs
 *
 * Exits non-zero on any failure.
 */

import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

// Local env loader — reads apps/web/.env.local directly so we don't
// need to expose the path on the shell command line.
function loadLocalEnv() {
  try {
    const raw = readFileSync("./.env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const k = trimmed.slice(0, eq).trim();
      let v = trimmed.slice(eq + 1).trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    // ignore — env may be set externally
  }
}
loadLocalEnv();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

// Generate a fresh smoke wallet so we don't collide with anything.
const SMOKE_WALLET = "0x" + randomBytes(20).toString("hex");
const TODAY = new Date().toISOString().slice(0, 10);

let failures = 0;
function check(label, ok, details) {
  const tag = ok ? "✅" : "❌";
  console.log(`${tag} ${label}${details ? ` — ${details}` : ""}`);
  if (!ok) failures++;
}

function makeIdempotencyKey(suffix) {
  return `daily_tactic:${SMOKE_WALLET}:${TODAY}:smoke-${suffix}`;
}

function makeAttestationHash(payload) {
  const canonical = [
    payload.wallet,
    payload.event_type,
    payload.amount,
    payload.source,
    payload.source_id ?? "",
    payload.day_utc,
    payload.idempotency_key,
  ].join("|");
  return "sha256:" + createHash("sha256").update(canonical).digest("hex");
}

console.log(`\nSMOKE WALLET: ${SMOKE_WALLET}`);
console.log(`TODAY UTC:    ${TODAY}\n`);

// ── 1. Verify table + view + function exist ───────────────────────
{
  const { error } = await supabase.from("peones_ledger").select("id").limit(1);
  check("peones_ledger table reachable", !error, error?.message);
}
{
  const { error } = await supabase.from("peones_balances").select("wallet").limit(1);
  check("peones_balances view reachable", !error, error?.message);
}
{
  const { data, error } = await supabase.rpc("peones_balance_with_caps", {
    p_wallet: SMOKE_WALLET,
    p_day_utc: TODAY,
  });
  const row = Array.isArray(data) ? data[0] : data;
  check(
    "peones_balance_with_caps fn reachable",
    !error,
    error?.message,
  );
  check(
    "fresh wallet returns balance=0 daily=0 cap=10",
    row && Number(row.balance) === 0 && Number(row.daily_earned_capped) === 0 && Number(row.daily_cap) === 10,
    row ? `balance=${row.balance} daily=${row.daily_earned_capped} cap=${row.daily_cap}` : "no row",
  );
}

// ── 2. Insert a daily_tactic earn row (credited 3, fresh) ─────────
{
  const idempotency_key = makeIdempotencyKey("first");
  const payload = {
    wallet: SMOKE_WALLET,
    event_type: "earn",
    amount: 3,
    source: "daily_tactic",
    source_id: "smoke-dt-1",
    idempotency_key,
    day_utc: TODAY,
  };
  const attestation_hash = makeAttestationHash(payload);
  const { error } = await supabase
    .from("peones_ledger")
    .insert({ ...payload, attestation_hash });
  check("INSERT earn daily_tactic +3", !error, error?.message);
}

// ── 3. Idempotency: same key → unique violation ───────────────────
{
  const idempotency_key = makeIdempotencyKey("first");
  const payload = {
    wallet: SMOKE_WALLET,
    event_type: "earn",
    amount: 3,
    source: "daily_tactic",
    source_id: "smoke-dt-1",
    idempotency_key,
    day_utc: TODAY,
  };
  const attestation_hash = makeAttestationHash(payload);
  const { error } = await supabase
    .from("peones_ledger")
    .insert({ ...payload, attestation_hash });
  check(
    "duplicate idempotency_key blocked by unique index (23505)",
    error?.code === "23505",
    error ? `code=${error.code}` : "no error — UNIQUE INDEX NOT WORKING",
  );
}

// ── 4. amount=0 should fail CHECK constraint ──────────────────────
{
  const payload = {
    wallet: SMOKE_WALLET,
    event_type: "earn",
    amount: 0,
    source: "daily_tactic",
    source_id: "smoke-zero",
    idempotency_key: makeIdempotencyKey("zero"),
    day_utc: TODAY,
  };
  const attestation_hash = makeAttestationHash(payload);
  const { error } = await supabase
    .from("peones_ledger")
    .insert({ ...payload, attestation_hash });
  check(
    "amount=0 rejected by CHECK constraint",
    !!error,
    error ? `code=${error.code}` : "NO ERROR — CHECK CONSTRAINT MISSING",
  );
}

// ── 5. Uppercase wallet rejected by regex check ───────────────────
{
  const badWallet = SMOKE_WALLET.toUpperCase();
  const payload = {
    wallet: badWallet,
    event_type: "earn",
    amount: 1,
    source: "daily_tactic",
    source_id: "smoke-case",
    idempotency_key: makeIdempotencyKey("case"),
    day_utc: TODAY,
  };
  const attestation_hash = makeAttestationHash(payload);
  const { error } = await supabase
    .from("peones_ledger")
    .insert({ ...payload, attestation_hash });
  check(
    "uppercase wallet rejected by regex CHECK",
    !!error,
    error ? `code=${error.code}` : "NO ERROR — WALLET CHECK MISSING",
  );
}

// ── 6. Cap-aware function returns updated numbers ─────────────────
{
  const { data, error } = await supabase.rpc("peones_balance_with_caps", {
    p_wallet: SMOKE_WALLET,
    p_day_utc: TODAY,
  });
  const row = Array.isArray(data) ? data[0] : data;
  check(
    "balance_with_caps reflects the +3 earn",
    row && Number(row.balance) === 3 && Number(row.daily_earned_capped) === 3,
    row ? `balance=${row.balance} daily=${row.daily_earned_capped}` : "no row",
  );
}

// ── 7. peones_balances view reflects the new row ─────────────────
{
  const { data, error } = await supabase
    .from("peones_balances")
    .select("wallet, balance, event_count")
    .eq("wallet", SMOKE_WALLET)
    .maybeSingle();
  check(
    "peones_balances view shows balance=3 event_count=1",
    data && Number(data.balance) === 3 && Number(data.event_count) === 1,
    data ? `balance=${data.balance} count=${data.event_count}` : error?.message ?? "no row",
  );
}

// ── 8. Drive a non-daily source (exercise_completion) — cap unaffected
{
  const idempotency_key = `training:${SMOKE_WALLET}:rook:rook-smoke:0->2`;
  const payload = {
    wallet: SMOKE_WALLET,
    event_type: "earn",
    amount: 2,
    source: "exercise_completion",
    source_id: "rook:rook-smoke",
    idempotency_key,
    day_utc: TODAY,
  };
  const attestation_hash = makeAttestationHash(payload);
  const { error } = await supabase
    .from("peones_ledger")
    .insert({ ...payload, attestation_hash });
  check("INSERT earn exercise_completion +2", !error, error?.message);

  const { data } = await supabase.rpc("peones_balance_with_caps", {
    p_wallet: SMOKE_WALLET,
    p_day_utc: TODAY,
  });
  const row = Array.isArray(data) ? data[0] : data;
  check(
    "exercise_completion lifts balance but NOT daily_earned_capped",
    row && Number(row.balance) === 5 && Number(row.daily_earned_capped) === 3,
    row ? `balance=${row.balance} daily=${row.daily_earned_capped}` : "no row",
  );
}

// ── 9. Clean up smoke rows so we don't pollute analytics ──────────
{
  const { error } = await supabase
    .from("peones_ledger")
    .delete()
    .eq("wallet", SMOKE_WALLET);
  check("cleanup smoke rows", !error, error?.message);
}

console.log(`\n${failures === 0 ? "✅ ALL SMOKE CHECKS PASSED" : `❌ ${failures} check(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
