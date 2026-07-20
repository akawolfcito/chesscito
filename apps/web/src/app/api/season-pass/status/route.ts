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
import { resolveEffectiveTrainingPass } from "@/lib/entitlements/effective-training-pass";
import { isProActive } from "@/lib/pro/is-active";
import { getSeasonPass } from "@/lib/payments/rail-config";
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

  let pro: Awaited<ReturnType<typeof isProActive>>;
  try {
    pro = await isProActive(wallet);
  } catch (e) {
    log.error("pro_status_check_failed", { wallet, err: String(e) });
    return NextResponse.json(
      { active: false, source: null, error: "entitlement_unavailable" },
      { status: 503 },
    );
  }

  const response = (
    seasonPass: { active: boolean; expiresAt: string | null },
    details: Record<string, unknown> = {},
  ) => ({
    ...resolveEffectiveTrainingPass({ seasonPass, pro }),
    ...details,
  });
  const configuredPass = getSeasonPass("lite_season_pass_21");

  // ── Redis fast path ────────────────────────────────────────────
  try {
    const cached = await redis.get<string>(REDIS_KEYS.seasonPass(wallet));
    if (cached) {
      const expiresAt = cached;
      if (new Date(expiresAt) > new Date()) {
        return NextResponse.json(response(
          { active: true, expiresAt },
          {
            expiresAt,
            seasonId: configuredPass.seasonId,
            supporterStatus: configuredPass.supporterStatus,
            shieldsCredited: configuredPass.shieldsOnPurchase,
            storageSource: "redis",
          },
        ));
      }
    }
  } catch (e) {
    log.warn("redis_status_check_failed", { wallet, err: String(e) });
  }

  // ── Supabase fallback ──────────────────────────────────────────
  const supabase = getSupabaseServer();
  if (!supabase) {
    log.error("supabase_unavailable", { wallet });
    if (pro.active) {
      return NextResponse.json(response({ active: false, expiresAt: null }));
    }
    return NextResponse.json(
      { ...response({ active: false, expiresAt: null }), error: "ledger_unavailable" },
      { status: 503 },
    );
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
      if (pro.active) {
        return NextResponse.json(response({ active: false, expiresAt: null }));
      }
      return NextResponse.json(
        {
          ...response({ active: false, expiresAt: null }),
          error: "ledger_unavailable",
        },
        { status: 503 },
      );
    }

    if (!data) {
      return NextResponse.json(response({ active: false, expiresAt: null }));
    }

    return NextResponse.json(response(
      { active: true, expiresAt: data.expires_at },
      {
      expiresAt: data.expires_at,
      seasonId: data.season_id,
      supporterStatus: data.supporter_status ?? "challenger",
      shieldsCredited: data.shields_credited ?? 3,
      storageSource: "db",
      },
    ));
  } catch (e) {
    log.error("unexpected_error", { wallet, err: String(e) });
    if (pro.active) {
      return NextResponse.json(response({ active: false, expiresAt: null }));
    }
    return NextResponse.json(
      {
        ...response({ active: false, expiresAt: null }),
        error: "ledger_unavailable",
      },
      { status: 503 },
    );
  }
}
