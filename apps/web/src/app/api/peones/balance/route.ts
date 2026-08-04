/**
 * GET /api/peones/balance?wallet=0x…
 *
 * Sprint 3 commit C of Training Economy Alpha 2026-06-07. READ-ONLY
 * endpoint. Reads the SQL function `peones_balance_with_caps` (cap
 * + balance in one round-trip) and the `peones_balances` view (for
 * `last_event_at`). No writes. No earn/spend. No localStorage. No
 * UI. The HUD chip (commit G) and the earn endpoint (commit D) are
 * the eventual consumers of this contract.
 *
 * Contract:
 *   200 → { wallet, balance, dailyEarnedCapped, dailyCap, lastEventAt }
 *   400 → { error: "invalid_wallet" }       // bad format
 *   429 → { error: "rate_limited" }         // origin/rate guard tripped
 *   500 → { error: "ledger_unavailable" }   // Supabase missing or rpc error
 *
 * The migration (commit A) is committed but NOT applied to hosted
 * Supabase yet — when the table/function don't exist the rpc returns
 * an error and we map to 500. Hosted apply is a manual deploy step
 * documented in calibration §3.4.
 */

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { normalizeWallet } from "@/lib/peones/ledger-service";
import { PEONES_DAILY_CAP } from "@/lib/peones/types";
import { ensurePeonesWelcomePack } from "@/lib/peones/welcome-pack-server";
import { enforceOrigin, getRequestIp } from "@/lib/server/demo-signing";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createLogger } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

const log = createLogger({ route: "/api/peones/balance" });

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  // Origin + IP rate-limit guards. Both map to 429 per the Sprint 3
  // calibration §5.1 contract. The existing /api/coach/credits route
  // uses 403 — we deliberately diverge here because the calibration
  // pins three error codes (400/429/500) and conflating origin into
  // "rate_limited" keeps the client error surface flat.
  try {
    enforceOrigin(req);
  } catch (e) {
    log.warn("guard_failed", { reason: (e as Error)?.message });
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // FAIL-OPEN (D0.1, 2026-08-03). Until today an unreachable Upstash came out
  // of here as `429 rate_limited`, so an outage was indistinguishable from a
  // player over quota — that conflation is most of the 17.4% error rate this
  // endpoint was reporting.
  //
  // Serving the balance when the limiter cannot answer is safe: this is a
  // read, and the one write still on this path (the welcome-pack seed below)
  // is guarded by the UNIQUE index on `idempotency_key`, which is the actual
  // idempotency guarantee. The rate limiter never was.
  const limit = await checkRateLimit({
    identifier: getRequestIp(req),
    route: "peones-balance",
    policy: "fail-open",
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const url = new URL(req.url);
  const rawWallet = url.searchParams.get("wallet");
  if (!rawWallet) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }

  let wallet: string;
  try {
    wallet = normalizeWallet(rawWallet);
  } catch {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    log.error("supabase_unavailable", { wallet });
    return NextResponse.json({ error: "ledger_unavailable" }, { status: 500 });
  }

  const today = todayUtcDate();

  // Sprint 4 commit J — welcome pack seed. Runs BEFORE the balance
  // read so the response reflects the +1 Peón when applicable.
  // Idempotent forever via the unique index on idempotency_key, and
  // fail-soft: any insert error (network / transient outage) is
  // swallowed and the balance read still serves the user. The
  // helper itself never throws, but we wrap in try/catch as
  // defense-in-depth — a contract regression in the helper must
  // never break the balance read for production users.
  try {
    const seeded = await ensurePeonesWelcomePack(supabase, wallet);
    if (seeded) {
      log.info("peones_welcome_pack_seeded", { wallet });
    }
  } catch (e) {
    log.warn("peones_welcome_pack_threw", {
      wallet,
      reason: (e as Error)?.message,
    });
  }

  // Cap + balance in one round-trip. The SQL function returns a TABLE
  // (single row) per the migration in commit A.
  const { data: capRows, error: capError } = await supabase.rpc(
    "peones_balance_with_caps",
    { p_wallet: wallet, p_day_utc: today },
  );

  if (capError) {
    log.error("rpc_failed", { wallet, code: capError.code, message: capError.message });
    return NextResponse.json({ error: "ledger_unavailable" }, { status: 500 });
  }

  const capRow = Array.isArray(capRows) ? capRows[0] : capRows;
  const balance = capRow ? Number(capRow.balance ?? 0) : 0;
  const dailyEarnedCapped = capRow ? Number(capRow.daily_earned_capped ?? 0) : 0;
  const dailyCap = capRow ? Number(capRow.daily_cap ?? PEONES_DAILY_CAP) : PEONES_DAILY_CAP;

  // last_event_at from the view. A second small read; cheap because
  // the view is indexed on wallet and this resolves to a single row.
  // If the wallet has no events the view returns no row, so we
  // tolerate `maybeSingle` returning null.
  const { data: balanceRow } = await supabase
    .from("peones_balances")
    .select("last_event_at")
    .eq("wallet", wallet)
    .maybeSingle();

  return NextResponse.json({
    wallet,
    balance,
    dailyEarnedCapped,
    dailyCap,
    lastEventAt:
      balanceRow && typeof balanceRow.last_event_at === "string"
        ? balanceRow.last_event_at
        : null,
  });
}
