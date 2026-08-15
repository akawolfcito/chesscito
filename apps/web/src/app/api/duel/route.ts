import { NextResponse } from "next/server";

import {
  DEFAULT_CLOCK_MINUTES,
  isClockMinutes,
  type ClockMinutes,
} from "@/lib/duel/clock";
import { seatCookie } from "@/lib/duel/http";
import { toPublic } from "@/lib/duel/lifecycle";
import { createDuel } from "@/lib/duel/operations";
import { duelRepositoryFrom } from "@/lib/duel/repository";
import { recordDuelEvent } from "@/lib/duel/service";
import { issueSeatToken, newDuelId } from "@/lib/duel/seat-token";
import type { DuelColor } from "@/lib/duel/types";
import {
  enforceOrigin,
  enforceRateLimit,
  getRequestIp,
} from "@/lib/server/demo-signing";
import { createLogger } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * POST /api/duel — open a duel and take a seat in it.
 *
 * ⛔ The credential this returns is the ONLY thing that will ever authorize a
 * move in this duel. It is issued here, its SHA-256 is what gets stored, and
 * the plain value exists in this response and nowhere else — not in a log, not
 * in a query string.
 *
 * ⚠️ It goes back in the BODY as well as in a cookie, and the body is the
 * primary path: on mobile the link gets opened in an in-app browser and then
 * re-opened elsewhere, and in `learn` mode `/arena` bounces cross-domain. The
 * cookie survives neither.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * ⛔ NOTHING IDENTIFYING IS EVER LOGGED FROM A DUEL ROUTE — not the seat
 * credential, and not the duel id either.
 *
 * The credential is obvious. The id is the subtler one: the id IS the
 * invitation link, so whoever reads it can open the duel and, while a seat is
 * free, sit down in it. A log drain full of duel ids is a log drain full of
 * joinable invitations. Only the class of a failure goes out.
 */
const logger = createLogger({ route: "/api/duel" });

function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  try {
    try {
      enforceOrigin(request);
    } catch {
      return jsonError(403, "origin_blocked");
    }

    try {
      // ⚠️ IP only: there is no server-verifiable identity to bucket by, and
      // the wallet a client could send is not one (see `invitedBy` below).
      await enforceRateLimit(getRequestIp(request));
    } catch {
      return jsonError(429, "rate_limited");
    }

    const body = (await request.json().catch(() => ({}))) as {
      minutes?: unknown;
      displayName?: unknown;
      sessionId?: unknown;
    };

    // ⛔ The ladder IS the validation. Seven values, two buttons on a phone,
    // and no way to ask for an absurd amount of time. The same check is a
    // constraint in the table, so a `curl` gets the same answer.
    const minutes: ClockMinutes = isClockMinutes(body.minutes)
      ? body.minutes
      : DEFAULT_CLOCK_MINUTES;
    if (body.minutes !== undefined && !isClockMinutes(body.minutes)) {
      return jsonError(400, "invalid_minutes");
    }

    const supabase = getSupabaseServer();
    if (!supabase) return jsonError(503, "unavailable");

    const { token, tokenHash } = issueSeatToken();
    const duel = createDuel({
      id: newDuelId(),
      seat: drawSeat(),
      tokenHash,
      minutes,
      displayName: body.displayName,
      // ⛔ NULL, and that is a decision, not an omission. `invitedBy` is
      // attribution the SERVER is supposed to write, and this app has no
      // server-verifiable identity: Privy is validated in the browser and
      // nothing here can check a token. Writing whatever the client sent while
      // calling the field server-written would be the v2 defect wearing a new
      // name — and today nothing hangs off it (open question 5 of the spec).
      invitedBy: null,
      now: Date.now(),
    });

    const created = await duelRepositoryFrom(supabase).create(duel);
    if (created !== "created") {
      logger.error("duel_create_failed", { reason: created });
      return jsonError(500, "internal");
    }

    await recordDuelEvent(supabase, {
      event: "duel_created",
      duelId: duel.id,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
      props: { minutes },
    });

    const response = NextResponse.json({
      ok: true,
      duel: toPublic(duel, seatOf(duel)),
      seatToken: token,
    });
    const cookie = seatCookie(duel.id, token);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (err) {
    logger.error("unhandled exception", {
      errName: err instanceof Error ? err.name : "unknown",
    });
    return jsonError(500, "internal");
  }
}

/** Behaviour 1: the creator's colour is DRAWN, never chosen. */
function drawSeat(): DuelColor {
  return Math.random() < 0.5 ? "w" : "b";
}

function seatOf(duel: { seats: Record<DuelColor, { tokenHash: string }> }): DuelColor {
  return duel.seats.w.tokenHash === "" ? "b" : "w";
}
