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
import { daysRemaining } from "@/lib/pro/days-remaining";
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
import {
  readSeasonPassRow,
  type SeasonPassRowRead,
} from "@/lib/season-pass/read-season-pass-row";
import { createLogger, hashWallet } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

/** The route can initialize the ledger, so a cached copy of it would be a bug
 *  nobody can reproduce. */
export const dynamic = "force-dynamic";

const redis = Redis.fromEnv();
const log = createLogger({ route: "/api/season-pass/status" });

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/i;

/** Cached expiry when it is present AND still in the future; null otherwise.
 *  A Redis outage reads as "no cache", never as "no entitlement". */
async function readCachedExpiry(wallet: string): Promise<string | null> {
  try {
    const cached = await redis.get<string>(REDIS_KEYS.seasonPass(wallet));
    if (cached && new Date(cached) > new Date()) return cached;
  } catch (e) {
    log.warn("redis_status_check_failed", { wallet: hashWallet(wallet), err: String(e) });
  }
  return null;
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
    log.error("pro_status_check_failed", { wallet: hashWallet(wallet), err: String(e) });
    return NextResponse.json(
      { active: false, source: null, error: "entitlement_unavailable" },
      { status: 503 },
    );
  }

  const configuredPass = getSeasonPass("lite_season_pass_21");
  const supabase = getSupabaseServer();
  if (!supabase) log.error("supabase_unavailable", { wallet: hashWallet(wallet) });

  const cachedExpiresAt = await readCachedExpiry(wallet);
  const ledger: SeasonPassRowRead = supabase
    ? await readSeasonPassRow(supabase, wallet)
    : { status: "unavailable" };
  if (ledger.status === "unavailable" && supabase) {
    log.error("db_query_failed", { wallet: hashWallet(wallet), code: ledger.code });
  }
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
    const focusDays = await resolveFocusDays({
      supabase,
      wallet,
      seasonId: effective.seasonId,
      expiresAt: effective.seasonPassExpiresAt,
      report: parseBackfillReport(searchParams),
    });
    body.focusDays = focusDays;

    // AC12 — una línea por respuesta con pase activo, con las DOS constantes
    // juntas. El cambio 21-en-30 mueve un número que nadie mira: si un call
    // site elige el equivocado, sin esto nos enteramos por un reporte de
    // jugador. Verlas apareadas hace que un cruce salte a la vista.
    //
    // `state` es la unión real que el servidor puede resolver: el cliente
    // agrega `loading` y `offer`, que aquí no existen (este bloque ya sabe que
    // hay acceso). Wallet hasheada, y ningún `expires_at` exacto — la ventana
    // viaja como días restantes, que es lo que se necesita para leer el estado.
    const expiresAtMs = effective.seasonPassExpiresAt
      ? Date.parse(effective.seasonPassExpiresAt)
      : null;
    const remaining = daysRemaining(
      expiresAtMs !== null && !Number.isNaN(expiresAtMs) ? expiresAtMs : null,
      Date.now(),
    );
    log.info("focus_days_status", {
      wallet: hashWallet(wallet),
      season_id: effective.seasonId,
      challenge_goal_days: configuredPass.challengeGoalDays,
      access_duration_days: configuredPass.accessDurationDays,
      completed: focusDays.status === "ok" ? focusDays.completed : null,
      days_remaining: remaining ?? 0,
      state: focusDaysLogState(focusDays, configuredPass.challengeGoalDays),
    });
  }

  return json(body);
}

/** El estado del reto, reducido a lo que el SERVIDOR puede saber.
 *
 *  Es la misma unión que `ChallengeProgressView` menos `loading` y `offer`:
 *  esos dos son estados del cliente (una request en vuelo, un jugador sin
 *  pase), y este log sólo se emite cuando ya hay acceso resuelto. Mantenerlos
 *  fuera evita un estado que nunca podría aparecer y que alguien buscaría en
 *  vano al leer los logs. */
function focusDaysLogState(
  slice: FocusDaysSlice,
  goal: number,
): "disabled" | "degraded" | "active" | "completed" {
  if (slice.status === "disabled") return "disabled";
  if (slice.status === "unavailable") return "degraded";
  return slice.completed >= goal ? "completed" : "active";
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
    durationDays: configuredPass.accessDurationDays,
    goal: configuredPass.challengeGoalDays,
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
    goal: configuredPass.challengeGoalDays,
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
