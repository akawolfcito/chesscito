import { NextResponse } from "next/server";

import { readSeatToken, seatCookie } from "@/lib/duel/http";
import { toPublic } from "@/lib/duel/lifecycle";
import { joinDuel } from "@/lib/duel/operations";
import { duelRepositoryFrom } from "@/lib/duel/repository";
import { issueSeatToken, resolveSeat } from "@/lib/duel/seat-token";
import { loadMaterialized, recordDuelEvent } from "@/lib/duel/service";
import {
  enforceOrigin,
  enforceRateLimit,
  getRequestIp,
} from "@/lib/server/demo-signing";
import { createLogger } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * POST /api/duel/[id]/join — take the free seat.
 *
 * ⛔ Idempotent, and that is load-bearing on a phone: a double tap must not
 * consume two seats nor issue two credentials, and the creator opening their
 * own link must get their OWN seat back rather than sitting down twice. Both
 * are the same check, and it lives in `joinDuel` before anything else.
 *
 * ⚠️ Two people tapping at once is settled by the CAS, not by this file. The
 * loser gets `seat-taken`, which reads as *"somebody beat you to it"* — not as
 * an error.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** ⛔ Neither the credential nor the duel id is ever logged. */
const logger = createLogger({ route: "/api/duel/[id]/join" });

function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    try {
      enforceOrigin(request);
    } catch {
      return jsonError(403, "origin_blocked");
    }

    try {
      await enforceRateLimit(getRequestIp(request));
    } catch {
      return jsonError(429, "rate_limited");
    }

    const body = (await request.json().catch(() => ({}))) as {
      displayName?: unknown;
      sessionId?: unknown;
      seatToken?: unknown;
    };

    // ⛔ `freshReads`: sin esto, el select de Supabase se sirve del Data Cache
    // de Next y la ruta contesta un snapshot viejo. Medido en preview: la fila
    // decia active/version 2 y la ruta contestaba awaiting-opponent/version 1.
    const supabase = getSupabaseServer({ freshReads: true });
    if (!supabase) return jsonError(503, "unavailable");

    const repo = duelRepositoryFrom(supabase);
    const found = await loadMaterialized(repo, id, Date.now());
    if (found.status === "not-found") return jsonError(404, "not_found");
    if (found.status === "error") {
      logger.error("duel_read_failed", {});
      return jsonError(500, "internal");
    }

    const { token, tokenHash } = issueSeatToken();
    const result = joinDuel({
      duel: found.duel,
      tokenHash,
      displayName: body.displayName,
      presentedToken: readSeatToken(request, body),
      now: Date.now(),
    });

    if (!result.ok) {
      if (result.code === "already-seated") {
        // ⚠️ No new credential: they already have one, and handing over a
        // second would leave the client guessing which of the two is live.
        const seat = resolveSeat(result.duel.seats, readSeatToken(request, body));
        return NextResponse.json({
          ok: true,
          duel: toPublic(result.duel, seat),
          alreadySeated: true,
        });
      }
      return NextResponse.json(
        { ok: false, error: result.code },
        { status: result.code === "seat-taken" ? 409 : 410 },
      );
    }

    // The CAS is what actually settles a race between two tapping guests.
    const committed = await repo.commit(result.duel, found.duel.version);
    if (committed === "stale") return jsonError(409, "seat-taken");
    if (committed === "error") {
      logger.error("duel_join_failed", {});
      return jsonError(500, "internal");
    }

    const seat = resolveSeat(result.duel.seats, token);
    await recordDuelEvent(supabase, {
      event: "duel_joined",
      duelId: id,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
      props: { seat },
    });

    const response = NextResponse.json({
      ok: true,
      duel: toPublic(result.duel, seat),
      seatToken: token,
    });
    const cookie = seatCookie(id, token);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (err) {
    logger.error("unhandled exception", {
      errName: err instanceof Error ? err.name : "unknown",
    });
    return jsonError(500, "internal");
  }
}
