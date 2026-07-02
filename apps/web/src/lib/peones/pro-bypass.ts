/**
 * PRO bypass resolver + daily quota tracker.
 *
 * Sprint 4 commit G of Training Economy Alpha 2026-06-08. Server-only
 * (imports Supabase via `getSupabaseServer`). Client MUST NEVER call
 * these helpers — bypass is decided server-side.
 *
 * Order of consumption (calibration §7, founder sign-off 2026-06-08):
 *   1. Redis Coach credits   (legacy path — handled outside this file)
 *   2. PRO bypass            (this file: PRO active + within daily
 *                             quota → `peones_spend` row inserts with
 *                             pro_bypass=true, debited=0, balance
 *                             untouched)
 *   3. Peones spend          (this file returns "skip bypass" → caller
 *                             debits 1 Peón normally)
 *   4. Upsell / paywall      (caller falls through when balance is
 *                             insufficient)
 *
 * Quota tracking is derived from the ledger: a row with
 *   event_type='spend' AND source=<target> AND pro_bypass=true
 *   AND day_utc=<today_utc>
 * counts as 1 used bypass. The query uses the partial index
 * `peones_ledger_pro_bypass_quota_idx` shipped in commit B.
 */

import { isProActive } from "@/lib/pro/is-active";
import type { PeonesSpendTarget } from "@/lib/peones/spend-service";
import { getSupabaseServer } from "@/lib/supabase/server";

/** M1 daily PRO bypass quotas per calibration §6. Save game is
 *  unlimited (low-explotation acción). Sprint 4 surfaces ship:
 *  coach (E in F), hint (E), retry (later), save_game (later). */
export const PRO_BYPASS_DAILY_QUOTA: Readonly<
  Record<PeonesSpendTarget, number>
> = {
  coach: 5,
  hint: 20,
  retry: 10,
  // Shield: no PRO entitlement decided yet. 0 = PRO pays same 2 Peones as anyone else
  // via fallback. Easy to raise later (change one number) if operator decides otherwise.
  shield: 0,
  // Save game has no PRO cost in the first place; PRO sees ilimitado.
  save_game: Number.POSITIVE_INFINITY,
};

export type ProBypassEvaluation =
  | {
      apply: true;
      proActive: true;
      quotaLimit: number;
      quotaUsedBefore: number;
      quotaRemainingBefore: number;
    }
  | {
      apply: false;
      proActive: false;
      reason: "not_pro";
    }
  | {
      apply: false;
      proActive: true;
      reason: "quota_exhausted";
      quotaLimit: number;
      quotaUsedBefore: number;
    }
  | {
      apply: false;
      proActive: true;
      reason: "quota_lookup_failed";
      quotaLimit: number;
    };

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Counts the bypass rows the wallet already consumed today for this
 *  target. Returns `null` on lookup failure so the caller can decide
 *  whether to fail-closed (deny bypass) or proceed. */
export async function countDailyProBypass(
  wallet: string,
  target: PeonesSpendTarget,
  dayUtc: string = todayUtcDate(),
): Promise<number | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;
  const { count, error } = await supabase
    .from("peones_ledger")
    .select("id", { count: "exact", head: true })
    .eq("wallet", wallet)
    .eq("source", target)
    .eq("event_type", "spend")
    .eq("pro_bypass", true)
    .eq("day_utc", dayUtc);
  if (error) return null;
  return count ?? 0;
}

/**
 * Server-side PRO bypass decision. Reads PRO status from Redis (via
 * the existing `isProActive` helper — single source of truth for the
 * Coach analyze flow too) and the daily quota from the ledger.
 *
 * Returns a discriminated union so the caller can branch on
 * `apply` boolean. The non-apply branches carry a `reason` so
 * telemetry can distinguish "free user", "quota exhausted", and
 * "lookup failed" without re-reading the same state.
 *
 * Fail-closed: any Redis / Supabase failure returns `apply=false`.
 * A forged client request can NEVER force bypass — the apply flag
 * is computed exclusively here.
 */
export async function resolveProBypass(
  wallet: string,
  target: PeonesSpendTarget,
  dayUtc: string = todayUtcDate(),
): Promise<ProBypassEvaluation> {
  const lowered = wallet.toLowerCase();
  const limit = PRO_BYPASS_DAILY_QUOTA[target];

  // 1. PRO check first — most users are free, this short-circuits
  //    before touching Supabase.
  let proStatus: { active: boolean };
  try {
    proStatus = await isProActive(lowered);
  } catch {
    return { apply: false, proActive: false, reason: "not_pro" };
  }
  if (!proStatus.active) {
    return { apply: false, proActive: false, reason: "not_pro" };
  }

  // 2. Unlimited targets (save_game) skip the count entirely.
  if (!Number.isFinite(limit)) {
    return {
      apply: true,
      proActive: true,
      quotaLimit: limit,
      quotaUsedBefore: 0,
      quotaRemainingBefore: limit,
    };
  }

  // 3. Quota lookup.
  const used = await countDailyProBypass(lowered, target, dayUtc);
  if (used == null) {
    return {
      apply: false,
      proActive: true,
      reason: "quota_lookup_failed",
      quotaLimit: limit,
    };
  }

  if (used >= limit) {
    return {
      apply: false,
      proActive: true,
      reason: "quota_exhausted",
      quotaLimit: limit,
      quotaUsedBefore: used,
    };
  }

  return {
    apply: true,
    proActive: true,
    quotaLimit: limit,
    quotaUsedBefore: used,
    quotaRemainingBefore: limit - used,
  };
}
