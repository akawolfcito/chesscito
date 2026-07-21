// Read-only: every intent still matching the 409 deadlock filter, across ALL
// wallets. Tells us who else is locked out of buying Peones.
// Never prints credentials. Wallets are truncated.
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const qs =
  "select=id,wallet,created_at,expires_at,lifecycle_status,tx_hash,last_error_code" +
  "&lifecycle_status=in.(SUBMITTING,SUBMITTED)&retry_safe=eq.false&order=created_at.desc";

const res = await fetch(`${env.SUPABASE_URL}/rest/v1/treasury_payment_intents?${qs}`, {
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
});
if (!res.ok) {
  console.error("query failed:", res.status, (await res.text()).slice(0, 300));
  process.exit(1);
}

const rows = await res.json();

// Mirror the SHIPPED rule from route.ts, not the pre-fix one: an intent blocks
// only while there is something to reconcile — it has a tx_hash, or it has not
// expired yet. Listing raw lifecycle matches would report long-dead rows as
// "locked out" and make the fix look broken.
const now = Date.now();
const blocks = (r) => {
  const exp = Date.parse(r.expires_at ?? "");
  return r.tx_hash != null || !Number.isFinite(exp) || exp > now;
};

const blocking = rows.filter(blocks);
const released = rows.filter((r) => !blocks(r));
const short = (w) => `${w.slice(0, 8)}…${w.slice(-4)}`;

console.log(`Rows with an unresolved lifecycle: ${rows.length}`);
console.log(`  → STILL BLOCKING: ${blocking.length} (${new Set(blocking.map((r) => r.wallet)).size} wallets)`);
console.log(`  → released by expiry: ${released.length} (${new Set(released.map((r) => r.wallet)).size} wallets)\n`);

for (const r of blocking) {
  console.log(`BLOCKING  ${short(r.wallet)}  ${r.created_at}  expires=${r.expires_at}  tx=${r.tx_hash ? "YES" : "null"}  err=${r.last_error_code}`);
}
for (const r of released) {
  console.log(`released  ${short(r.wallet)}  ${r.created_at}  expired=${r.expires_at}  err=${r.last_error_code}`);
}
