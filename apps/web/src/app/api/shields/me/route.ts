import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { Redis } from "@upstash/redis";

import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import {
  enforceOrigin,
  enforceReadRateLimit,
  getRequestIp,
} from "@/lib/server/demo-signing";
import { createLogger } from "@/lib/server/logger";

const logger = createLogger({ route: "/api/shields/me" });
const redis = Redis.fromEnv();

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
    try {
      await enforceReadRateLimit(getRequestIp(req));
    } catch {
      return jsonError(429, "rate_limited");
    }

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
