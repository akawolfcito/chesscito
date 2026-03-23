import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import type { GameRecord } from "@/lib/coach/types";

const redis = Redis.fromEnv();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { walletAddress, game } = body as { walletAddress?: string; game?: GameRecord };

    if (!walletAddress || !game?.gameId) {
      return NextResponse.json({ error: "Missing walletAddress or game" }, { status: 400 });
    }

    const wallet = walletAddress.toLowerCase();
    const record: GameRecord = {
      ...game,
      totalMoves: game.moves.length,
      receivedAt: Date.now(),
    };

    await Promise.all([
      redis.set(REDIS_KEYS.game(wallet, game.gameId), record, { ex: 90 * 24 * 60 * 60 }),
      redis.lpush(REDIS_KEYS.gameList(wallet), game.gameId),
      redis.ltrim(REDIS_KEYS.gameList(wallet), 0, 99),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet")?.toLowerCase();
  if (!wallet) return NextResponse.json({ error: "Missing wallet" }, { status: 400 });

  const gameIds = await redis.lrange<string>(REDIS_KEYS.gameList(wallet), 0, 19);
  const games = await Promise.all(
    gameIds.map((id) => redis.get<GameRecord>(REDIS_KEYS.game(wallet, id))),
  );

  return NextResponse.json(games.filter(Boolean));
}
