import { NextResponse } from "next/server";
import { createPublicClient, decodeEventLog, http, isAddress, keccak256, toBytes } from "viem";
import { celo } from "viem/chains";
import { Redis } from "@upstash/redis";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import { enforceOrigin, enforceRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import { STABLECOIN_ADDRESSES_LOWER } from "@/lib/contracts/tokens";

/** Minimal ABI just for decoding the ItemPurchased event. The shop
 *  contract emits address indexed buyer, uint256 indexed itemId, then
 *  the remaining five fields in data. We need the non-indexed `token`
 *  field to refuse coach-credit grants for any payment that wasn't
 *  made in a whitelisted stablecoin (defense-in-depth against a
 *  direct contract call paying in CELO at the un-priced rate). */
const ITEM_PURCHASED_ABI = [
  {
    type: "event",
    name: "ItemPurchased",
    inputs: [
      { name: "buyer", type: "address", indexed: true },
      { name: "itemId", type: "uint256", indexed: true },
      { name: "quantity", type: "uint256", indexed: false },
      { name: "unitPriceUsd6", type: "uint256", indexed: false },
      { name: "totalAmount", type: "uint256", indexed: false },
      { name: "token", type: "address", indexed: false },
      { name: "treasury", type: "address", indexed: false },
    ],
  },
] as const;

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const ITEM_PURCHASED_TOPIC = keccak256(
  toBytes("ItemPurchased(address,uint256,uint256,uint256,uint256,address,address)")
);

const redis = Redis.fromEnv();
const SHOP_ADDRESS = process.env.NEXT_PUBLIC_SHOP_ADDRESS as `0x${string}` | undefined;
const COACH_5_ITEM_ID = 3n;
const COACH_20_ITEM_ID = 4n;

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

    // Prevent double-credit: check if this tx was already processed
    const txKey = `coach:processed-tx:${txHash}`;
    const alreadyProcessed = await redis.get(txKey);
    if (alreadyProcessed) {
      return NextResponse.json({ ok: true, credits: (await redis.get<number>(REDIS_KEYS.credits(wallet))) ?? 0 });
    }

    // Verify the tx on-chain
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
    if (receipt.status !== "success") {
      return NextResponse.json({ error: "Transaction failed on-chain" }, { status: 400 });
    }

    // Find ItemPurchased event for coach items (verify event signature + contract address)
    const logs = receipt.logs.filter(
      (log) =>
        log.address.toLowerCase() === SHOP_ADDRESS.toLowerCase() &&
        log.topics[0] === ITEM_PURCHASED_TOPIC
    );

    let creditsToAdd = 0;
    for (const log of logs) {
      try {
        const decoded = decodeEventLog({
          abi: ITEM_PURCHASED_ABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName !== "ItemPurchased") continue;
        const { buyer, itemId, token } = decoded.args;
        if (buyer.toLowerCase() !== wallet) continue;

        // Defense-in-depth: even if the Shop contract whitelists CELO
        // for the Founder Badge sibling itemId, coach packs (3, 4)
        // must only credit when paid in a whitelisted stablecoin. This
        // closes a direct-contract-call bypass where an attacker would
        // pay ~0.05 CELO (~$0.0045) instead of $0.05 in USDC for a
        // 5-credit pack.
        if (!STABLECOIN_ADDRESSES_LOWER.includes(token.toLowerCase())) continue;

        if (itemId === COACH_5_ITEM_ID) creditsToAdd += 5;
        else if (itemId === COACH_20_ITEM_ID) creditsToAdd += 20;
      } catch { continue; }
    }

    if (creditsToAdd === 0) {
      return NextResponse.json({ error: "No coach credit purchase found in transaction" }, { status: 400 });
    }

    // Credit the wallet and mark tx as processed
    await Promise.all([
      redis.incrby(REDIS_KEYS.credits(wallet), creditsToAdd),
      redis.set(txKey, "1", { ex: 90 * 24 * 60 * 60 }),
    ]);

    const newBalance = (await redis.get<number>(REDIS_KEYS.credits(wallet))) ?? 0;
    return NextResponse.json({ ok: true, credits: newBalance });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
