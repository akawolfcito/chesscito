import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import { enforceOrigin, getRequestIp } from "@/lib/server/demo-signing";
import { enforceReadRateLimit } from "@/lib/server/rate-limit";
import { getRedis } from "@/lib/server/redis";
import { createLogger } from "@/lib/server/logger";
import { recordRedisUsage } from "@/lib/server/redis-observability";

const redis = getRedis();
const log = createLogger({ route: "/api/coach/credits" });

const FREE_CREDITS = 3;

export async function GET(req: Request) {
  // FAIL-CLOSED (D0.1) despite the GET verb and the name: this handler SEEDS
  // three free credits on first sight (the SETNX below). That makes it a
  // reward-granting path, and the policy for rewards is fail-closed — an
  // unmetered grant path is not something to open up during an outage.
  // The route still gets its own bucket (D0.3), so a shared-IP storm on
  // /api/pro/status can no longer starve it.
  try {
    enforceOrigin(req);
    await enforceReadRateLimit(getRequestIp(req), "coach-credits");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !isAddress(wallet)) return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });

  // Seed free credits on first query (atomic Lua script — no race window)
  const seeded = await redis.eval(
    `local s = redis.call("SETNX", KEYS[1], "1")
     if s == 1 then redis.call("SETNX", KEYS[2], ARGV[1]) end
     return s`,
    [`coach:seeded:${wallet}`, REDIS_KEYS.credits(wallet)],
    [FREE_CREDITS],
  );

  const credits = (await redis.get<number>(REDIS_KEYS.credits(wallet))) ?? 0;
  recordRedisUsage(log, {
    redis_feature: "coach_credits",
    redis_logical_operation: "seed_and_read",
    endpoint: "/api/coach/credits",
    // EVAL plus SETNX calls inside it, then the credit GET.
    redis_estimated_commands: Number(seeded) === 1 ? 4 : 3,
    cache_result: Number(seeded) === 1 ? "miss" : "hit",
  });
  return NextResponse.json({ credits });
}
