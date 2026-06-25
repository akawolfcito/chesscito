/**
 * GET /api/season-pass/status?wallet=0x...
 *
 * Returns the active Lite Season Pass for a wallet, if any.
 * Fast path: Redis TTL key (set at purchase, auto-expires at pass end).
 * Fallback: Supabase query (catches purchases where Redis was unavailable).
 *
 * Response:
 *   { active: false }
 *   { active: true, expiresAt, seasonId, supporterStatus, shieldsCredited }
 */

import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import { createLogger } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

const redis = Redis.fromEnv();
const log = createLogger({ route: "/api/season-pass/status" });

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/i;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("wallet") ?? "";
  if (!ADDRESS_RE.test(raw)) {
    return NextResponse.json({ ok: false, error: "invalid_wallet" }, { status: 400 });
  }
  const wallet = raw.toLowerCase();

  // ── Redis fast path ────────────────────────────────────────────
  try {
    const cached = await redis.get<string>(REDIS_KEYS.seasonPass(wallet));
    if (cached) {
      const expiresAt = cached;
      if (new Date(expiresAt) > new Date()) {
        return NextResponse.json({ active: true, expiresAt, source: "redis" });
      }
    }
  } catch (e) {
    log.warn("redis_status_check_failed", { wallet, err: String(e) });
  }

  // ── Supabase fallback ──────────────────────────────────────────
  const supabase = getSupabaseServer();
  if (!supabase) {
    log.error("supabase_unavailable", { wallet });
    return NextResponse.json({ active: false, error: "ledger_unavailable" }, { status: 503 });
  }

  try {
    const { data, error } = await supabase
      .from("lite_season_passes")
      .select("expires_at, season_id, supporter_status, shields_credited")
      .eq("wallet", wallet)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      log.error("db_query_failed", { wallet, code: error.code });
      return NextResponse.json({ active: false }, { status: 200 });
    }

    if (!data) {
      return NextResponse.json({ active: false });
    }

    return NextResponse.json({
      active: true,
      expiresAt: data.expires_at,
      seasonId: data.season_id,
      supporterStatus: data.supporter_status ?? "challenger",
      shieldsCredited: data.shields_credited ?? 3,
      source: "db",
    });
  } catch (e) {
    log.error("unexpected_error", { wallet, err: String(e) });
    return NextResponse.json({ active: false });
  }
}
