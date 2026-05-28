import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { isAddress } from "viem";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import { UUID_RE } from "@/lib/coach/game-persistence";
import { createLogger } from "@/lib/server/logger";
import { enforceOrigin, enforceReadRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import type { GameRecord } from "@/lib/coach/types";

const redis = Redis.fromEnv();
const log = createLogger({ route: "/api/games/[id]" });

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    enforceOrigin(req);
    await enforceReadRateLimit(getRequestIp(req));
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: gameId } = await ctx.params;
  const url = new URL(req.url);
  const walletRaw = url.searchParams.get("wallet");
  const wallet = walletRaw?.toLowerCase();

  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }
  if (!UUID_RE.test(gameId)) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  try {
    const record = await redis.get<GameRecord>(REDIS_KEYS.game(wallet, gameId));
    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(record, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    log.error("game_fetch_error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
