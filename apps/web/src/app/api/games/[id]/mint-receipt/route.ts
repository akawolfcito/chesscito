import { NextResponse } from "next/server";
import { getRedis } from "@/lib/server/redis";
import { isAddress } from "viem";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import { UUID_RE } from "@/lib/coach/game-persistence";
import { createLogger, hashWallet } from "@/lib/server/logger";
import { enforceOrigin, enforceRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import type { GameRecord } from "@/lib/coach/types";

const redis = getRedis();
const log = createLogger({ route: "/api/games/[id]/mint-receipt" });

const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;

// Build the host allowlist for share URLs from the same env vars used by
// enforceOrigin. Exact host match — no wildcards — to block lookalike
// domains, IDN homographs, and DNS takeover of orphan subdomains.
function buildAllowedShareHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const envVar of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_PREVIEW_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    if (envVar) hosts.add(envVar.replace(/^https?:\/\//, ""));
  }
  return hosts;
}

// Rejects HTTP, malformed URLs, and any host outside the allowlist. When the
// allowlist is empty (local dev with no env vars set), falls back to
// HTTPS-only to preserve developer DX — production / preview / Vercel
// deploys always have at least one of the env vars populated, so the
// allowlist enforcement always runs there.
function isAllowedShareUrl(s: string | undefined, allowedHosts: Set<string>): s is string {
  if (!s) return false;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (allowedHosts.size === 0) return true;
  return allowedHosts.has(url.host);
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
  const allowedHosts = buildAllowedShareHosts();
  if (!isAllowedShareUrl(body.shareCardUrl, allowedHosts) || !isAllowedShareUrl(body.shareLinkUrl, allowedHosts)) {
    return NextResponse.json({ error: "Invalid share URLs" }, { status: 400 });
  }

  const key = REDIS_KEYS.game(wallet, gameId);
  const existing = await redis.get<GameRecord>(key);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Idempotency: same tokenId re-write is a 200 no-op. Different
  // tokenId on the same gameId is a re-save (unlimited re-save, latest wins).
  if (existing.mintedTokenId && existing.mintedTokenId !== body.tokenId) {
    log.info("mint_receipt_resave", {
      wallet_hash: hashWallet(wallet),
      game_id_prefix: gameId.slice(0, 8),
      prev_token: existing.mintedTokenId,
      new_token: body.tokenId,
    });
    // fall through to overwrite with the new tokenId
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
