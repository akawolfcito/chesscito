import { NextResponse } from "next/server";

import { readSeatToken } from "@/lib/duel/http";
import { toPublic } from "@/lib/duel/lifecycle";
import { duelRepositoryFrom } from "@/lib/duel/repository";
import { resolveSeat } from "@/lib/duel/seat-token";
import { loadMaterialized } from "@/lib/duel/service";
import { createLogger } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * GET /api/duel/[id] — read a duel, with the clock already applied.
 *
 * ⛔ This is the read that makes the whole "no cron, no job" design work.
 * Nobody has to move and nothing has to run on a schedule: an invitation whose
 * hour passed, and a game whose flag has fallen, are settled BY BEING READ.
 *
 * ⚠️ Which is to say it is a GET that writes, and that write is allowed to
 * fail. When it does, the response still carries the state the clock computed —
 * expiration is a function of time, not a permission to write.
 *
 * The credential is OPTIONAL here. Without one the caller is a spectator: they
 * see the board and who is playing, `you` is null and `yourTurn` is false. That
 * is the forwarded link mid-game, and it is the germ of D3, not a leak.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** ⛔ Neither the credential nor the duel id is ever logged: the id IS the
 *  invitation, so a log drain full of ids is a drain full of joinable duels. */
const logger = createLogger({ route: "/api/duel/[id]" });

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const supabase = getSupabaseServer();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
    }

    const result = await loadMaterialized(duelRepositoryFrom(supabase), id, Date.now());
    if (result.status === "not-found") {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    if (result.status === "error") {
      // ⛔ A broken database is 500, never 404: telling a guest their
      // invitation does not exist because a query timed out sends them away
      // from a duel that is sitting right there.
      logger.error("duel_read_failed", {});
      return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
    }

    const seat = resolveSeat(result.duel.seats, readSeatToken(request));
    return NextResponse.json({ ok: true, duel: toPublic(result.duel, seat) });
  } catch (err) {
    logger.error("unhandled exception", {
      errName: err instanceof Error ? err.name : "unknown",
    });
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
