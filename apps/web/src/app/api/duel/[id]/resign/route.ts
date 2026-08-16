import { NextResponse } from "next/server";

import { readSeatToken } from "@/lib/duel/http";
import { toPublic } from "@/lib/duel/lifecycle";
import { resignDuel } from "@/lib/duel/operations";
import { duelRepositoryFrom } from "@/lib/duel/repository";
import { resolveSeat } from "@/lib/duel/seat-token";
import { loadMaterialized, outcomeReason, recordDuelEvent } from "@/lib/duel/service";
import { createLogger } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * POST /api/duel/[id]/resign — give the game up.
 *
 * ⚠️ Resigning goes through the SAME gate as a move — seat, clock, version —
 * which is why it cannot overwrite a game the clock already ended. Whoever ran
 * out of time lost by timeout; a resignation arriving afterwards must not
 * quietly rewrite the reason they lost.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** ⛔ Neither the credential nor the duel id is ever logged. */
const logger = createLogger({ route: "/api/duel/[id]/resign" });

function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const body = (await request.json().catch(() => ({}))) as {
      version?: unknown;
      sessionId?: unknown;
      seatToken?: unknown;
    };

    if (typeof body.version !== "number" || !Number.isInteger(body.version)) {
      return jsonError(400, "invalid_version");
    }

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

    const token = readSeatToken(request, body);
    const result = resignDuel({
      duel: found.duel,
      token,
      version: body.version,
      now: Date.now(),
    });

    if (!result.ok) {
      if (result.code === "not-your-seat") return jsonError(403, "not-your-seat");
      if (result.code === "version-conflict" || result.code === "expired") {
        const seat = resolveSeat(result.duel.seats, token);
        return NextResponse.json(
          { ok: false, error: result.code, duel: toPublic(result.duel, seat) },
          { status: 409 },
        );
      }
      return jsonError(409, result.code);
    }

    const committed = await repo.commit(result.duel, found.duel.version);
    if (committed !== "committed") {
      if (committed === "error") logger.error("duel_resign_failed", {});
      return jsonError(409, "version-conflict");
    }

    const seat = resolveSeat(result.duel.seats, token);
    await recordDuelEvent(supabase, {
      event: "duel_finished",
      duelId: id,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
      props: { reason: outcomeReason(result.duel.outcome) },
    });

    return NextResponse.json({ ok: true, duel: toPublic(result.duel, seat) });
  } catch (err) {
    logger.error("unhandled exception", {
      errName: err instanceof Error ? err.name : "unknown",
    });
    return jsonError(500, "internal");
  }
}
