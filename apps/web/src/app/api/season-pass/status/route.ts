/**
 * GET /api/season-pass/status?wallet=0x...
 *
 * Returns the active Lite Season Pass for a wallet, if any.
 *
 * Redis holds the entitlement (set at purchase, auto-expires at pass end) and
 * is what keeps access alive when Supabase is down. It does NOT know which
 * season was purchased, so it can no longer answer alone: the season is read
 * from the row and resolved ONCE, canonically, for every branch.
 * Spec: docs/specs/2026-07-27-focus-days-ledger.md (APPROVED 2026-07-27), AC25/AC30.
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
import type { FocusDaysSlice } from "@/lib/season-pass/focus-days";
import {
  FOCUS_DAYS_GATE_REDIS_KEY,
  resolveFocusDaysGate,
} from "@/lib/season-pass/focus-days-gate";
import {
  countFocusDays,
  ensureFocusLedgerInitialized,
  parseBackfillReport,
  type SupabaseServer,
} from "@/lib/season-pass/focus-ledger-init";
import { createLogger, hashWallet } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

/** The route can initialize the ledger, so a cached copy of it would be a bug
 *  nobody can reproduce. */
export const dynamic = "force-dynamic";

const redis = Redis.fromEnv();
const log = createLogger({ route: "/api/season-pass/status" });

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/i;

type SeasonPassRow = {
  expires_at: string;
  season_id: string;
  supporter_status: string | null;
  shields_credited: number | null;
};

/** The purchased row, or the fact that the ledger could not answer. Kept apart
 *  on purpose: "no pass" and "cannot tell" must not collapse into one value —
 *  one revokes access, the other only degrades progress. */
type LedgerRead =
  | { status: "ok"; row: SeasonPassRow | null }
  | { status: "unavailable" };

/** Cached expiry when it is present AND still in the future; null otherwise.
 *  A Redis outage reads as "no cache", never as "no entitlement". */
async function readCachedExpiry(wallet: string): Promise<string | null> {
  try {
    const cached = await redis.get<string>(REDIS_KEYS.seasonPass(wallet));
    if (cached && new Date(cached) > new Date()) return cached;
  } catch (e) {
    log.warn("redis_status_check_failed", { wallet, err: String(e) });
  }
  return null;
}

async function readSeasonPassRow(
  supabase: SupabaseServer,
  wallet: string,
): Promise<LedgerRead> {
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
      return { status: "unavailable" };
    }
    return { status: "ok", row: (data as SeasonPassRow | null) ?? null };
  } catch (e) {
    log.error("unexpected_error", { wallet, err: String(e) });
    return { status: "unavailable" };
  }
}

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

  const configuredPass = getSeasonPass("lite_season_pass_21");
  const supabase = getSupabaseServer();
  if (!supabase) log.error("supabase_unavailable", { wallet });

  const cachedExpiresAt = await readCachedExpiry(wallet);
  const ledger: LedgerRead = supabase
    ? await readSeasonPassRow(supabase, wallet)
    : { status: "unavailable" };
  const row = ledger.status === "ok" ? ledger.row : null;

  // The row wins when it exists; the cache still grants access when it does
  // not. What the cache may never do is supply a season it never saw.
  const seasonPass = row
    ? { active: true, expiresAt: row.expires_at, seasonId: row.season_id }
    : cachedExpiresAt
      ? { active: true, expiresAt: cachedExpiresAt, seasonId: null }
      : { active: false, expiresAt: null };

  const details: Record<string, unknown> = row
    ? {
        expiresAt: row.expires_at,
        supporterStatus: row.supporter_status ?? "challenger",
        shieldsCredited: row.shields_credited ?? 3,
        storageSource: "db",
      }
    : cachedExpiresAt
      ? {
          expiresAt: cachedExpiresAt,
          supporterStatus: configuredPass.supporterStatus,
          shieldsCredited: configuredPass.shieldsOnPurchase,
          storageSource: "redis",
        }
      : {};

  const effective = resolveEffectiveTrainingPass({
    seasonPass,
    pro,
    configuredSeasonId: configuredPass.seasonId,
  });
  // `details` never carries `seasonId`: the resolver owns that field, and a
  // spread that overwrites it is how the two branches diverged before.
  const body: Record<string, unknown> = { ...effective, ...details };

  // A ledger that cannot answer only costs progress. It costs access solely
  // when there is no other proof of entitlement at all.
  if (ledger.status === "unavailable" && !effective.active) {
    return json({ ...body, error: "ledger_unavailable" }, 503);
  }

  if (effective.active) {
    body.focusDays = await resolveFocusDays({
      supabase,
      wallet,
      seasonId: effective.seasonId,
      expiresAt: effective.seasonPassExpiresAt,
      report: parseBackfillReport(searchParams),
    });
  }

  return json(body);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

/**
 * Progress, or an honest admission that it is not available.
 *
 * `disabled` and `unavailable` are different answers on purpose: one is a
 * decision we made, the other is a failure we had, and the card must not
 * render them the same. Neither ever falls back to the streak.
 */
async function resolveFocusDays(input: {
  supabase: SupabaseServer | null;
  wallet: string;
  seasonId: string | null;
  expiresAt: string | null;
  report: ReturnType<typeof parseBackfillReport>;
}): Promise<FocusDaysSlice> {
  const { supabase, wallet, seasonId, expiresAt, report } = input;
  const configuredPass = getSeasonPass("lite_season_pass_21");

  const gate = resolveFocusDaysGate(
    await readGateOverride(wallet),
    process.env.FOCUS_DAYS_LEDGER_ENABLED,
  );
  if (gate.invalidOverride !== undefined) {
    log.error("focus_days_gate_invalid_override", {
      wallet: hashWallet(wallet),
      value: gate.invalidOverride,
    });
  }
  if (!gate.enabled) {
    return { status: "disabled" };
  }

  // No season means the buyer's row was not read. Counting against the
  // configured literal would attribute their days to the wrong temporada.
  if (!supabase || !seasonId) return { status: "unavailable" };

  const init = await ensureFocusLedgerInitialized({
    supabase,
    wallet,
    seasonId,
    report,
    expiresAt,
    durationDays: configuredPass.durationDays,
    goal: configuredPass.durationDays,
  });
  if (init.status === "seeded" && init.seededRows > 0) {
    log.info("focus_day_backfilled", {
      wallet: hashWallet(wallet),
      seeded_rows: init.seededRows,
    });
  }

  const completed = await countFocusDays(supabase, wallet, seasonId);
  if (completed === null) {
    log.warn("focus_day_ledger_unavailable", { wallet: hashWallet(wallet) });
    return { status: "unavailable" };
  }

  return {
    status: "ok",
    completed,
    goal: configuredPass.durationDays,
    seasonId,
  };
}

/** The kill switch override. A Redis outage reads as "no override", never as
 *  "off": a cache blip must not silently retire a shipped feature. */
async function readGateOverride(wallet: string): Promise<string | null> {
  try {
    return await redis.get<string>(FOCUS_DAYS_GATE_REDIS_KEY);
  } catch (e) {
    log.warn("focus_days_gate_read_failed", { wallet: hashWallet(wallet), err: String(e) });
    return null;
  }
}
