/**
 * POST /api/peones/earn
 *
 * Sprint 3 commit D of Training Economy Alpha 2026-06-07. First REAL
 * write to the Peones ledger. Append-only INSERT. Idempotent against
 * the per-source idempotency_key. Truncates the credited amount to
 * the daily cap when the source is daily-family.
 *
 * NO UI consumer yet. NO Daily Tactic / Training wiring (those land
 * in commits E and F respectively). NO spend, NO update, NO delete.
 * NO localStorage write anywhere in the request flow. The HUD chip
 * (commit G) and the telemetry events (commit H) consume what this
 * endpoint produces.
 *
 * Contract (calibration §5.2):
 *   200 → { wallet, requested, credited, capReached, newBalance,
 *           dailyEarnedCapped, dailyCap, attestationHash, ledgerId,
 *           duplicate? }
 *   400 → { error: "invalid_input" | "invalid_wallet"
 *                  | "invalid_source" | "invalid_idempotency_key" }
 *   429 → { error: "rate_limited" }
 *   500 → { error: "ledger_unavailable" | "ledger_write_failed" }
 *
 * Pre-migration safety: the SQL function + table land via the
 * migration committed in commit A but NOT yet applied to hosted
 * Supabase. Until the apply, the rpc + insert paths return errors
 * the handler maps to 500.
 */

import { NextResponse } from "next/server";

import {
  applyDailyCap,
  isDailyCapSource,
  normalizeWallet,
} from "@/lib/peones/ledger-service";
import { buildAttestationHash } from "@/lib/peones/ledger-service-server";
import { PEONES_DAILY_CAP } from "@/lib/peones/types";
import type { PeonesLedgerSource } from "@/lib/peones/types";
import {
  enforceOrigin,
  enforceReadRateLimit,
  getRequestIp,
} from "@/lib/server/demo-signing";
import { createLogger } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

const log = createLogger({ route: "/api/peones/earn" });

/** Defensive single-event cap. Daily cap applies on top per
 *  isDailyCapSource(); this guard catches client bugs sending
 *  absurd amounts before they touch the DB. */
const MAX_SINGLE_EVENT_AMOUNT = 50;

/** Sprint 3 allow-list of earn sources reachable through this
 *  endpoint. Earn-only by definition; spend sources are Sprint 4.
 *  `senda_milestone` and `pack_purchase` are deliberately excluded
 *  per calibration §6 — parked until product activates them. */
const SPRINT_3_EARN_SOURCES = new Set<PeonesLedgerSource>([
  "daily_tactic",
  "daily_streak_bonus",
  "daily_lab",
  "exercise_completion",
  "admin_grant",
]);

/** Each source's idempotency_key MUST start with the documented
 *  prefix from calibration §9 so a misrouted client request can't
 *  silently land on the wrong economic loop. `admin_grant` is left
 *  open — ops tooling builds keys by hand. */
const IDEMPOTENCY_PREFIX_BY_SOURCE: Partial<Record<PeonesLedgerSource, string>> = {
  daily_tactic: "daily_tactic:",
  daily_streak_bonus: "daily_streak_bonus:",
  daily_lab: "daily_lab:",
  exercise_completion: "training:",
};

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

type ParsedInput = {
  wallet: string;
  amount: number;
  source: PeonesLedgerSource;
  sourceId: string;
  idempotencyKey: string;
  metadata: Record<string, unknown> | null;
};

type ParseResult =
  | { ok: true; value: ParsedInput }
  | { ok: false; error: "invalid_input" | "invalid_wallet" | "invalid_source" | "invalid_idempotency_key" };

function parseAndValidate(body: unknown): ParseResult {
  if (!isPlainObject(body)) return { ok: false, error: "invalid_input" };

  const rawWallet = body.wallet;
  if (typeof rawWallet !== "string") return { ok: false, error: "invalid_wallet" };
  let wallet: string;
  try {
    wallet = normalizeWallet(rawWallet);
  } catch {
    return { ok: false, error: "invalid_wallet" };
  }

  const amount = body.amount;
  if (
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    amount <= 0 ||
    amount > MAX_SINGLE_EVENT_AMOUNT
  ) {
    return { ok: false, error: "invalid_input" };
  }

  const source = body.source;
  if (
    typeof source !== "string" ||
    !SPRINT_3_EARN_SOURCES.has(source as PeonesLedgerSource)
  ) {
    return { ok: false, error: "invalid_source" };
  }
  const typedSource = source as PeonesLedgerSource;

  const sourceId = body.sourceId;
  if (typeof sourceId !== "string" || sourceId.length === 0 || sourceId.length > 200) {
    return { ok: false, error: "invalid_input" };
  }

  const idempotencyKey = body.idempotencyKey;
  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.length === 0 ||
    idempotencyKey.length > 200
  ) {
    return { ok: false, error: "invalid_idempotency_key" };
  }
  const requiredPrefix = IDEMPOTENCY_PREFIX_BY_SOURCE[typedSource];
  if (requiredPrefix && !idempotencyKey.startsWith(requiredPrefix)) {
    return { ok: false, error: "invalid_idempotency_key" };
  }

  let metadata: Record<string, unknown> | null = null;
  if (body.metadata !== undefined) {
    if (!isPlainObject(body.metadata)) return { ok: false, error: "invalid_input" };
    try {
      // Round-trip JSON to assert the object is fully serialisable —
      // catches BigInt, Functions, undefined values, cyclic refs.
      metadata = JSON.parse(JSON.stringify(body.metadata)) as Record<string, unknown>;
    } catch {
      return { ok: false, error: "invalid_input" };
    }
  }

  return {
    ok: true,
    value: { wallet, amount, source: typedSource, sourceId, idempotencyKey, metadata },
  };
}

export async function POST(req: Request) {
  try {
    enforceOrigin(req);
    await enforceReadRateLimit(getRequestIp(req));
  } catch (e) {
    log.warn("guard_failed", { reason: (e as Error)?.message });
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = parseAndValidate(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { wallet, amount, source, sourceId, idempotencyKey, metadata } = parsed.value;

  const supabase = getSupabaseServer();
  if (!supabase) {
    log.error("supabase_unavailable", { wallet, source });
    return NextResponse.json({ error: "ledger_unavailable" }, { status: 500 });
  }

  // ── Idempotency pre-check ──────────────────────────────────────
  // If the key already exists we treat the request as a no-op replay
  // and return the original row's economic facts. The endpoint stays
  // append-only and the client gets a 200 it can render the same way
  // it rendered the original response.
  const { data: existingRow, error: existingErr } = await supabase
    .from("peones_ledger")
    .select("id, amount, attestation_hash, day_utc")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingErr) {
    log.error("idempotency_lookup_failed", {
      wallet,
      idempotencyKey,
      code: existingErr.code,
      message: existingErr.message,
    });
    return NextResponse.json({ error: "ledger_unavailable" }, { status: 500 });
  }

  const today = todayUtcDate();

  if (existingRow) {
    // Replay — re-read cap + balance so the client sees the current
    // post-state, then return the same attestation/ledger id from
    // the original write.
    const { data: capRows } = await supabase.rpc("peones_balance_with_caps", {
      p_wallet: wallet,
      p_day_utc: today,
    });
    const capRow = Array.isArray(capRows) ? capRows[0] : capRows;
    const balance = capRow ? Number(capRow.balance ?? 0) : 0;
    const dailyEarnedCapped = capRow ? Number(capRow.daily_earned_capped ?? 0) : 0;
    const dailyCap = capRow ? Number(capRow.daily_cap ?? PEONES_DAILY_CAP) : PEONES_DAILY_CAP;
    return NextResponse.json({
      wallet,
      requested: amount,
      credited: Number(existingRow.amount ?? 0),
      capReached: dailyEarnedCapped >= dailyCap,
      newBalance: balance,
      dailyEarnedCapped,
      dailyCap,
      attestationHash: existingRow.attestation_hash ?? null,
      ledgerId: existingRow.id ?? null,
      duplicate: true,
    });
  }

  // ── Cap application ────────────────────────────────────────────
  const { data: capRows, error: capError } = await supabase.rpc(
    "peones_balance_with_caps",
    { p_wallet: wallet, p_day_utc: today },
  );
  if (capError) {
    log.error("rpc_failed", {
      wallet,
      code: capError.code,
      message: capError.message,
    });
    return NextResponse.json({ error: "ledger_unavailable" }, { status: 500 });
  }
  const capRow = Array.isArray(capRows) ? capRows[0] : capRows;
  const balanceBefore = capRow ? Number(capRow.balance ?? 0) : 0;
  const dailyEarnedCappedBefore = capRow ? Number(capRow.daily_earned_capped ?? 0) : 0;
  const dailyCap = capRow ? Number(capRow.daily_cap ?? PEONES_DAILY_CAP) : PEONES_DAILY_CAP;

  let credited: number;
  let capReached: boolean;
  if (isDailyCapSource(source)) {
    const result = applyDailyCap({
      requestedAmount: amount,
      dailyEarnedCapped: dailyEarnedCappedBefore,
      dailyCap,
    });
    credited = result.creditedAmount;
    capReached = result.capReached;
  } else {
    credited = amount;
    capReached = false;
  }

  // Zero-credit branch: NEVER insert an amount=0 row (calibration
  // §3.1 amount > 0 check). Return the cap-reached signal so the
  // client renders "daily cap reached" without polluting the
  // ledger with no-op rows.
  if (credited === 0) {
    return NextResponse.json({
      wallet,
      requested: amount,
      credited: 0,
      capReached: true,
      newBalance: balanceBefore,
      dailyEarnedCapped: dailyEarnedCappedBefore,
      dailyCap,
      attestationHash: null,
      ledgerId: null,
    });
  }

  // ── Attestation hash + insert ──────────────────────────────────
  const attestationHash = buildAttestationHash({
    wallet,
    event_type: "earn",
    amount: credited,
    source,
    source_id: sourceId,
    day_utc: today,
    idempotency_key: idempotencyKey,
  });

  const { data: insertedRows, error: insertError } = await supabase
    .from("peones_ledger")
    .insert({
      wallet,
      event_type: "earn",
      amount: credited,
      source,
      source_id: sourceId,
      idempotency_key: idempotencyKey,
      attestation_hash: attestationHash,
      metadata,
      day_utc: today,
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    // Race condition: another in-flight request inserted with the
    // same idempotency_key between our pre-check and our insert.
    // Re-resolve the existing row idempotently — the second writer
    // returns the first writer's row (calibration R1).
    if (insertError.code === "23505") {
      const { data: raceRow } = await supabase
        .from("peones_ledger")
        .select("id, amount, attestation_hash")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (raceRow) {
        return NextResponse.json({
          wallet,
          requested: amount,
          credited: Number(raceRow.amount ?? 0),
          capReached,
          newBalance: balanceBefore + Number(raceRow.amount ?? 0),
          dailyEarnedCapped: isDailyCapSource(source)
            ? dailyEarnedCappedBefore + Number(raceRow.amount ?? 0)
            : dailyEarnedCappedBefore,
          dailyCap,
          attestationHash: raceRow.attestation_hash ?? null,
          ledgerId: raceRow.id ?? null,
          duplicate: true,
        });
      }
    }
    log.error("insert_failed", {
      wallet,
      code: insertError.code,
      message: insertError.message,
    });
    return NextResponse.json({ error: "ledger_write_failed" }, { status: 500 });
  }

  const ledgerId = insertedRows?.id ?? null;

  // Compute the post-state optimistically from the values we already
  // hold — avoids an extra rpc round-trip. The earn just inserted
  // adds exactly `credited` to balance and (when daily-family) to
  // dailyEarnedCapped. Safe because the SQL function is stable and
  // we just wrote the only row that could change either number.
  const newBalance = balanceBefore + credited;
  const newDailyEarnedCapped = isDailyCapSource(source)
    ? dailyEarnedCappedBefore + credited
    : dailyEarnedCappedBefore;

  return NextResponse.json({
    wallet,
    requested: amount,
    credited,
    capReached,
    newBalance,
    dailyEarnedCapped: newDailyEarnedCapped,
    dailyCap,
    attestationHash,
    ledgerId,
  });
}
