import { NextResponse } from "next/server";
import { createPublicClient, http, isAddress, keccak256, toBytes } from "viem";
import { celo } from "viem/chains";
import { Redis } from "@upstash/redis";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import { enforceOrigin, enforceRateLimit, getRequestIp } from "@/lib/server/demo-signing";

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
        const rawBuyer = log.topics[1];
        const rawItem = log.topics[2];
        if (!rawBuyer || !rawItem) continue;

        const buyer = ("0x" + rawBuyer.slice(26)).toLowerCase();
        if (buyer !== wallet) continue;

        const itemId = BigInt(rawItem);
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
