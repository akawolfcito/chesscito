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

/**
 * POST /api/shields/spend
 *
 * Consume one shield from the caller's Redis-backed balance.
 * Single source of truth for shield economy — never let the client
 * decrement balances on its own (incognito + cache wipe would mint
 * shields).
 *
 * Atomic semantics via Lua:
 *   - GET balance
 *   - If balance < 1 → return { ok:false, error: insufficient }
 *   - Otherwise DECRBY 1 + return new balance
 *   Single round-trip closes the read-modify-write race that two
 *   parallel tabs would otherwise exploit (P1-5 mirror of
 *   credit-shield).
 *
 * Spec: _bmad-output/planning-artifacts/ux-shield-rescue-and-welcome-
 * pack-2026-05-31.md §3.5 (Use Shield interaction) — server endpoint
 * decision confirmed in cluster session 2026-05-31.
 */

const logger = createLogger({ route: "/api/shields/spend" });
const redis = Redis.fromEnv();

export const dynamic = "force-dynamic";

/** Lua: atomic balance check + decrement. Returns [newBalance, spent]
 *  where spent=1 on success, 0 on insufficient. Mirrors the credit
 *  Lua pattern in credit-shield/route.ts to keep the audit surface
 *  small (one mental model for shield economy). */
const SHIELD_SPEND_LUA = `
  local cur = tonumber(redis.call('GET', KEYS[1])) or 0
  if cur < 1 then
    return { cur, 0 }
  end
  local newTotal = redis.call('DECRBY', KEYS[1], 1)
  return { newTotal, 1 }
`;

function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
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
