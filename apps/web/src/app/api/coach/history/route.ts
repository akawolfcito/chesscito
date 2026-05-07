import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { isAddress } from "viem";
import { recoverMessageAddress } from "viem";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import { enforceOrigin, enforceRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createLogger, hashWallet } from "@/lib/server/logger";
import type { CoachAnalysisRecord, GameRecord } from "@/lib/coach/types";

const redis = Redis.fromEnv();

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

const NONCE_TTL_S = 300;
const NONCE_RE = /^[0-9a-f]{32}$/i;
const ISO_AGE_LIMIT_MS = 5 * 60 * 1000;

/* Chain + domain bound. Keep in lockstep with COACH_COPY.historyDelete.signMessage. */
const DELETE_MESSAGE = (nonce: string, issuedIso: string) =>
  `Delete my Coach history\nDomain: chesscito.app\nChain: 42220\nNonce: ${nonce}\nIssued: ${issuedIso}`;

/* PR 4 introduces viem's recoverMessageAddress to this codebase.
 * lib/server/demo-signing.ts uses ethers for the demo-signer flow, but
 * new auth surfaces standardize on viem to match the wagmi client stack
 * already in apps/web/src/components/wallet-provider.tsx. */
export async function DELETE(req: Request) {
  const log = createLogger({ route: "/api/coach/history" });

  try {
    enforceOrigin(req);
    await enforceRateLimit(getRequestIp(req));
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { walletAddress, signature, nonce, issuedIso } = body as {
    walletAddress?: string;
    signature?: string;
    nonce?: string;
    issuedIso?: string;
  };

  if (!walletAddress || !isAddress(walletAddress)) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }
  if (!signature || !signature.startsWith("0x")) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (!nonce || !NONCE_RE.test(nonce)) {
    return NextResponse.json({ error: "Invalid nonce" }, { status: 400 });
  }
  if (!issuedIso) {
    return NextResponse.json({ error: "Missing issuedIso" }, { status: 400 });
  }

  const issuedAtMs = Date.parse(issuedIso);
  if (!Number.isFinite(issuedAtMs)) {
    return NextResponse.json({ error: "Invalid issuedIso" }, { status: 400 });
  }
  if (Math.abs(Date.now() - issuedAtMs) > ISO_AGE_LIMIT_MS) {
    return NextResponse.json({ error: "Message expired" }, { status: 410 });
  }

  const nonceKey = REDIS_KEYS.deleteNonce(nonce);
  const claimed = await redis.set(nonceKey, walletAddress.toLowerCase(), {
    nx: true,
    ex: NONCE_TTL_S,
  });
  if (!claimed) {
    return NextResponse.json({ error: "Nonce already used" }, { status: 409 });
  }

  const message = DELETE_MESSAGE(nonce, issuedIso);
  let recovered: `0x${string}`;
  try {
    recovered = await recoverMessageAddress({
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
    return NextResponse.json({ error: "Address mismatch" }, { status: 403 });
  }

  const wallet = recovered.toLowerCase();

  const supabase = getSupabaseServer();
  if (!supabase) {
    log.error("coach_delete_supabase_unavailable", { wallet_hash: hashWallet(wallet) });
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const [supaRes, redisKeysDeleted] = await Promise.all([
    supabase.from("coach_analyses").delete({ count: "exact" }).eq("wallet", wallet),
    (async () => {
      const ids = await redis.lrange<string>(REDIS_KEYS.analysisList(wallet), 0, -1);
      const keys = [
        REDIS_KEYS.analysisList(wallet),
        ...ids.map((id) => REDIS_KEYS.analysis(wallet, id)),
      ];
      return keys.length > 0 ? redis.del(...keys) : 0;
    })(),
  ]);

  log.info("coach_history_deleted", {
    wallet_hash: hashWallet(wallet),
    supabase_rows: supaRes.count ?? 0,
    redis_keys_deleted: redisKeysDeleted,
  });

  return NextResponse.json({ deleted: true, supabase_rows: supaRes.count ?? 0 });
}
