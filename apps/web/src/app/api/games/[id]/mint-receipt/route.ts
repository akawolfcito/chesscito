import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { isAddress } from "viem";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import { UUID_RE } from "@/lib/coach/game-persistence";
import { createLogger, hashWallet } from "@/lib/server/logger";
import { enforceOrigin, enforceRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import type { GameRecord } from "@/lib/coach/types";

const redis = Redis.fromEnv();
const log = createLogger({ route: "/api/games/[id]/mint-receipt" });

const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;

function isHttpsUrl(s: string | undefined): s is string {
  if (!s) return false;
  try {
    return new URL(s).protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    enforceOrigin(req);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: gameId } = await ctx.params;
  if (!UUID_RE.test(gameId)) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  let body: {
    wallet?: string;
    tokenId?: string;
    claimTxHash?: string;
    shareCardUrl?: string;
    shareLinkUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const wallet = body.wallet?.toLowerCase();
  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }

  try {
    await enforceRateLimit(getRequestIp(req), wallet);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!body.tokenId || !/^\d+$/.test(body.tokenId)) {
    return NextResponse.json({ error: "Invalid tokenId" }, { status: 400 });
  }
  if (!body.claimTxHash || !TX_HASH_RE.test(body.claimTxHash)) {
    return NextResponse.json({ error: "Invalid claimTxHash" }, { status: 400 });
  }
  if (!isHttpsUrl(body.shareCardUrl) || !isHttpsUrl(body.shareLinkUrl)) {
    return NextResponse.json({ error: "Invalid share URLs" }, { status: 400 });
  }

  const key = REDIS_KEYS.game(wallet, gameId);
  const existing = await redis.get<GameRecord>(key);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Idempotency: same tokenId re-write is a 200 no-op. Different
  // tokenId on the same gameId is a 409 to surface contract bugs.
  if (existing.mintedTokenId && existing.mintedTokenId !== body.tokenId) {
    log.warn("mint_receipt_token_mismatch", {
      wallet_hash: hashWallet(wallet),
      game_id_prefix: gameId.slice(0, 8),
      existing_token: existing.mintedTokenId,
      submitted_token: body.tokenId,
    });
    return NextResponse.json({ error: "Token mismatch" }, { status: 409 });
  }
  if (existing.mintedTokenId === body.tokenId) {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  const updated: GameRecord = {
    ...existing,
    mintedTokenId: body.tokenId,
    claimTxHash: body.claimTxHash as `0x${string}`,
    shareCardUrl: body.shareCardUrl,
    shareLinkUrl: body.shareLinkUrl,
  };
  await redis.set(key, updated, { ex: 90 * 24 * 60 * 60 });

  log.info("mint_receipt_written", {
    wallet_hash: hashWallet(wallet),
    game_id_prefix: gameId.slice(0, 8),
    token_id: body.tokenId,
  });

  return NextResponse.json({ ok: true });
}
