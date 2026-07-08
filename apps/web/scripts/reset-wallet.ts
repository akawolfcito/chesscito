/**
 * Dev/QA utility: reset a wallet's off-chain state for manual testing.
 *
 * Default scope RE-ENABLES PURCHASE of PRO + Season Pass by clearing the
 * active entitlement state (Redis) + the Supabase season-pass row. A fresh
 * purchase uses a NEW tx hash, so the per-tx dedupe keys never block it —
 * deleting the ACTIVE state is all that's needed to buy both again.
 *
 * `--full` additionally wipes the complete new-user surface (Peones, score
 * saves, welcome pack, shields, Coach history) so the wallet looks brand new.
 *
 * SAFE BY DEFAULT: prints a dry-run plan and does NOTHING unless you pass
 * `--commit`. On-chain badges + Victory NFTs are immutable and NOT touched.
 *
 * Usage (from apps/web):
 *   npx tsx --tsconfig tsconfig.json scripts/reset-wallet.ts 0xWALLET            # dry-run, PRO+Pass scope
 *   npx tsx --tsconfig tsconfig.json scripts/reset-wallet.ts 0xWALLET --commit   # execute PRO+Pass reset
 *   npx tsx --tsconfig tsconfig.json scripts/reset-wallet.ts 0xWALLET --full --commit  # full new-user wipe
 *
 * Env (apps/web/.env.local or .env):
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, SUPABASE_URL,
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * NOTE: clears SERVER state only. For localStorage, open /dev/reset in the
 * browser/MiniPay webview and tap "Wipe local progress", then reload.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  for (const fname of [".env.local", ".env"]) {
    const envPath = resolve(__dirname, "..", fname);
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
      // file missing — try the next one
    }
  }
}

loadEnv();

type RedisClient = import("@upstash/redis").Redis;

async function scanKeys(redis: RedisClient, pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";
  do {
    const [next, batch] = await redis.scan(cursor, { match: pattern, count: 100 });
    cursor = next;
    keys.push(...batch);
  } while (cursor !== "0");
  return keys;
}

async function main() {
  const args = process.argv.slice(2);
  const wallet = args[0];
  const full = args.includes("--full");
  const commit = args.includes("--commit");

  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    console.error("Usage: npx tsx scripts/reset-wallet.ts 0xWALLET [--full] [--commit]");
    console.error("  (dry-run unless --commit; default scope = PRO + Season Pass re-purchase)");
    process.exit(1);
  }

  const missing = [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env: ${missing.join(", ")}. Add them to apps/web/.env.local.`);
    process.exit(1);
  }

  const lower = wallet.toLowerCase();

  // ── Build the plan ────────────────────────────────────────────────
  // PRO + Pass scope (default): clears active entitlements so both can be
  // purchased again.
  const redisExact: string[] = [
    `coach:pro:${lower}`,          // PRO active pass
    `lite:season-pass:${lower}`,   // Season Pass active flag
  ];
  const redisPatterns: string[] = [];
  // (table, column) Supabase deletes.
  const supaDeletes: Array<{ table: string; column: string }> = [
    { table: "lite_season_passes", column: "wallet" },
  ];

  if (full) {
    redisExact.push(
      `coach:shields:credited:${lower}`,
      `coach:games:${lower}`,
      `coach:analyses:${lower}`,
      `coach:credits:${lower}`,
      `coach:pending:${lower}`,
    );
    redisPatterns.push(`coach:game:${lower}:*`, `coach:analysis:${lower}:*`);
    supaDeletes.push(
      { table: "peones_ledger", column: "wallet" },
      { table: "score_saves", column: "wallet" },
      { table: "scores", column: "player" },
      { table: "welcome_pack_claims", column: "wallet_address" },
      { table: "coach_analyses", column: "wallet" },
    );
  }

  console.log(`\nReset wallet ${lower}`);
  console.log(`  scope:  ${full ? "FULL new-user wipe" : "PRO + Season Pass (re-purchase)"}`);
  console.log(`  mode:   ${commit ? "COMMIT (destructive)" : "DRY-RUN (no writes)"}\n`);

  const { Redis } = await import("@upstash/redis");
  const redis = Redis.fromEnv();

  // Expand scan patterns into concrete keys for the plan.
  const patternKeys: string[] = [];
  for (const pattern of redisPatterns) {
    const found = await scanKeys(redis, pattern);
    patternKeys.push(...found);
  }
  const allRedisKeys = [...redisExact, ...patternKeys];

  console.log("Redis keys:");
  for (const k of allRedisKeys) console.log(`  - ${k}`);
  console.log("Supabase rows:");
  for (const d of supaDeletes) console.log(`  - ${d.table} where ${d.column} = ${lower}`);
  console.log("");

  if (!commit) {
    console.log("DRY-RUN complete. Re-run with --commit to execute.\n");
    return;
  }

  // ── Execute ───────────────────────────────────────────────────────
  for (const k of allRedisKeys) {
    await redis.del(k);
  }
  console.log(`Redis: deleted ${allRedisKeys.length} key(s).`);

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } },
  );

  for (const d of supaDeletes) {
    const { error, count } = await supabase
      .from(d.table)
      .delete({ count: "exact" })
      .eq(d.column, lower);
    if (error) {
      console.error(`Supabase ${d.table}: ERROR ${error.message}`);
    } else {
      console.log(`Supabase ${d.table}: deleted ${count ?? 0} row(s).`);
    }
  }

  console.log(`\nDone. Now open /dev/reset in the app to wipe localStorage, then reload.`);
  if (!full) {
    console.log(`PRO + Season Pass are clear — you can purchase both again (new tx).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
