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
import {
  ensurePeonesWelcomePack,
  hasPeonesWelcomePack,
} from "@/lib/peones/welcome-pack-server";
import { enforceOrigin, getRequestIp } from "@/lib/server/demo-signing";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createLogger, hashWallet } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

const log = createLogger({ route: "/api/peones/balance" });

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * A bounded, non-echoing label for a database error.
 *
 * Supabase's `message` is an arbitrary external string. During the 2026-08-03
 * incident it was a full HTML error page from the API gateway — megabytes of
 * markup in the log drain, none of it ours. Worse, a PostgREST error message
 * can quote the offending row, which on this table means a wallet address.
 *
 * So the message is never logged. What survives is a fixed-vocabulary class,
 * enough to tell a gateway outage from a SQL fault when reading logs.
 */
function classifyDbError(message: string | undefined): string {
  if (!message) return "unknown";
  const head = message.slice(0, 200).toLowerCase();
  if (head.includes("<!doctype html") || head.includes("<html")) {
    return "html_gateway_error";
  }
  if (head.includes("timeout") || head.includes("timed out")) return "timeout";
  if (head.includes("fetch failed") || head.includes("econnrefused")) {
    return "connection_failed";
  }
  return "db_error";
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

  // Every log line below carries a salted digest, never the address. The
  // wallet also never travels as part of a query string in a log line.
  const walletHash = hashWallet(wallet);

  const supabase = getSupabaseServer();
  if (!supabase) {
    log.error("supabase_unavailable", { wallet_hash: walletHash });
    return NextResponse.json({ error: "ledger_unavailable" }, { status: 500 });
  }

  const today = todayUtcDate();

  // Sprint 4 commit J — welcome pack seed. Runs BEFORE the balance read so the
  // response reflects the +1 Peón when applicable.
  //
  // D2.1 (2026-08-03): the INSERT is now gated behind an index probe. It used
  // to run on EVERY read, so every recurring wallet paid a write that could
  // only ever end in a 23505 conflict — ~5.9K wasted writes per 12h against a
  // database depleting its Disk IO budget.
  //
  // What did NOT change: the grant itself, its amount, its idempotency key,
  // and the fact that the UNIQUE index on idempotency_key is the sole
  // guarantee against a double grant. The probe is an optimisation that can be
  // wrong in either direction without consequence:
  //   - probe says "seeded" when it is not → the next read seeds it;
  //   - probe says "not seeded" when it is → the INSERT hits 23505 and no-ops.
  // Concurrency is therefore safe by exactly the same mechanism as before: two
  // simultaneous first reads both probe absent, both INSERT, and the index
  // lets exactly one through.
  //
  // Fail-soft throughout: any error here is swallowed and the balance read
  // still serves the user.
  try {
    const alreadySeeded = await hasPeonesWelcomePack(supabase, wallet);
    // "unknown" = the probe itself failed. Do NOT seed on an unknown: firing
    // an INSERT at a database that just failed a read is the behaviour this
    // change exists to remove. A later successful read grants it.
    if (alreadySeeded === false) {
      const seeded = await ensurePeonesWelcomePack(supabase, wallet);
      if (seeded) {
        log.info("peones_welcome_pack_seeded", { wallet_hash: walletHash });
      }
    }
  } catch (e) {
    log.warn("peones_welcome_pack_threw", {
      wallet_hash: walletHash,
      error_class: (e as Error)?.name ?? "unknown",
    });
  }

  // Cap + balance in one round-trip. The SQL function returns a TABLE
  // (single row) per the migration in commit A.
  const { data: capRows, error: capError } = await supabase.rpc(
    "peones_balance_with_caps",
    { p_wallet: wallet, p_day_utc: today },
  );

  if (capError) {
    // `capError.message` is NOT logged. During the 2026-08-03 incident Supabase
    // answered with a full HTML error page, so that field is an arbitrary
    // external blob — unbounded, and not ours to vouch for. The PostgREST code
    // is what identifies the failure; the class is enough to tell an HTML
    // gateway error from a SQL one.
    log.error("rpc_failed", {
      wallet_hash: walletHash,
      operation: "peones_balance_with_caps",
      code: capError.code ?? null,
      error_class: classifyDbError(capError.message),
      deployment: process.env.VERCEL_DEPLOYMENT_ID ?? "local",
      mode: process.env.NEXT_PUBLIC_CHESSCITO_MODE ?? "unknown",
    });
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
