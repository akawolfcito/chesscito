// Read-only diagnostic: dump recent analytics_events for the payments/mint
// investigation (docs/audits/2026-07-20-payments-rail-gas-regression-diagnosis.md).
// Never prints credentials. Delete after use.
import { readFileSync } from "node:fs";

const envPath = new URL("../.env", import.meta.url);
const env = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("missing supabase config in .env");
  process.exit(1);
}

const qs = new URLSearchParams({
  select: "*",
  order: "created_at.desc",
  limit: "80",
});

const res = await fetch(`${url}/rest/v1/analytics_events?${qs}`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});

if (!res.ok) {
  console.error("query failed:", res.status, (await res.text()).slice(0, 300));
  process.exit(1);
}

const rows = await res.json();
console.log(`rows: ${rows.length}`);
for (const r of rows) {
  const ts = r.created_at ?? r.inserted_at ?? "?";
  console.log(`\n${ts}  ${r.event}`);
  if (r.props && Object.keys(r.props).length) {
    console.log("   " + JSON.stringify(r.props));
  }
}
