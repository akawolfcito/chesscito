/**
 * API smoke against the local dev server pointed at hosted Supabase.
 * Sprint 3 commit J (2026-06-07).
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

async function earn(amount, suffix, source = "daily_tactic", sourceId = "smoke") {
  const idempotencyKey =
    source === "daily_tactic"
      ? `daily_tactic:${WALLET}:${TODAY}:${suffix}`
      : `training:${WALLET}:rook:${suffix}:0->${amount}`;
  const res = await fetch(`${ORIGIN}/api/peones/earn`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({
      wallet: WALLET,
      amount,
      source,
      sourceId,
      idempotencyKey,
    }),
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function balance() {
  const res = await fetch(
    `${ORIGIN}/api/peones/balance?wallet=${WALLET}`,
    { headers: { Origin: ORIGIN } },
  );
  const json = await res.json();
  return { status: res.status, json };
}

// 1. GET fresh balance
{
  const r = await balance();
  check(
    "GET balance fresh wallet → balance:0",
    r.status === 200 && r.json.balance === 0 && r.json.dailyCap === 10,
    JSON.stringify(r.json),
  );
}

// 2. POST earn +3 daily_tactic — first time
{
  const r = await earn(3, "puzzle-A");
  check(
    "POST earn daily_tactic +3 → credited:3",
    r.status === 200 && r.json.credited === 3 && r.json.capReached === false,
    `status=${r.status} credited=${r.json.credited} capReached=${r.json.capReached} hash=${r.json.attestationHash?.slice(0, 16)}…`,
  );
}

// 3. Idempotency: same payload again
{
  const r = await earn(3, "puzzle-A");
  check(
    "POST same idempotency_key → duplicate:true",
    r.status === 200 && r.json.duplicate === true && r.json.credited === 3,
    `status=${r.status} duplicate=${r.json.duplicate} credited=${r.json.credited}`,
  );
}

// 4. Balance reflects +3
{
  const r = await balance();
  check(
    "GET balance after +3 → balance:3 dailyEarnedCapped:3",
    r.status === 200 && r.json.balance === 3 && r.json.dailyEarnedCapped === 3,
    JSON.stringify(r.json),
  );
}

// 5. Drive cap close to limit (+5 more via daily_tactic with distinct keys)
{
  const r1 = await earn(3, "puzzle-B");
  const r2 = await earn(2, "puzzle-C");
  check(
    "POST earn +3 (puzzle-B) lands credited:3",
    r1.json.credited === 3 && r1.json.capReached === false,
    `credited=${r1.json.credited} dailyEarned=${r1.json.dailyEarnedCapped}`,
  );
  check(
    "POST earn +2 (puzzle-C) lands credited:2 exactly cap",
    r2.json.credited === 2 && r2.json.dailyEarnedCapped === 8,
    `credited=${r2.json.credited} dailyEarned=${r2.json.dailyEarnedCapped}`,
  );
}

// 6. Partial-cap: request 3 with only 2 headroom
{
  const r = await earn(3, "puzzle-D");
  check(
    "POST earn +3 with 2 headroom → credited:2 capReached:true",
    r.json.credited === 2 && r.json.capReached === true,
    `credited=${r.json.credited} capReached=${r.json.capReached}`,
  );
}

// 7. Cap exhausted: any further earn returns credited:0 + capReached
{
  const r = await earn(3, "puzzle-E");
  check(
    "POST earn after cap exhausted → credited:0 capReached:true",
    r.json.credited === 0 && r.json.capReached === true,
    `credited=${r.json.credited} capReached=${r.json.capReached} newBalance=${r.json.newBalance} ledgerId=${r.json.ledgerId}`,
  );
}

// 8. Non-daily source bypasses cap entirely (canonical call w/
//    explicit exercise_completion source + canonical idempotency key)
{
  const idempotencyKey = `training:${WALLET}:rook:rook-2:0->1`;
  const res = await fetch(`${ORIGIN}/api/peones/earn`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({
      wallet: WALLET,
      amount: 1,
      source: "exercise_completion",
      sourceId: "rook:rook-2",
      idempotencyKey,
    }),
  });
  const json = await res.json();
  check(
    "POST exercise_completion +1 → credited:1 ignores cap",
    res.status === 200 && json.credited === 1 && json.capReached === false,
    `status=${res.status} credited=${json.credited} capReached=${json.capReached} dailyEarned=${json.dailyEarnedCapped}`,
  );
}

// 9. EIP-55-style casing (lowercase 0x prefix, uppercase hex digits)
//    is the canonical way a wallet could arrive uppercased from a
//    consumer that didn't normalise. Endpoint must normalise to
//    lowercase before responding.
{
  const eip55 = "0x" + WALLET.slice(2).toUpperCase();
  const res = await fetch(
    `${ORIGIN}/api/peones/balance?wallet=${eip55}`,
    { headers: { Origin: ORIGIN } },
  );
  const json = await res.json();
  check(
    "GET EIP-55-cased wallet normalises to lowercase response",
    res.status === 200 && json.wallet === WALLET,
    `status=${res.status} returned=${json.wallet}`,
  );
}

console.log(`\n${failures === 0 ? "✅ ALL API SMOKE CHECKS PASSED" : `❌ ${failures} check(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
