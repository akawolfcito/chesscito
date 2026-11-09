import { authorizeHistoryRead } from "@/lib/server/history-read-authorization";
import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { UUID_RE, getGameRecord } from "@/lib/coach/game-persistence";
import { createLogger } from "@/lib/server/logger";
import { enforceOrigin, getRequestIp } from "@/lib/server/demo-signing";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { getRedis } from "@/lib/server/redis";

export const dynamic = "force-dynamic";

const redis = getRedis();
const log = createLogger({ route: "/api/games/[id]" });

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    enforceOrigin(req);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // FAIL-OPEN (D0.1): reads one game record, mutates nothing. Ownership is
  // still checked below — the limiter is not the authorization control.
  const limit = await checkRateLimit({
    identifier: getRequestIp(req),
    route: "games-detail",
    policy: "fail-open",
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: gameId } = await ctx.params;
  const url = new URL(req.url);
  const walletRaw = url.searchParams.get("wallet");
  const wallet = walletRaw?.toLowerCase();

  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }
  if (!UUID_RE.test(gameId)) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  if (!(await authorizeHistoryRead(req, wallet))) {
    return NextResponse.json({ error: "History authorization required" }, {
      status: 401, headers: { "Cache-Control": "private, no-store" },
    });
  }

  try {
    const record = await getGameRecord(redis, wallet, gameId, {
      locale: url.searchParams.get("locale") === "es" ? "es" : "en",
    });
    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(record, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    log.error("game_fetch_error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
