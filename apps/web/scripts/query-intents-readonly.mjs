// Read-only diagnostic: dump treasury_payment_intents for the Get Peones
// 409 deadlock investigation. Never prints credentials. Delete after use.
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const res = await fetch(
  `${env.SUPABASE_URL}/rest/v1/treasury_payment_intents?select=*&order=created_at.desc&limit=10`,
  { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } },
);

if (!res.ok) {
  console.error("query failed:", res.status, (await res.text()).slice(0, 300));
  process.exit(1);
}

for (const r of await res.json()) {
  console.log(`\n--- ${r.id}`);
  console.log(`  created_at  : ${r.created_at}`);
  console.log(`  expires_at  : ${r.expires_at}`);
  console.log(`  lifecycle   : ${r.lifecycle_status}`);
  console.log(`  retry_safe  : ${r.retry_safe}`);
  console.log(`  tx_hash     : ${r.tx_hash}`);
  console.log(`  last_error  : ${r.last_error_code}`);
  console.log(`  sku         : ${r.sku}`);
  if (r.diagnostics) console.log(`  diagnostics : ${JSON.stringify(r.diagnostics)}`);
}
