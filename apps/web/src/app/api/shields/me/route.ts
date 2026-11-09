import { NextResponse } from "next/server";
import { isAddress } from "viem";

import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import { enforceOrigin, getRequestIp } from "@/lib/server/demo-signing";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { getRedis } from "@/lib/server/redis";
import { createLogger } from "@/lib/server/logger";

const logger = createLogger({ route: "/api/shields/me" });
const redis = getRedis();

function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function GET(req: Request) {
  try {
    try {
      enforceOrigin(req);
    } catch {
      return jsonError(403, "origin_blocked");
    }
    // FAIL-OPEN (D0.1): reads the credited-shields counter, mutates nothing.
    // `/api/shields/spend` keeps its own fail-closed guard.
    const limit = await checkRateLimit({
      identifier: getRequestIp(req),
      route: "shields-me",
      policy: "fail-open",
    });
    if (!limit.allowed) return jsonError(429, "rate_limited");

    const url = new URL(req.url);
    const wallet = url.searchParams.get("wallet");
    if (!wallet) return jsonError(400, "missing_params");
    if (!isAddress(wallet)) return jsonError(400, "invalid_wallet");

    const key = REDIS_KEYS.shieldsCredited(wallet.toLowerCase());
    const raw = await redis.get<string | number | null>(key);
    const parsed =
      raw == null ? 0 : Number.parseInt(String(raw), 10);
    const credited = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

    return NextResponse.json({ ok: true, credited });
  } catch (err) {
    logger.error("unhandled exception", {
      errName: err instanceof Error ? err.name : "unknown",
      errMessage: err instanceof Error ? err.message : String(err),
    });
    return jsonError(500, "internal");
  }
}
