import { NextResponse } from "next/server";
import { createPublicClient, decodeEventLog, http, isAddress, keccak256, toBytes } from "viem";
import { celo } from "viem/chains";
import { getRedis } from "@/lib/server/redis";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import { extendProExpiry } from "@/lib/coach/pro-extend";
import { enforceOrigin, enforceRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import { STABLECOIN_ADDRESSES_LOWER } from "@/lib/contracts/tokens";
import { PRO_ITEM_ID } from "@/lib/contracts/shop-catalog";
import { ITEM_PURCHASED_ABI } from "@/lib/contracts/generated/shop-events";
import { createLogger } from "@/lib/server/logger";

const logger = createLogger({ route: "/api/verify-pro" });

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const ITEM_PURCHASED_TOPIC = keccak256(
  toBytes("ItemPurchased(address,uint256,uint256,uint256,uint256,address,address)")
);

const PROCESSED_TX_TTL_SECONDS = 90 * 24 * 60 * 60;

const redis = getRedis();
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
    // land on verify-pro within milliseconds of each other. Shared with
    // the no-approve rail's PRO branch in /api/verify-payment so both
    // grant paths compose against the same value.
    const expiresAt = await extendProExpiry(redis, REDIS_KEYS.pro(wallet));

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
