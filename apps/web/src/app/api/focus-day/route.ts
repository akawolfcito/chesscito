/**
 * POST /api/focus-day — records one completed Focus Day.
 *
 * Spec: docs/specs/2026-07-27-focus-days-ledger.md (APPROVED 2026-07-27).
 *
 * The server owns the date. A client sends `date` only to reconcile a day it
 * could not report at the time, and only for today or yesterday — this is not
 * a registrar of arbitrary history.
 *
 * Idempotency is the UNIQUE (wallet, season_id, date_utc), never a read-then-
 * write check: two devices finishing the same day must leave one row.
 *
 * Contract:
 *   200 → { ok: true, progress: { completed, goal } }
 *   400 → { ok: false, error: "invalid_wallet" | "invalid_date" }
 *   403 → { ok: false, error: "no_entitlement" | "disabled" }
 *   429 → { ok: false, error: "rate_limited" }
 *   503 → { ok: false, error: "ledger_unavailable" }
 *
 * A failure here never blocks the game: the Daily completes locally regardless
 * (behavior 15). The ledger records the habit; it does not gate it.
 */

import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

import { resolveEffectiveTrainingPass } from "@/lib/entitlements/effective-training-pass";
import { getSeasonPass } from "@/lib/payments/rail-config";
import { isProActive } from "@/lib/pro/is-active";
import { focusDaysProgress, isEligibleFocusDate, passWindowStartUtc } from "@/lib/season-pass/focus-days";
import {
  FOCUS_DAYS_GATE_REDIS_KEY,
  resolveFocusDaysGate,
} from "@/lib/season-pass/focus-days-gate";
import { countFocusDays } from "@/lib/season-pass/focus-ledger-init";
import { readSeasonPassRow } from "@/lib/season-pass/read-season-pass-row";
import { enforceFocusDayRateLimit } from "@/lib/server/demo-signing";
import { createLogger, hashWallet } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const redis = Redis.fromEnv();
const log = createLogger({ route: "/api/focus-day" });

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/i;

type ErrorCode =
  | "invalid_wallet"
  | "invalid_date"
  | "no_entitlement"
  | "ledger_unavailable"
  | "rate_limited"
  | "disabled";

function fail(error: ErrorCode, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_wallet", 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return fail("invalid_wallet", 400);
  }

  const { wallet: rawWallet, date: rawDate } = body as Record<string, unknown>;
  if (typeof rawWallet !== "string" || !ADDRESS_RE.test(rawWallet)) {
    return fail("invalid_wallet", 400);
  }
  const wallet = rawWallet.toLowerCase();
  const walletHash = hashWallet(wallet);

  // The kill switch comes before everything with a cost. Off means no read, no
  // write, no backfill.
  const gate = resolveFocusDaysGate(
    await readGateOverride(walletHash),
    process.env.FOCUS_DAYS_LEDGER_ENABLED,
  );
  if (gate.invalidOverride !== undefined) {
    log.error("focus_days_gate_invalid_override", {
      wallet: walletHash,
      value: gate.invalidOverride,
    });
  }
  if (!gate.enabled) {
    log.info("focus_day_disabled", { wallet: walletHash });
    return fail("disabled", 403);
  }

  try {
    await enforceFocusDayRateLimit(wallet);
  } catch {
    log.warn("focus_day_rate_limited", { wallet: walletHash });
    return fail("rate_limited", 429);
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    log.error("focus_day_ledger_unavailable", { wallet: walletHash, reason: "no_client" });
    return fail("ledger_unavailable", 503);
  }

  let pro: Awaited<ReturnType<typeof isProActive>>;
  try {
    pro = await isProActive(wallet);
  } catch (e) {
    log.error("focus_day_ledger_unavailable", { wallet: walletHash, err: String(e) });
    return fail("ledger_unavailable", 503);
  }

  const ledger = await readSeasonPassRow(supabase, wallet);
  if (ledger.status === "unavailable") {
    log.error("focus_day_ledger_unavailable", { wallet: walletHash, code: ledger.code });
    return fail("ledger_unavailable", 503);
  }

  const configuredPass = getSeasonPass("lite_season_pass_21");
  const effective = resolveEffectiveTrainingPass({
    seasonPass: ledger.row
      ? { active: true, expiresAt: ledger.row.expires_at, seasonId: ledger.row.season_id }
      : { active: false, expiresAt: null },
    pro,
    configuredSeasonId: configuredPass.seasonId,
  });

  // No entitlement, and no season to attribute a day to, are the same refusal
  // from the writer's side: there is nothing legitimate to write.
  if (!effective.active || !effective.seasonId || !effective.source) {
    log.info("focus_day_no_entitlement", { wallet: walletHash });
    return fail("no_entitlement", 403);
  }

  const now = Date.now();
  const todayUtc = new Date(now).toISOString().slice(0, 10);
  let dateUtc = todayUtc;
  let source: "daily" | "daily_retry" = "daily";

  if (rawDate !== undefined) {
    const eligible =
      typeof rawDate === "string" &&
      isEligibleFocusDate({
        date: rawDate,
        now,
        source: effective.source,
        windowStartUtc: passWindowStartUtc(
          effective.seasonPassExpiresAt,
          configuredPass.accessDurationDays,
        ),
        expiresAt: effective.seasonPassExpiresAt,
        proExpiresAt: effective.proExpiresAt,
      });
    if (!eligible) {
      log.warn("focus_day_invalid_date", { wallet: walletHash });
      return fail("invalid_date", 400);
    }
    dateUtc = rawDate as string;
    source = "daily_retry";
  }

  const { data: inserted, error } = await supabase
    .from("focus_day_ledger")
    .upsert(
      { wallet, season_id: effective.seasonId, date_utc: dateUtc, source },
      { onConflict: "wallet,season_id,date_utc", ignoreDuplicates: true },
    )
    .select("id");

  if (error) {
    log.error("focus_day_ledger_unavailable", { wallet: walletHash, code: error.code });
    return fail("ledger_unavailable", 503);
  }

  // ignoreDuplicates returns no row for a day already recorded. That is the
  // normal second POST of a day, not an error.
  const wrote = Array.isArray(inserted) && inserted.length > 0;
  log[wrote ? "info" : "warn"](wrote ? "focus_day_written" : "focus_day_duplicate", {
    wallet: walletHash,
    source,
  });

  const completed = await countFocusDays(supabase, wallet, effective.seasonId);
  if (completed === null) {
    log.error("focus_day_ledger_unavailable", { wallet: walletHash, phase: "count" });
    return fail("ledger_unavailable", 503);
  }

  return NextResponse.json({
    ok: true,
    progress: focusDaysProgress(completed, configuredPass.challengeGoalDays),
  });
}

/** A Redis outage reads as "no override", never as "off". */
async function readGateOverride(walletHash: string): Promise<string | null> {
  try {
    return await redis.get<string>(FOCUS_DAYS_GATE_REDIS_KEY);
  } catch (e) {
    log.warn("focus_days_gate_read_failed", { wallet: walletHash, err: String(e) });
    return null;
  }
}
