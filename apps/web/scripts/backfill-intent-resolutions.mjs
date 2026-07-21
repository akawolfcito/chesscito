// One-shot: retroactively record the 5 intents that were expired with a direct
// PATCH on 2026-07-21, bypassing resolve_get_peones_legacy_intent.
//
// That RPC cannot be used here: it requires lifecycle_status in
// (CREATED, SUBMITTING) and these rows are already EXPIRED. It records a
// transition, it does not backfill one — correct design, wrong tool for this.
//
// So the rows go straight into the append-only audit table, labelled for what
// they actually are. The record must not imply the RPC ran.
//
// Authorized by the founder on 2026-07-21.
import { readFileSync } from "node:fs";

const IDS = [
  "d9351aa8-6f89-488f-b278-27547cbaec90",
  "82e5093f-6eb1-45bc-8d1e-5f08ddf690c1",
  "c76939e1-99b9-4af9-889d-bcc6cfb78326",
  "c1f7977a-da6a-4497-94f3-cd8a93338652",
  "90d31d3e-73ef-4ff8-bb64-b72e45b4b7fd",
];

const RESOLUTION_CODE = "RETROACTIVE_DIRECT_PATCH_UNBLOCK";
const EVIDENCE = "docs/audits/2026-07-20-payments-rail-gas-regression-diagnosis.md#2.3 - expired, tx_hash null, no Treasury transfer on-chain";
const ACTOR = "claude-code:session-2026-07-21";

const env = {};
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const headers = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};
const base = `${env.SUPABASE_URL}/rest/v1`;

// Guard: never record twice.
const existing = await (
  await fetch(`${base}/treasury_payment_intent_resolutions?select=intent_id&intent_id=in.(${IDS.join(",")})`, { headers })
).json();
if (Array.isArray(existing) && existing.length) {
  console.log(`Already recorded for ${existing.length} intent(s) — nothing to do.`);
  process.exit(0);
}

// Guard: only record what is actually true of these rows right now.
const rows = await (
  await fetch(`${base}/treasury_payment_intents?select=id,lifecycle_status,tx_hash&id=in.(${IDS.join(",")})`, { headers })
).json();
const bad = rows.filter((r) => r.lifecycle_status !== "EXPIRED" || r.tx_hash !== null);
if (rows.length !== IDS.length || bad.length) {
  console.error("ABORT: rows are not all EXPIRED with a null tx_hash.", bad);
  process.exit(1);
}

const res = await fetch(`${base}/treasury_payment_intent_resolutions`, {
  method: "POST",
  headers,
  body: JSON.stringify(
    IDS.map((id) => ({
      intent_id: id,
      previous_status: "SUBMITTING", // what they were before the direct PATCH
      new_status: "EXPIRED",
      resolution_code: RESOLUTION_CODE,
      evidence_ref: EVIDENCE,
      actor: ACTOR,
    })),
  ),
});

if (!res.ok) {
  console.error("FAILED:", res.status, (await res.text()).slice(0, 400));
  process.exit(1);
}

for (const r of await res.json()) {
  console.log(`recorded #${r.id}  ${r.intent_id}  ${r.previous_status} → ${r.new_status}  by ${r.actor}`);
}
