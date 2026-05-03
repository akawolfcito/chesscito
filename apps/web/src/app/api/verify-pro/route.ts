import { NextResponse } from "next/server";
import { createPublicClient, decodeEventLog, http, isAddress, keccak256, toBytes } from "viem";
import { celo } from "viem/chains";
import { Redis } from "@upstash/redis";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import { enforceOrigin, enforceRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import { STABLECOIN_ADDRESSES_LOWER } from "@/lib/contracts/tokens";
import { PRO_DURATION_DAYS, PRO_ITEM_ID } from "@/lib/contracts/shop-catalog";
import { createLogger } from "@/lib/server/logger";

const logger = createLogger({ route: "/api/verify-pro" });

/** Mirrors the on-chain ShopUpgradeable.ItemPurchased event signature
 *  exactly. The contract emits `token` as INDEXED (3rd indexed param,
 *  topics[3]); a previous version of this ABI declared it non-indexed,
 *  which let viem's keccak256 of the function signature still match
 *  topics[0] (signature ignores `indexed`) but caused the data decode
 *  to fail with "Data size of 128 bytes is too small for non-indexed
 *  event parameters" — the runtime symptom of a real mainnet PRO
 *  purchase silently dropping in /api/verify-pro. Field names mirror
 *  the contract too (totalTokenAmount, not totalAmount) for grep-ability;
 *  viem decodes positionally so the names don't affect behavior. */
const ITEM_PURCHASED_ABI = [
  {
    type: "event",
    name: "ItemPurchased",
    inputs: [
      { name: "buyer", type: "address", indexed: true },
      { name: "itemId", type: "uint256", indexed: true },
      { name: "quantity", type: "uint256", indexed: false },
      { name: "unitPriceUsd6", type: "uint256", indexed: false },
      { name: "totalTokenAmount", type: "uint256", indexed: false },
      { name: "token", type: "address", indexed: true },
      { name: "treasury", type: "address", indexed: false },
    ],
  },
] as const;

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const ITEM_PURCHASED_TOPIC = keccak256(
  toBytes("ItemPurchased(address,uint256,uint256,uint256,uint256,address,address)")
);

const PROCESSED_TX_TTL_SECONDS = 90 * 24 * 60 * 60;
const PRO_DURATION_MS = PRO_DURATION_DAYS * 24 * 60 * 60 * 1000;

/** Atomic extend-or-set for the PRO pass.
 *  - If no PRO active: expiresAt = now + PRO_DURATION_MS
 *  - If PRO active   : expiresAt = currentExpiresAt + PRO_DURATION_MS
 *  - If PRO expired  : expiresAt = now + PRO_DURATION_MS
 *  TTL is sized to the new expiresAt so the key auto-purges at lapse.
 *  Returns the new expiresAt as a string (Lua returns numbers as bulk
 *  strings via tostring; we coerce on the JS side). */
const PRO_EXTEND_LUA = `
  local cur = redis.call('GET', KEYS[1])
  local now = tonumber(ARGV[1])
  local addMs = tonumber(ARGV[2])
  local base
  if cur and tonumber(cur) and tonumber(cur) > now then
    base = tonumber(cur)
  else
    base = now
  end
  local newExpiresAt = base + addMs
  local ttlSec = math.ceil((newExpiresAt - now) / 1000)
  redis.call('SET', KEYS[1], tostring(newExpiresAt), 'EX', ttlSec)
  return tostring(newExpiresAt)
`;

const redis = Redis.fromEnv();
const SHOP_ADDRESS = process.env.NEXT_PUBLIC_SHOP_ADDRESS as `0x${string}` | undefined;

const client = SHOP_ADDRESS
  ? createPublicClient({ chain: celo, transport: http() })
  : null;

export async function POST(req: Request) {
  try {
    enforceOrigin(req);
    await enforceRateLimit(getRequestIp(req));

    const body = await req.json();
    const { txHash, walletAddress } = body as { txHash?: string; walletAddress?: string };

    if (!txHash || !walletAddress || !client || !SHOP_ADDRESS) {
      return NextResponse.json({ error: "Missing params or not configured" }, { status: 400 });
    }
    if (!isAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }
    if (!TX_HASH_RE.test(txHash)) {
      return NextResponse.json({ error: "Invalid transaction hash" }, { status: 400 });
    }

    const wallet = walletAddress.toLowerCase();

    // Idempotent retry: if this tx was already processed, return the
    // current expiresAt without hitting the chain again. Cliente que
    // reintenta verify-pro recibe la misma respuesta consistente.
    const alreadyProcessed = await redis.get(REDIS_KEYS.proProcessedTx(txHash));
    if (alreadyProcessed) {
      const existing = await redis.get<string | number>(REDIS_KEYS.pro(wallet));
      const expiresAt = existing == null ? 0 : Number(existing);
      return NextResponse.json({ active: expiresAt > Date.now(), expiresAt });
    }

    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
    if (receipt.status !== "success") {
      return NextResponse.json({ error: "Transaction failed on-chain" }, { status: 400 });
    }

    const logs = receipt.logs.filter(
      (log) =>
        log.address.toLowerCase() === SHOP_ADDRESS.toLowerCase() &&
        log.topics[0] === ITEM_PURCHASED_TOPIC
    );

    let foundProPurchase = false;
    let decodeAttempts = 0;
    let decodeFailures = 0;
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      decodeAttempts += 1;
      try {
        const decoded = decodeEventLog({
          abi: ITEM_PURCHASED_ABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName !== "ItemPurchased") continue;
        const { buyer, itemId, token } = decoded.args;
        if (buyer.toLowerCase() !== wallet) continue;
        if (itemId !== PRO_ITEM_ID) continue;

        // Defense-in-depth: refuse PRO grants for any payment that
        // wasn't made in a whitelisted stablecoin. Closes the same
        // CELO-bypass attack the coach verifier guards against.
        if (!STABLECOIN_ADDRESSES_LOWER.includes(token.toLowerCase())) continue;

        foundProPurchase = true;
        break;
      } catch (err) {
        // Logged at warn (not error) so a malicious caller can't flood the
        // error stream. The 2026-05-02 ABI bug surfaced here as silent
        // continues — this line is the smoking gun for the next mismatch.
        decodeFailures += 1;
        logger.warn("decode failed", {
          logIndex: i,
          dataSize: log.data.length,
          topicsLen: log.topics.length,
          errName: err instanceof Error ? err.name : "unknown",
        });
        continue;
      }
    }

    if (!foundProPurchase) {
      logger.warn("no pro purchase in tx", {
        txHash,
        wallet,
        logsExamined: logs.length,
        decodeAttempts,
        decodeFailures,
      });
      return NextResponse.json({ error: "No PRO purchase found in transaction" }, { status: 400 });
    }

    // Atomic extend: handles fresh / active / expired in one round trip
    // and avoids the lost-extension race when two distinct purchase txs
    // land on verify-pro within milliseconds of each other.
    const result = await redis.eval(
      PRO_EXTEND_LUA,
      [REDIS_KEYS.pro(wallet)],
      [Date.now(), PRO_DURATION_MS],
    );
    const expiresAt = Number(result);

    await redis.set(REDIS_KEYS.proProcessedTx(txHash), "1", { ex: PROCESSED_TX_TTL_SECONDS });

    return NextResponse.json({ active: true, expiresAt });
  } catch (err) {
    logger.error("unhandled exception", {
      errName: err instanceof Error ? err.name : "unknown",
      errMessage: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
