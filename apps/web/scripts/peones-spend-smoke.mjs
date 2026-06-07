/**
 * Peones spend smoke — Sprint 4 commit H (2026-06-08).
 *
 * Runs against the HOSTED Supabase referenced in apps/web/.env.local.
 * Verifies the migration shipped in commit B and the RPC behaviour
 * locked in calibration §9.
 *
 * Usage:
 *   cd apps/web && node scripts/peones-spend-smoke.mjs
 *
 * Exits non-zero on any failure. Cleans up its own smoke rows.
 * SEPARATE from peones-smoke.mjs (Sprint 3 earn) so failure modes
 * stay isolated — do NOT merge the two.
 */

import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

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
    /* ignore */
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

const SMOKE_WALLET = "0x" + randomBytes(20).toString("hex");
const TODAY = new Date().toISOString().slice(0, 10);

let failures = 0;
function check(label, ok, details) {
  const tag = ok ? "✅" : "❌";
  console.log(`${tag} ${label}${details ? ` — ${details}` : ""}`);
  if (!ok) failures++;
}

function buildAttestationHash(payload) {
  const canonical = [
    payload.wallet,
    payload.event_type,
    String(payload.amount),
    payload.source,
    payload.source_id ?? "",
    payload.day_utc,
    payload.idempotency_key,
  ].join("|");
  const digest = createHash("sha256").update(canonical).digest("hex");
  return `sha256:${digest}`;
}

async function seedEarn(amount, suffix) {
  const idempotencyKey = `daily_tactic:${SMOKE_WALLET}:${TODAY}:smoke-spend-${suffix}`;
  const attestation = buildAttestationHash({
    wallet: SMOKE_WALLET,
    event_type: "earn",
    amount,
    source: "daily_tactic",
    source_id: `smoke-${suffix}`,
    day_utc: TODAY,
    idempotency_key: idempotencyKey,
  });
  const { error } = await supabase.from("peones_ledger").insert({
    wallet: SMOKE_WALLET,
    event_type: "earn",
    amount,
    source: "daily_tactic",
    source_id: `smoke-${suffix}`,
    idempotency_key: idempotencyKey,
    attestation_hash: attestation,
    metadata: { smoke: true },
    day_utc: TODAY,
  });
  if (error) throw new Error(`seed earn failed: ${error.message}`);
}

async function getBalance() {
  const { data, error } = await supabase
    .from("peones_balances")
    .select("balance")
    .eq("wallet", SMOKE_WALLET)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.balance ?? 0);
}

async function callSpendRpc({
  amount,
  target,
  targetId,
  idempotencyKey,
  applyProBypass = false,
}) {
  const attestation = buildAttestationHash({
    wallet: SMOKE_WALLET,
    event_type: "spend",
    amount,
    source: target,
    source_id: targetId,
    day_utc: TODAY,
    idempotency_key: idempotencyKey,
  });
  return supabase.rpc("peones_spend", {
    p_wallet: SMOKE_WALLET,
    p_amount: amount,
    p_target: target,
    p_target_id: targetId,
    p_idempotency_key: idempotencyKey,
    p_attestation_hash: attestation,
    p_metadata: { smoke: true },
    p_apply_pro_bypass: applyProBypass,
  });
}

async function cleanup() {
  await supabase.from("peones_ledger").delete().eq("wallet", SMOKE_WALLET);
}

async function main() {
  console.log(`smoke wallet: ${SMOKE_WALLET}`);
  console.log(`today_utc:    ${TODAY}\n`);

  // ── Schema introspection ────────────────────────────────────────
  {
    // Insert a dummy row + read it back to verify pro_bypass column is
    // readable. We immediately delete it.
    const probeKey = `daily_tactic:${SMOKE_WALLET}:${TODAY}:smoke-probe`;
    const probeAttestation = buildAttestationHash({
      wallet: SMOKE_WALLET,
      event_type: "earn",
      amount: 1,
      source: "daily_tactic",
      source_id: "probe",
      day_utc: TODAY,
      idempotency_key: probeKey,
    });
    const { error: insErr } = await supabase.from("peones_ledger").insert({
      wallet: SMOKE_WALLET,
      event_type: "earn",
      amount: 1,
      source: "daily_tactic",
      source_id: "probe",
      idempotency_key: probeKey,
      attestation_hash: probeAttestation,
      metadata: { smoke: true },
      day_utc: TODAY,
    });
    check("probe insert (legacy earn schema still works)", !insErr, insErr?.message);
    const { data: probeRow, error: selErr } = await supabase
      .from("peones_ledger")
      .select("pro_bypass")
      .eq("idempotency_key", probeKey)
      .maybeSingle();
    check(
      "pro_bypass column readable + defaults to false",
      !selErr && probeRow?.pro_bypass === false,
      selErr?.message ?? `value=${probeRow?.pro_bypass}`,
    );
  }

  // ── Spend RPC happy path ───────────────────────────────────────
  await seedEarn(5, "happy");
  const balBefore = await getBalance();
  check("balance after seeded earns is positive", balBefore >= 5, `balance=${balBefore}`);

  {
    const key = `spend:hint:${SMOKE_WALLET}:rook:r-1:1`;
    const { data, error } = await callSpendRpc({
      amount: 1,
      target: "hint",
      targetId: "rook:r-1:1",
      idempotencyKey: key,
    });
    const row = Array.isArray(data) ? data[0] : data;
    check(
      "happy spend hint amount=1 → debited=1 + duplicate=false + bypass=false",
      !error && row?.debited === 1 && row?.duplicate === false && row?.pro_bypass_applied === false,
      error?.message ?? JSON.stringify(row),
    );
    const balAfter = await getBalance();
    check(
      "balance decremented by 1 after hint spend",
      balAfter === balBefore - 1,
      `before=${balBefore} after=${balAfter}`,
    );
  }

  // ── Idempotent retry ──────────────────────────────────────────
  {
    const key = `spend:hint:${SMOKE_WALLET}:rook:r-1:1`;
    const balBeforeDup = await getBalance();
    const { data, error } = await callSpendRpc({
      amount: 1,
      target: "hint",
      targetId: "rook:r-1:1",
      idempotencyKey: key,
    });
    const row = Array.isArray(data) ? data[0] : data;
    check(
      "duplicate idempotency key → duplicate=true, balance unchanged",
      !error && row?.duplicate === true,
      error?.message ?? JSON.stringify(row),
    );
    const balAfterDup = await getBalance();
    check(
      "balance NOT decremented on duplicate",
      balAfterDup === balBeforeDup,
      `before=${balBeforeDup} after=${balAfterDup}`,
    );
  }

  // ── Insufficient balance ──────────────────────────────────────
  {
    const key = `spend:hint:${SMOKE_WALLET}:rook:r-1:big`;
    const { error } = await callSpendRpc({
      amount: 9999,
      target: "hint",
      targetId: "rook:r-1:big",
      idempotencyKey: key,
    });
    check(
      "insufficient_balance raises with errcode P0001 or message",
      Boolean(
        error &&
          (error.code === "P0001" ||
            (typeof error.message === "string" &&
              error.message.toLowerCase().includes("insufficient_balance"))),
      ),
      error?.message ?? "no error raised",
    );
  }

  // ── PRO bypass path ───────────────────────────────────────────
  {
    const balBeforeBypass = await getBalance();
    const key = `spend:coach:${SMOKE_WALLET}:smoke-bypass-game`;
    const { data, error } = await callSpendRpc({
      amount: 1,
      target: "coach",
      targetId: "smoke-bypass-game",
      idempotencyKey: key,
      applyProBypass: true,
    });
    const row = Array.isArray(data) ? data[0] : data;
    check(
      "bypass spend → debited=0 + pro_bypass_applied=true + duplicate=false",
      !error && row?.debited === 0 && row?.pro_bypass_applied === true && row?.duplicate === false,
      error?.message ?? JSON.stringify(row),
    );
    const balAfterBypass = await getBalance();
    check(
      "balance UNCHANGED after bypass (view excludes pro_bypass rows)",
      balAfterBypass === balBeforeBypass,
      `before=${balBeforeBypass} after=${balAfterBypass}`,
    );
    // Direct row inspection
    const { data: bypassRow, error: rowErr } = await supabase
      .from("peones_ledger")
      .select("amount, pro_bypass, event_type, source")
      .eq("idempotency_key", key)
      .maybeSingle();
    check(
      "bypass row in ledger: amount=1, pro_bypass=true, event_type=spend, source=coach",
      !rowErr &&
        bypassRow?.amount === 1 &&
        bypassRow?.pro_bypass === true &&
        bypassRow?.event_type === "spend" &&
        bypassRow?.source === "coach",
      rowErr?.message ?? JSON.stringify(bypassRow),
    );
  }

  // ── peones_balance_with_caps consistency ───────────────────────
  {
    const { data, error } = await supabase.rpc("peones_balance_with_caps", {
      p_wallet: SMOKE_WALLET,
      p_day_utc: TODAY,
    });
    const row = Array.isArray(data) ? data[0] : data;
    const directBal = await getBalance();
    check(
      "peones_balance_with_caps balance matches peones_balances view",
      !error && Number(row?.balance) === directBal,
      error?.message ?? `caps=${row?.balance} view=${directBal}`,
    );
  }

  await cleanup();
  console.log(`\n${failures === 0 ? "✅ all smoke checks passed" : `❌ ${failures} failures`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("smoke crashed:", err);
  await cleanup().catch(() => {});
  process.exit(1);
});
