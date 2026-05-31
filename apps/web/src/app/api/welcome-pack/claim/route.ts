import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import {
  enforceOrigin,
  enforceRateLimit,
  getRequestIp,
} from "@/lib/server/demo-signing";
import { createLogger, hashWallet } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  WELCOME_PACK_SHIELDS,
  hashIp,
  hashUserAgent,
  validateClaimInput,
} from "@/lib/server/welcome-pack";

/**
 * POST /api/welcome-pack/claim
 *
 * Idempotent Welcome Pack claim. On first call per wallet, inserts a
 * row in `welcome_pack_claims` and credits WELCOME_PACK_SHIELDS to the
 * caller's shield balance. Subsequent calls return `already_claimed`
 * without crediting again.
 *
 * Idempotency contract: enforced by PRIMARY KEY on lowercase
 * wallet_address + INSERT … ON CONFLICT semantics. Two concurrent
 * requests from the same wallet → one wins the INSERT, the other gets
 * the duplicate-key error and returns `already_claimed`.
 *
 * Spec: _bmad-output/planning-artifacts/ux-shield-rescue-and-welcome-
 * pack-2026-05-31.md §5.2.
 *
 * Known v1 edge case (red-team §7 #8): if INSERT succeeds but the Redis
 * INCRBY fails, the user has a claim row but no shields. Documented;
 * v2 will add a reconciler. Phase 1 returns 500 `credit_failed` so the
 * client can show an error toast and we capture telemetry.
 */

const logger = createLogger({ route: "/api/welcome-pack/claim" });
const redis = Redis.fromEnv();

export const dynamic = "force-dynamic";

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
      address: string;
      signature: string;
      message: string;
    }>;
    if (!body.address || !body.signature || !body.message) {
      return jsonError(400, "missing_params");
    }

    try {
      await enforceRateLimit(getRequestIp(req), body.address);
    } catch {
      return jsonError(429, "rate_limited");
    }

    const validation = await validateClaimInput({
      address: body.address,
      signature: body.signature,
      message: body.message,
    });
    if (!validation.ok) {
      const status =
        validation.error === "invalid_address" ||
        validation.error === "invalid_message"
          ? 400
          : 401;
      return jsonError(status, validation.error);
    }

    const supabase = getSupabaseServer();
    if (!supabase) {
      logger.error("supabase env missing");
      return jsonError(500, "claim_failed");
    }

    const walletLower = validation.address.toLowerCase();
    const walletHash = hashWallet(walletLower);
    const ipHash = hashIp(getRequestIp(req));
    const userAgentHash = hashUserAgent(req.headers.get("user-agent"));
    const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? null;

    const { data: inserted, error: insertErr } = await supabase
      .from("welcome_pack_claims")
      .insert({
        wallet_address: walletLower,
        ip_hash: ipHash,
        signature: body.signature,
        message: body.message,
        app_version: appVersion,
        user_agent_hash: userAgentHash,
      })
      .select("claimed_at")
      .maybeSingle();

    if (insertErr) {
      // Postgres unique violation: SQLSTATE 23505 = "already claimed".
      if (insertErr.code === "23505") {
        const { data: existing } = await supabase
          .from("welcome_pack_claims")
          .select("claimed_at")
          .eq("wallet_address", walletLower)
          .maybeSingle();
        logger.info("already claimed", {
          wallet_hash: walletHash,
          claimed_at: existing?.claimed_at ?? null,
        });
        return NextResponse.json({
          ok: true,
          already_claimed: true,
          claimed_at: existing?.claimed_at ?? null,
        });
      }
      logger.error("insert failed", {
        wallet_hash: walletHash,
        errCode: insertErr.code,
        errMessage: insertErr.message,
      });
      return jsonError(500, "claim_failed");
    }

    if (!inserted) {
      // Defensive: no error, no row. Treat as already-claimed so we
      // never double-credit on retries that race a deletion path.
      logger.warn("insert returned no row without error", {
        wallet_hash: walletHash,
      });
      return NextResponse.json({
        ok: true,
        already_claimed: true,
        claimed_at: null,
      });
    }

    // Credit shields. See §7 red-team item #8 for the known v1 edge case
    // (INSERT succeeded, INCRBY fails — row exists, balance unchanged).
    let credited: number;
    try {
      credited = Number(
        await redis.incrby(
          REDIS_KEYS.shieldsCredited(walletLower),
          WELCOME_PACK_SHIELDS,
        ),
      );
    } catch (err) {
      logger.error("redis credit failed after insert", {
        wallet_hash: walletHash,
        errName: err instanceof Error ? err.name : "unknown",
        errMessage: err instanceof Error ? err.message : String(err),
      });
      return jsonError(500, "credit_failed");
    }

    logger.info("welcome pack claimed", {
      wallet_hash: walletHash,
      shields_granted: WELCOME_PACK_SHIELDS,
      credited,
    });

    return NextResponse.json({
      ok: true,
      claimed: true,
      shields_granted: WELCOME_PACK_SHIELDS,
      credited,
      claimed_at: inserted.claimed_at,
    });
  } catch (err) {
    logger.error("unhandled exception", {
      errName: err instanceof Error ? err.name : "unknown",
      errMessage: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return jsonError(500, "internal");
  }
}
