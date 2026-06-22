/**
 * GET /api/admin/lite-stats — Lite B1.2 grant readiness dashboard.
 *
 * Returns event counts for the Lite loop funnels, filtered to events
 * that carry `props.isLite === true`. This prevents Full-mode events
 * (daily_tactic_started, exercise_complete, etc.) from polluting the
 * Lite cohort numbers.
 *
 * Auth: server-only `ADMIN_TOKEN` shared secret via `x-admin-token`
 * header (same pattern as /api/admin/content).
 *
 * Query params:
 *   from  — YYYY-MM-DD inclusive (defaults to 7 days ago UTC)
 *   to    — YYYY-MM-DD inclusive (defaults to today UTC)
 *
 * Response shape (all counts are integers ≥ 0):
 * {
 *   period: { from: string; to: string };
 *   lite_sessions: number;
 *   daily_tactic_starts: number;
 *   daily_tactic_completions: number;
 *   daily_streak_updates: number;
 *   claim_gift_taps: number;
 *   claim_gift_successes: number;
 *   claim_gift_rejections: number;
 *   claim_gift_failures: number;
 *   exercise_completions: number;
 *   labyrinth_completions: number;
 * }
 *
 * Implementation note: we SELECT the rows in the range and count in
 * server memory (filtering props.isLite === true), rather than relying
 * on JSONB operators, to stay portable across Supabase plan tiers.
 * Volume is small (grant readiness = early users only).
 */

import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const LITE_EVENTS = [
  "lite_session_started",
  "daily_tactic_started",
  "daily_tactic_completed",
  "daily_streak_updated",
  "claim_gift_tap",
  "claim_gift_success",
  "claim_gift_rejected",
  "claim_gift_failed",
  "exercise_complete",
  "labyrinth_complete",
  "passport_slots_updated",
] as const;

type LiteEvent = (typeof LITE_EVENTS)[number];

function err(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function tokenMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const sha = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(sha(provided), sha(expected));
}

function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultFrom(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 6);
  return utcDateString(d);
}

function defaultTo(): string {
  return utcDateString(new Date());
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export async function GET(request: Request) {
  // 1. Auth gate — same pattern as /api/admin/content.
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return err("admin reads disabled", 503);

  const provided = request.headers.get("x-admin-token");
  if (!tokenMatches(provided, expected)) return err("forbidden", 403);

  // 2. Parse date range.
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? defaultFrom();
  const to = searchParams.get("to") ?? defaultTo();

  if (!isValidDate(from) || !isValidDate(to)) {
    return err("invalid date format — use YYYY-MM-DD", 400);
  }
  if (from > to) return err("from must be ≤ to", 400);

  // 3. Fetch rows in range (event name IN list, date inclusive).
  //    `to` is inclusive: we query < (to + 1 day) so the full to-date is covered.
  const toExclusive = utcDateString(new Date(new Date(to).getTime() + 86_400_000));

  const supabase = getSupabaseServer();
  if (!supabase) return err("database unavailable", 503);

  const { data, error } = await supabase
    .from("analytics_events")
    .select("event, props")
    .in("event", LITE_EVENTS)
    .gte("created_at", `${from}T00:00:00Z`)
    .lt("created_at", `${toExclusive}T00:00:00Z`);

  if (error) return err("query failed", 500);

  // 4. Filter server-side to isLite === true rows only.
  //    This prevents Full-mode daily_tactic_* and exercise_complete events
  //    from inflating the Lite cohort numbers.
  const liteRows = (data ?? []).filter(
    (row) =>
      row.props !== null &&
      typeof row.props === "object" &&
      !Array.isArray(row.props) &&
      (row.props as Record<string, unknown>)["isLite"] === true,
  );

  // 5. Count per event.
  const counts: Record<LiteEvent, number> = {
    lite_session_started: 0,
    daily_tactic_started: 0,
    daily_tactic_completed: 0,
    daily_streak_updated: 0,
    claim_gift_tap: 0,
    claim_gift_success: 0,
    claim_gift_rejected: 0,
    claim_gift_failed: 0,
    exercise_complete: 0,
    labyrinth_complete: 0,
    passport_slots_updated: 0,
  };

  for (const row of liteRows) {
    const ev = row.event as LiteEvent;
    if (ev in counts) counts[ev]++;
  }

  return NextResponse.json({
    period: { from, to },
    lite_sessions: counts["lite_session_started"],
    daily_tactic_starts: counts["daily_tactic_started"],
    daily_tactic_completions: counts["daily_tactic_completed"],
    daily_streak_updates: counts["daily_streak_updated"],
    claim_gift_taps: counts["claim_gift_tap"],
    claim_gift_successes: counts["claim_gift_success"],
    claim_gift_rejections: counts["claim_gift_rejected"],
    claim_gift_failures: counts["claim_gift_failed"],
    exercise_completions: counts["exercise_complete"],
    labyrinth_completions: counts["labyrinth_complete"],
    passport_updates: counts["passport_slots_updated"],
  });
}
