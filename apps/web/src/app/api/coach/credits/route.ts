import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { isAddress } from "viem";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";

const redis = Redis.fromEnv();

const FREE_CREDITS = 3;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !isAddress(wallet)) return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });

  // Seed free credits on first query (atomic — setnx prevents race conditions)
  const seededKey = `coach:seeded:${wallet}`;
  const wasSet = await redis.setnx(seededKey, "1");
  if (wasSet) {
    await redis.setnx(REDIS_KEYS.credits(wallet), FREE_CREDITS);
  }

  const credits = (await redis.get<number>(REDIS_KEYS.credits(wallet))) ?? 0;
  return NextResponse.json({ credits });
}
