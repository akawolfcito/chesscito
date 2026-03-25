import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { isAddress } from "viem";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import { enforceOrigin, enforceRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import type { GameRecord } from "@/lib/coach/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MOVES = 500;

const redis = Redis.fromEnv();

export async function POST(req: Request) {
  try {
    enforceOrigin(req);
    await enforceRateLimit(getRequestIp(req));

    const body = await req.json();
    const { walletAddress, game } = body as { walletAddress?: string; game?: GameRecord };

    if (!walletAddress || !game?.gameId) {
      return NextResponse.json({ error: "Missing walletAddress or game" }, { status: 400 });
    }
    if (!isAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }
    if (!UUID_RE.test(game.gameId)) {
      return NextResponse.json({ error: "Invalid gameId format" }, { status: 400 });
    }
    if (!Array.isArray(game.moves) || game.moves.length > MAX_MOVES ||
        game.moves.some((m: unknown) => typeof m !== "string" || m.length > 10)) {
      return NextResponse.json({ error: "Invalid moves" }, { status: 400 });
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
  try {
    enforceOrigin(req);
    await enforceRateLimit(getRequestIp(req));
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !isAddress(wallet)) return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });

  const gameIds = await redis.lrange<string>(REDIS_KEYS.gameList(wallet), 0, 19);
  const games = await Promise.all(
    gameIds.map((id) => redis.get<GameRecord>(REDIS_KEYS.game(wallet, id))),
  );

  return NextResponse.json(games.filter(Boolean));
}
