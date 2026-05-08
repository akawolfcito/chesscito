import { NextResponse } from "next/server";
import {
  createPublicClient,
  decodeEventLog,
  http,
  isAddress,
  keccak256,
  toBytes,
} from "viem";
import { celo, celoSepolia } from "viem/chains";
import { Redis } from "@upstash/redis";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import {
  enforceOrigin,
  enforceRateLimit,
  getRequestIp,
} from "@/lib/server/demo-signing";
import { STABLECOIN_ADDRESSES_LOWER } from "@/lib/contracts/tokens";
import {
  SHIELD_ITEM_ID,
  SHIELDS_PER_PURCHASE,
} from "@/lib/contracts/shop-catalog";
import { ITEM_PURCHASED_ABI } from "@/lib/contracts/generated/shop-events";
import { createLogger, hashWallet } from "@/lib/server/logger";

const logger = createLogger({ route: "/api/credit-shield" });

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const ITEM_PURCHASED_TOPIC = keccak256(
  toBytes(
    "ItemPurchased(address,uint256,uint256,uint256,uint256,address,address)",
  ),
);

const RECEIPT_POLL_TIMEOUT_MS = 20_000;
const PROCESSED_TX_TTL_SECONDS = 90 * 24 * 60 * 60;

/** Atomic credit Lua. SETNX-then-INCRBY in one EVAL closes the
 *  concurrent-same-tx race (red-team v1 P1-5). Returns
 *  [credited, delta]: delta=0 means the txHash was already processed
 *  and the credit was a no-op. */
const SHIELD_CREDIT_LUA = `
  local already = redis.call('SET', KEYS[1], '1', 'NX', 'EX', ARGV[2])
  if not already then
    local cur = redis.call('GET', KEYS[2])
    return { tonumber(cur) or 0, 0 }
  end
  local newTotal = redis.call('INCRBY', KEYS[2], ARGV[1])
  return { newTotal, tonumber(ARGV[1]) }
`;

const redis = Redis.fromEnv();
const SHOP_ADDRESS = process.env.NEXT_PUBLIC_SHOP_ADDRESS as
  | `0x${string}`
  | undefined;

function pickChain() {
  const parsed = Number.parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? "", 10);
  if (parsed === 11142220) return celoSepolia;
  return celo;
}

const client = SHOP_ADDRESS
  ? createPublicClient({ chain: pickChain(), transport: http() })
  : null;

function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request) {
  try {
    try {
      enforceOrigin(req);
    } catch {
      return jsonError(403, "origin_blocked");
    }
    try {
      await enforceRateLimit(getRequestIp(req));
    } catch {
      return jsonError(429, "rate_limited");
    }

    const body = (await req.json().catch(() => ({}))) as {
      txHash?: string;
      walletAddress?: string;
    };
    const { txHash, walletAddress } = body;

    if (!txHash || !walletAddress || !client || !SHOP_ADDRESS) {
      return jsonError(400, "missing_params");
    }
    if (!isAddress(walletAddress)) {
      return jsonError(400, "invalid_wallet");
    }
    if (!TX_HASH_RE.test(txHash)) {
      return jsonError(400, "invalid_tx_hash");
    }

    const wallet = walletAddress.toLowerCase();
    const txHashLower = txHash.toLowerCase();
    const walletHash = hashWallet(wallet);

    let receipt;
    try {
      receipt = await client.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
        timeout: RECEIPT_POLL_TIMEOUT_MS,
      });
    } catch (err) {
      logger.warn("receipt fetch failed", {
        txHash: txHashLower,
        wallet_hash: walletHash,
        errName: err instanceof Error ? err.name : "unknown",
      });
      return jsonError(400, "unprocessable");
    }

    if (receipt.status !== "success") {
      logger.warn("tx failed on-chain", {
        txHash: txHashLower,
        wallet_hash: walletHash,
      });
      return jsonError(400, "unprocessable");
    }

    const candidateLogs = receipt.logs.filter(
      (log) =>
        log.address.toLowerCase() === SHOP_ADDRESS.toLowerCase() &&
        log.topics[0] === ITEM_PURCHASED_TOPIC,
    );

    let matches = 0;
    let decodeAttempts = 0;
    let decodeFailures = 0;
    for (let i = 0; i < candidateLogs.length; i++) {
      const log = candidateLogs[i];
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
        if (itemId !== SHIELD_ITEM_ID) continue;
        if (!STABLECOIN_ADDRESSES_LOWER.includes(token.toLowerCase())) continue;
        matches += 1;
      } catch (err) {
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

    if (matches === 0) {
      logger.warn("no shield purchase in tx", {
        txHash: txHashLower,
        wallet_hash: walletHash,
        logsExamined: candidateLogs.length,
        decodeAttempts,
        decodeFailures,
      });
      return jsonError(400, "unprocessable");
    }

    const delta = matches * SHIELDS_PER_PURCHASE;
    const result = (await redis.eval(
      SHIELD_CREDIT_LUA,
      [
        REDIS_KEYS.shieldProcessedTx(txHashLower),
        REDIS_KEYS.shieldsCredited(wallet),
      ],
      [delta, PROCESSED_TX_TTL_SECONDS],
    )) as [number, number] | (string | number)[];

    const credited = Number(Array.isArray(result) ? result[0] : 0);
    const appliedDelta = Number(Array.isArray(result) ? result[1] : 0);

    logger.info("credit ok", {
      txHash: txHashLower,
      wallet_hash: walletHash,
      delta: appliedDelta,
      credited,
    });

    return NextResponse.json({
      ok: true,
      credited,
      delta: appliedDelta,
      txHash: txHashLower,
    });
  } catch (err) {
    logger.error("unhandled exception", {
      errName: err instanceof Error ? err.name : "unknown",
      errMessage: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return jsonError(500, "internal");
  }
}
