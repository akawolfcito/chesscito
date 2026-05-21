import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { isAddress } from "viem";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import { enforceGameCap, GAME_LIST_LPUSH_LUA } from "@/lib/coach/game-persistence";
import { createLogger, hashWallet } from "@/lib/server/logger";
import { enforceOrigin, enforceRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import type { GameRecord } from "@/lib/coach/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MOVES = 500;

const redis = Redis.fromEnv();
const log = createLogger({ route: "/api/games" });

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

    // Cluster E (§0.1): replaced the legacy `ltrim(0, 99)` with
    // `enforceGameCap`, which raises the per-wallet cap to 200 and skips
    // analyzed entries during FIFO eviction so a player's coached games
    // are never silently dropped to make room for a fresh match.
    await redis.set(REDIS_KEYS.game(wallet, game.gameId), record, { ex: 90 * 24 * 60 * 60 });
    // Cluster E defer #1: atomic LPOS+LPUSH via Lua eval closes the TOCTOU
    // race where two concurrent POSTs with the same gameId both observe
    // LPOS=nil and both LPUSH, producing duplicate head entries. Redis Lua
    // scripts run single-threaded; no other command interleaves.
    await redis.eval(
      GAME_LIST_LPUSH_LUA,
      [REDIS_KEYS.gameList(wallet)],
      [game.gameId],
    );
    await enforceGameCap(redis, wallet, {
      onOverflow: (info) => {
        log.warn("game_persist_cap_overflow", {
          wallet_hash: hashWallet(info.wallet),
          list_length: info.listLength,
          analyzed_in_tail: info.analyzedInTail,
        });
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("game_persist_error", {
      error: err instanceof Error ? err.message : "unknown",
    });
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
