import { NextResponse } from "next/server";
import { isAddress } from "viem";

import { enforceOrigin, getRequestIp } from "@/lib/server/demo-signing";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createLogger } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * GET /api/welcome-pack/status?wallet=0x…
 *
 * Lightweight existence check on the welcome_pack_claims ledger. Returns
 * the boolean + claimed_at so the Shop tile can render its post-claim
 * state on first paint without forcing a claim attempt.
 *
 * Cached in localStorage on the client (24h TTL or wallet swap). This
 * endpoint is the cache invalidation source of truth.
 *
 * Spec: _bmad-output/planning-artifacts/ux-shield-rescue-and-welcome-
 * pack-2026-05-31.md §5.2 (status endpoint).
 */

const logger = createLogger({ route: "/api/welcome-pack/status" });

export const dynamic = "force-dynamic";

function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function GET(req: Request) {
  try {
    try {
      enforceOrigin(req);
    } catch {
      return jsonError(403, "origin_blocked");
    }
    // FAIL-OPEN (D0.1). Pure read of a monotonic flag — `claimed` never goes
    // back to false, and the CLAIM endpoint (which does mutate) keeps its own
    // fail-closed guard. An Upstash outage must not make the Shop tile render
    // its pre-claim state to someone who already claimed.
    const limit = await checkRateLimit({
      identifier: getRequestIp(req),
      route: "welcome-pack-status",
      policy: "fail-open",
    });
    if (!limit.allowed) return jsonError(429, "rate_limited");

    const url = new URL(req.url);
    const wallet = url.searchParams.get("wallet");
    if (!wallet) return jsonError(400, "missing_params");
    if (!isAddress(wallet)) return jsonError(400, "invalid_wallet");

    const supabase = getSupabaseServer();
    if (!supabase) {
      logger.error("supabase env missing");
      return jsonError(500, "internal");
    }

    const { data, error } = await supabase
      .from("welcome_pack_claims")
      .select("claimed_at")
      .eq("wallet_address", wallet.toLowerCase())
      .maybeSingle();

    if (error) {
      logger.error("status read failed", {
        errCode: error.code,
        errMessage: error.message,
      });
      return jsonError(500, "internal");
    }

    return NextResponse.json({
      ok: true,
      claimed: data != null,
      claimed_at: data?.claimed_at ?? null,
    });
  } catch (err) {
    logger.error("unhandled exception", {
      errName: err instanceof Error ? err.name : "unknown",
      errMessage: err instanceof Error ? err.message : String(err),
    });
    return jsonError(500, "internal");
  }
}
