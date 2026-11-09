import { NextResponse } from "next/server";

import { readSeatToken } from "@/lib/duel/http";
import { toPublic } from "@/lib/duel/lifecycle";
import { playMove } from "@/lib/duel/operations";
import { duelRepositoryFrom } from "@/lib/duel/repository";
import { resolveSeat } from "@/lib/duel/seat-token";
import {
  firstMoveEvent,
  loadMaterialized,
  outcomeReason,
  recordDuelEvent,
} from "@/lib/duel/service";
import { createLogger } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * POST /api/duel/[id]/move — play a move.
 *
 * ⛔ Everything that decides anything here happens in `playMove`, and the order
 * it applies is the one the spec pinned: seat, then clock, then version, then
 * board. This file composes; it must not re-decide. In particular it must never
 * apply the move first and check the clock after — that hands the win to
 * whoever ran out of time.
 *
 * ⚠️ And it never retries. A `version-conflict` goes back to the client WITH
 * fresh state so a human can re-decide: replaying a chess move against a
 * position that changed underneath is how a game gets silently corrupted.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** ⛔ Neither the credential nor the duel id is ever logged. */
const logger = createLogger({ route: "/api/duel/[id]/move" });

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
      san?: unknown;
      version?: unknown;
      sessionId?: unknown;
      seatToken?: unknown;
    };

    if (typeof body.san !== "string" || body.san.length === 0 || body.san.length > 12) {
      return jsonError(400, "invalid_move");
    }
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
    const result = playMove({
      duel: found.duel,
      token,
      san: body.san,
      version: body.version,
      now: Date.now(),
    });

    if (!result.ok) {
      // ⛔ `not-your-seat` carries NOTHING else. Behaviour 8: a credential that
      // belongs to no seat of this duel must not learn whose turn it is.
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
    if (committed === "stale") {
      // Somebody moved between our read and our write. Same answer as a stale
      // `version`, and for the same reason: fresh state, no retry.
      const fresh = await loadMaterialized(repo, id, Date.now());
      const seat = resolveSeat(found.duel.seats, token);
      return NextResponse.json(
        {
          ok: false,
          error: "version-conflict",
          duel: toPublic(fresh.status === "found" ? fresh.duel : found.duel, seat),
        },
        { status: 409 },
      );
    }
    if (committed === "error") {
      logger.error("duel_move_failed", {});
      return jsonError(500, "internal");
    }

    const seat = resolveSeat(result.duel.seats, token);
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;

    // ⛔ At most twice per duel, once per seat: the metric is duels where BOTH
    // seats moved, so this is the event that answers it without a row per move.
    const opener = firstMoveEvent(found.duel, result.duel);
    if (opener) {
      await recordDuelEvent(supabase, {
        event: "duel_first_move",
        duelId: id,
        sessionId,
        props: { seat: opener },
      });
    }
    if (result.duel.status === "finished") {
      await recordDuelEvent(supabase, {
        event: "duel_finished",
        duelId: id,
        sessionId,
        props: { reason: outcomeReason(result.duel.outcome) },
      });
    }

    return NextResponse.json({ ok: true, duel: toPublic(result.duel, seat) });
  } catch (err) {
    logger.error("unhandled exception", {
      errName: err instanceof Error ? err.name : "unknown",
    });
    return jsonError(500, "internal");
  }
}
