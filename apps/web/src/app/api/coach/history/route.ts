import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { isAddress } from "viem";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import type { CoachAnalysisRecord, GameRecord } from "@/lib/coach/types";

const redis = Redis.fromEnv();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !isAddress(wallet)) return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });

  const gameIds = await redis.lrange<string>(REDIS_KEYS.analysisList(wallet), 0, 19);

  const entries = await Promise.all(
    gameIds.map(async (gameId) => {
      const [analysis, game] = await Promise.all([
        redis.get<CoachAnalysisRecord>(REDIS_KEYS.analysis(wallet, gameId)),
        redis.get<GameRecord>(REDIS_KEYS.game(wallet, gameId)),
      ]);
      return analysis && game ? { ...analysis, game } : null;
    }),
  );

  return NextResponse.json(entries.filter(Boolean));
}
