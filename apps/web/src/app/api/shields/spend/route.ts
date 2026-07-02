import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { Redis } from "@upstash/redis";

import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import {
  enforceOrigin,
  enforceRateLimit,
  getRequestIp,
} from "@/lib/server/demo-signing";
import { createLogger, hashWallet } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * POST /api/shields/spend
 *
 * Consume one shield from the caller's Redis-backed balance, OR —
 * when the caller has none and presents a `peonesIdempotencyKey` —
 * verify a 2-Peones ledger payment and grant the rescue without
 * touching the counter.
 *
 * The Peones branch is NOT a copy of Coach's verify-only-existence
 * check (`verifyPeonesCoachPayment` in analyze/route.ts). A shield
 * rescue is not a naturally idempotent artifact the way a cached
 * Coach analysis is — "the ledger row exists" alone would let a
 * captured key be replayed for unlimited free rescues (red-team
 * P0-2). This route additionally holds a one-row-one-grant SETNX
 * guard in Redis (`shieldPeonesConsumed`) so each valid ledger row
 * grants exactly one rescue.
 *
 * Branch order: if `peonesIdempotencyKey` is present, take the
 * verify-only path FIRST — never attempt the counter Lua decrement
 * on this path (at 0 balance it would 409 before the key is ever
 * checked). Fail closed on any Supabase error/mismatch.
 */

const logger = createLogger({ route: "/api/shields/spend" });
const redis = Redis.fromEnv();

export const dynamic = "force-dynamic";

/** Lua: atomic balance check + decrement. Returns [newBalance, spent]
 *  where spent=1 on success, 0 on insufficient. */
const SHIELD_SPEND_LUA = `
  local cur = tonumber(redis.call('GET', KEYS[1])) or 0
  if cur < 1 then
    return { cur, 0 }
  end
  local newTotal = redis.call('DECRBY', KEYS[1], 1)
  return { newTotal, 1 }
`;

/** Lua: atomic one-row-one-grant guard. SETNX-with-TTL on the
 *  Peones-idempotency-key-derived Redis key; returns 1 if this call
 *  claimed it (first time), 0 if it was already claimed (replay). */
const SHIELD_PEONES_CONSUME_LUA = `
  local claimed = redis.call('SET', KEYS[1], '1', 'NX', 'EX', ARGV[1])
  if claimed then return 1 else return 0 end
`;

const PEONES_CONSUMED_TTL_SECONDS = 90 * 24 * 60 * 60;

function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * Verifies a claimed Shield Peones payment against the ledger.
 * Fail-closed: any Supabase failure / shape mismatch returns false.
 */
async function verifyPeonesShieldPayment(
  peonesIdempotencyKey: string,
  wallet: string,
  attemptSeq: string,
): Promise<boolean> {
  const expected = `spend:shield:${wallet}:${attemptSeq}`;
  if (peonesIdempotencyKey !== expected) return false;
  const supabase = getSupabaseServer();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("peones_ledger")
    .select("wallet, event_type, source, source_id")
    .eq("idempotency_key", peonesIdempotencyKey)
    .maybeSingle();
  if (error || !data) return false;
  return (
    data.wallet === wallet &&
    data.event_type === "spend" &&
    data.source === "shield" &&
    data.source_id === attemptSeq
  );
}

export async function POST(req: Request) {
  try {
    try {
      enforceOrigin(req);
    } catch {
      return jsonError(403, "origin_blocked");
    }

    const body = (await req.json().catch(() => ({}))) as Partial<{
      walletAddress: string;
      peonesIdempotencyKey: string;
      attemptSeq: number | string;
    }>;
    const walletAddress = body.walletAddress;
    if (!walletAddress) return jsonError(400, "missing_params");
    if (!isAddress(walletAddress)) return jsonError(400, "invalid_wallet");

    try {
      await enforceRateLimit(getRequestIp(req), walletAddress);
    } catch {
      return jsonError(429, "rate_limited");
    }

    const walletLower = walletAddress.toLowerCase();
    const walletHash = hashWallet(walletLower);

    // Peones branch — verify-only, never falls through to the
    // counter Lua on this path.
    if (
      body.peonesIdempotencyKey &&
      typeof body.peonesIdempotencyKey === "string" &&
      body.attemptSeq !== undefined
    ) {
      const attemptSeq = String(body.attemptSeq);
      let verified = false;
      try {
        verified = await verifyPeonesShieldPayment(
          body.peonesIdempotencyKey,
          walletLower,
          attemptSeq,
        );
      } catch (err) {
        logger.warn("shield_peones_verify_error", {
          wallet_hash: walletHash,
          errName: err instanceof Error ? err.name : "unknown",
        });
        verified = false; // fail-closed
      }

      if (!verified) {
        logger.info("shield_peones_insufficient", { wallet_hash: walletHash });
        return jsonError(409, "insufficient");
      }

      const consumeResult = (await redis.eval(
        SHIELD_PEONES_CONSUME_LUA,
        [`coach:shields:peones-consumed:${body.peonesIdempotencyKey}`],
        [PEONES_CONSUMED_TTL_SECONDS],
      )) as number;

      if (Number(consumeResult) !== 1) {
        logger.warn("shield_peones_replay_blocked", { wallet_hash: walletHash });
        return jsonError(409, "already_consumed");
      }

      logger.info("shield spent via peones", { wallet_hash: walletHash });
      return NextResponse.json({ ok: true, spent: 1, viaPeones: true });
    }

    // Counter branch (unchanged).
    const result = (await redis.eval(
      SHIELD_SPEND_LUA,
      [REDIS_KEYS.shieldsCredited(walletLower)],
      [],
    )) as [number, number] | (string | number)[];

    const balance = Number(Array.isArray(result) ? result[0] : 0);
    const spent = Number(Array.isArray(result) ? result[1] : 0);

    if (spent !== 1) {
      logger.info("insufficient", { wallet_hash: walletHash, balance });
      return jsonError(409, "insufficient");
    }

    logger.info("shield spent", { wallet_hash: walletHash, balance });

    return NextResponse.json({ ok: true, spent: 1, balance });
  } catch (err) {
    logger.error("unhandled exception", {
      errName: err instanceof Error ? err.name : "unknown",
      errMessage: err instanceof Error ? err.message : String(err),
    });
    return jsonError(500, "internal");
  }
}
