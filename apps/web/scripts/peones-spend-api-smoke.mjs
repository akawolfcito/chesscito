/**
 * Peones spend API smoke against the local dev server pointed at
 * hosted Supabase. Sprint 4 commit H (2026-06-08).
 *
 * Pre-req: `pnpm dev` running on localhost:3000 with hosted Supabase
 *          env (apps/web/.env.local).
 *
 * Validates POST /api/peones/spend end-to-end. Earn endpoint is used
 * to seed balance; then spend validation paths are exercised.
 */

import { randomBytes } from "node:crypto";

const ORIGIN = "http://localhost:3000";
const TODAY = new Date().toISOString().slice(0, 10);
const WALLET = "0x" + randomBytes(20).toString("hex");

console.log(`WALLET: ${WALLET}`);
console.log(`TODAY:  ${TODAY}\n`);

let failures = 0;
function check(label, ok, details) {
  console.log(`${ok ? "✅" : "❌"} ${label}${details ? ` — ${details}` : ""}`);
  if (!ok) failures++;
}

async function earn(amount, suffix) {
  const idempotencyKey = `daily_tactic:${WALLET}:${TODAY}:${suffix}`;
  const res = await fetch(`${ORIGIN}/api/peones/earn`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({
      wallet: WALLET,
      amount,
      source: "daily_tactic",
      sourceId: suffix,
      idempotencyKey,
    }),
  });
  return { status: res.status, json: await res.json() };
}

async function spend(body) {
  const res = await fetch(`${ORIGIN}/api/peones/spend`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

// ── Seed balance ───────────────────────────────────────────────
const seed = await earn(3, "spend-smoke-1");
check(
  "seed earn 200 → credited:3",
  seed.status === 200 && seed.json.credited === 3,
  JSON.stringify(seed.json),
);

// ── 1. Hint happy path ─────────────────────────────────────────
{
  const r = await spend({
    wallet: WALLET,
    amount: 1,
    target: "hint",
    targetId: "rook:r-1:1",
    idempotencyKey: `spend:hint:${WALLET}:rook:r-1:1`,
    metadata: { piece: "rook", attemptSeq: 1, secret: "drop-me" },
  });
  check(
    "POST /spend hint 200 → debited:1, newBalance:2, proBypassApplied:false",
    r.status === 200 &&
      r.json.debited === 1 &&
      r.json.newBalance === 2 &&
      r.json.proBypassApplied === false &&
      typeof r.json.attestationHash === "string" &&
      r.json.attestationHash.startsWith("sha256:"),
    JSON.stringify(r.json),
  );
}

// ── 2. Duplicate retry ─────────────────────────────────────────
{
  const r = await spend({
    wallet: WALLET,
    amount: 1,
    target: "hint",
    targetId: "rook:r-1:1",
    idempotencyKey: `spend:hint:${WALLET}:rook:r-1:1`,
  });
  check(
    "duplicate idempotency → 200 duplicate:true, balance unchanged",
    r.status === 200 && r.json.duplicate === true && r.json.newBalance === 2,
    JSON.stringify(r.json),
  );
}

// ── 3. Insufficient balance ────────────────────────────────────
{
  // burn remaining 2 via hint cap, then 1 more should 409
  await spend({
    wallet: WALLET,
    amount: 1,
    target: "hint",
    targetId: "rook:r-1:2",
    idempotencyKey: `spend:hint:${WALLET}:rook:r-1:2`,
  });
  await spend({
    wallet: WALLET,
    amount: 1,
    target: "hint",
    targetId: "rook:r-1:3",
    idempotencyKey: `spend:hint:${WALLET}:rook:r-1:3`,
  });
  const r = await spend({
    wallet: WALLET,
    amount: 1,
    target: "hint",
    targetId: "rook:r-1:over",
    idempotencyKey: `spend:hint:${WALLET}:rook:r-1:over`,
  });
  check(
    "insufficient balance → 409 insufficient_balance",
    r.status === 409 && r.json.error === "insufficient_balance",
    JSON.stringify(r.json),
  );
}

// ── 4. Validation: amount mismatch ─────────────────────────────
{
  const r = await spend({
    wallet: WALLET,
    amount: 99,
    target: "hint",
    targetId: "rook:r-1:1",
    idempotencyKey: `spend:hint:${WALLET}:rook:r-1:1`,
  });
  check(
    "amount=99 for hint → 400 invalid_amount",
    r.status === 400 && r.json.error === "invalid_amount",
    JSON.stringify(r.json),
  );
}

// ── 5. Validation: unknown target ──────────────────────────────
{
  const r = await spend({
    wallet: WALLET,
    amount: 1,
    target: "labyrinth_key",
    targetId: "x",
    idempotencyKey: `spend:labyrinth_key:${WALLET}:x`,
  });
  check(
    "labyrinth_key target → 400 unknown_target (Sprint 5)",
    r.status === 400 && r.json.error === "unknown_target",
    JSON.stringify(r.json),
  );
}

// ── 6. Validation: bad idempotency prefix ──────────────────────
{
  const r = await spend({
    wallet: WALLET,
    amount: 1,
    target: "hint",
    targetId: "x",
    idempotencyKey: `spend:coach:${WALLET}:x`,
  });
  check(
    "hint target with coach prefix → 400 invalid_idempotency_key",
    r.status === 400 && r.json.error === "invalid_idempotency_key",
    JSON.stringify(r.json),
  );
}

// ── 7. Validation: client cannot force bypass ──────────────────
{
  // Re-seed first
  await earn(3, "spend-smoke-bypass-seed");
  const r = await spend({
    wallet: WALLET,
    amount: 1,
    target: "hint",
    targetId: "rook:r-1:client-bypass",
    idempotencyKey: `spend:hint:${WALLET}:rook:r-1:client-bypass`,
    applyProBypass: true, // ignored by server
  });
  check(
    "client applyProBypass:true → server ignores, debited=1 (not 0)",
    r.status === 200 && r.json.debited === 1 && r.json.proBypassApplied === false,
    JSON.stringify(r.json),
  );
}

// ── 8. Validation: bad wallet ──────────────────────────────────
{
  const r = await spend({
    wallet: "0xnotvalid",
    amount: 1,
    target: "hint",
    targetId: "x",
    idempotencyKey: `spend:hint:0xnotvalid:x`,
  });
  check(
    "invalid wallet → 400 invalid_wallet",
    r.status === 400 && r.json.error === "invalid_wallet",
    JSON.stringify(r.json),
  );
}

console.log(`\n${failures === 0 ? "✅ all api smoke checks passed" : `❌ ${failures} failures`}`);
process.exit(failures === 0 ? 0 : 1);
