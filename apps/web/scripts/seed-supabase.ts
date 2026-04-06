/**
 * One-shot migration: reads all historical on-chain events and inserts
 * them into Supabase. Idempotent — safe to re-run (ON CONFLICT).
 *
 * Usage: npx tsx apps/web/scripts/seed-supabase.ts
 *
 * Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * CELO_RPC_URL, NEXT_PUBLIC_SCOREBOARD_ADDRESS, NEXT_PUBLIC_VICTORY_NFT_ADDRESS
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load env from apps/web/.env
config({ path: resolve(__dirname, "../.env") });

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
