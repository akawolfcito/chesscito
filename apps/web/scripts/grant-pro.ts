/**
 * Dev-only utility: grant a wallet a Chesscito PRO subscription by
 * writing the Redis key `coach:pro:<wallet>` directly. Mirrors what
 * /api/verify-pro does after a successful on-chain purchase, without
 * the on-chain step — useful for QA when you want to test the PRO
 * flow without spending USD on a real purchase.
 *
 * Usage:
 *   cd apps/web
 *   npx tsx --tsconfig tsconfig.json scripts/grant-pro.ts \
 *     0xYOUR_WALLET_ADDRESS [days]
 *
 *   `days` defaults to 30 (matches the on-chain SKU length).
 *
 * Reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN from
 * apps/web/.env (or .env.local). Same Redis instance both the
 * server-side `isProActive()` and the /hub PRO chip read from, so
 * the wallet flips to PRO immediately on next reload.
 *
 * To revoke: re-run with `--revoke`, or set `days 0`.
 *
 * Wallet is normalized to lowercase to match the convention used by
 * /api/verify-pro and isProActive (key: `coach:pro:<lowercase>`).
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

async function main() {
  const args = process.argv.slice(2);
  const wallet = args[0];
  const flag = args.find((a) => a === "--revoke");
  const days = flag ? 0 : args[1] ? Number(args[1]) : 30;

  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    console.error("Usage: npx tsx scripts/grant-pro.ts 0xWALLET [days]");
    console.error("       npx tsx scripts/grant-pro.ts 0xWALLET --revoke");
    process.exit(1);
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error(
      "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN. Add them to apps/web/.env.local.",
    );
    process.exit(1);
  }

  const { Redis } = await import("@upstash/redis");
  const redis = Redis.fromEnv();

  const lower = wallet.toLowerCase();
  const key = `coach:pro:${lower}`;

  if (flag || days === 0) {
    await redis.del(key);
    console.log(`Revoked PRO for ${lower} (deleted ${key}).`);
    return;
  }

  const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
  await redis.set(key, expiresAt);

  const expiresHuman = new Date(expiresAt).toISOString();
  console.log(`Granted PRO for ${lower}`);
  console.log(`  key:        ${key}`);
  console.log(`  expires_at: ${expiresAt} (${expiresHuman})`);
  console.log(`  duration:   ${days} day${days === 1 ? "" : "s"}`);
  console.log(``);
  console.log(`Reload /hub to see the 26-day chip flip to active.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
