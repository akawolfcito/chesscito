/**
 * Focus Days ledger — reads and the one-shot backfill.
 *
 * Spec: docs/specs/2026-07-27-focus-days-ledger.md (APPROVED 2026-07-27).
 *
 * The date math lives in `focus-days.ts` and stays pure. This file is the thin
 * layer that talks to Supabase: count the rows, and seed the history a player
 * had before the ledger existed — once per (wallet, season), never again.
 */

import type { getSupabaseServer } from "@/lib/supabase/server";
import { backfillDates, elapsedEligibleDays, passWindowStartUtc } from "./focus-days";

export type SupabaseServer = NonNullable<ReturnType<typeof getSupabaseServer>>;

/** What the client claims its local state is. `null` means "not known yet"
 *  (localStorage unhydrated), which is NOT the same as zero. */
export type BackfillReport = {
  streak: number;
  lastCompletedDate: string | null;
};

export type InitResult = {
  status: "skipped" | "already" | "seeded" | "unavailable";
  seededRows: number;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reads the client's self-report off the query string.
 *
 * The whole contract is the difference between absent and zero: `?streak=0` is
 * a player saying "I have no streak" and gets latched; a missing param is a
 * client that has not hydrated yet and must be allowed to try again
 * (see feedback_never_decide_from_unhydrated_state).
 */
export function parseBackfillReport(params: URLSearchParams): BackfillReport | null {
  const raw = params.get("streak");
  if (raw === null || raw.trim() === "") return null;

  const streak = Number(raw);
  if (!Number.isInteger(streak) || streak < 0) return null;

  const rawDate = params.get("lastCompletedDate");
  const lastCompletedDate = rawDate && DATE_RE.test(rawDate) ? rawDate : null;

  // A run with no anchor cannot be placed on a calendar. Latching on it would
  // freeze that player at zero forever, so it counts as "not known yet".
  if (streak > 0 && !lastCompletedDate) return null;

  return { streak, lastCompletedDate };
}

/** Distinct days completed in this season. `null` when the ledger cannot
 *  answer — the caller renders `degraded`, never a zero it invented. */
export async function countFocusDays(
  supabase: SupabaseServer,
  wallet: string,
  seasonId: string,
): Promise<number | null> {
  try {
    const { count, error } = await supabase
      .from("focus_day_ledger")
      .select("*", { count: "exact", head: true })
      .eq("wallet", wallet)
      .eq("season_id", seasonId);

    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

/**
 * Seeds the days a player earned before this ledger existed, once.
 *
 * Ordering is the whole safety argument: read the latch, then seed, then latch.
 * A failed seed must not latch, or the player loses their history permanently.
 * A failed latch is harmless — the seed is idempotent through the UNIQUE, so
 * the next call rewrites the same rows and tries the latch again.
 */
export async function ensureFocusLedgerInitialized(input: {
  supabase: SupabaseServer;
  wallet: string;
  seasonId: string;
  report: BackfillReport | null;
  expiresAt: string | null;
  durationDays: number;
  goal: number;
  now?: number;
}): Promise<InitResult> {
  const { supabase, wallet, seasonId, report, expiresAt, durationDays, goal } = input;
  const now = input.now ?? Date.now();

  if (!report) return { status: "skipped", seededRows: 0 };

  try {
    const { data: latch, error: latchError } = await supabase
      .from("focus_ledger_init")
      .select("wallet")
      .eq("wallet", wallet)
      .eq("season_id", seasonId)
      .maybeSingle();

    if (latchError) return { status: "unavailable", seededRows: 0 };
    if (latch) return { status: "already", seededRows: 0 };

    const windowStartUtc = passWindowStartUtc(expiresAt, durationDays);
    const dates = windowStartUtc
      ? backfillDates({
          reportedStreak: report.streak,
          lastCompletedDate: report.lastCompletedDate,
          elapsed: elapsedEligibleDays(expiresAt, durationDays, now),
          goal,
          windowStartUtc,
          todayUtc: new Date(now).toISOString().slice(0, 10),
        })
      : [];

    if (dates.length > 0) {
      // One multi-row INSERT (AC29). N round-trips would also be N chances to
      // half-seed someone.
      const { error } = await supabase.from("focus_day_ledger").upsert(
        dates.map((date) => ({
          wallet,
          season_id: seasonId,
          date_utc: date,
          source: "backfill_streak",
        })),
        { onConflict: "wallet,season_id,date_utc", ignoreDuplicates: true },
      );
      if (error) return { status: "unavailable", seededRows: 0 };
    }

    await supabase
      .from("focus_ledger_init")
      .upsert(
        { wallet, season_id: seasonId, seeded_rows: dates.length },
        { onConflict: "wallet,season_id", ignoreDuplicates: true },
      );

    return { status: "seeded", seededRows: dates.length };
  } catch {
    return { status: "unavailable", seededRows: 0 };
  }
}
