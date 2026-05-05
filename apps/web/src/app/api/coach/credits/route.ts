import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { isAddress } from "viem";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import { enforceOrigin, enforceReadRateLimit, getRequestIp } from "@/lib/server/demo-signing";

const redis = Redis.fromEnv();

const FREE_CREDITS = 3;

export async function GET(req: Request) {
  try {
    enforceOrigin(req);
    await enforceReadRateLimit(getRequestIp(req));
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !isAddress(wallet)) return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });

  // Seed free credits on first query (atomic Lua script — no race window)
  await redis.eval(
    `local s = redis.call("SETNX", KEYS[1], "1")
     if s == 1 then redis.call("SETNX", KEYS[2], ARGV[1]) end
     return s`,
    [`coach:seeded:${wallet}`, REDIS_KEYS.credits(wallet)],
    [FREE_CREDITS],
  );

  const credits = (await redis.get<number>(REDIS_KEYS.credits(wallet))) ?? 0;
  return NextResponse.json({ credits });
}
