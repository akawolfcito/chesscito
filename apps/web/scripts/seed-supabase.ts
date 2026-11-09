/**
 * One-shot migration: reads all historical on-chain events and inserts
 * them into Supabase. Idempotent — safe to re-run (ON CONFLICT).
 *
 * Usage: cd apps/web && npx tsx --tsconfig tsconfig.json scripts/seed-supabase.ts
 *
 * Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * CELO_RPC_URL, NEXT_PUBLIC_SCOREBOARD_ADDRESS, NEXT_PUBLIC_VICTORY_NFT_ADDRESS
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load env from apps/web/.env (no dotenv dependency needed)
const envPath = resolve(__dirname, "../.env");
try {
  const envFile = readFileSync(envPath, "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.warn("Could not read .env file at", envPath);
}

async function main() {
  // Dynamic import so env vars are loaded first
  const { runSync } = await import("../src/lib/server/sync-blockchain");

  console.log("Starting historical seed...");
  const result = await runSync();
  console.log("Seed complete:", result);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
