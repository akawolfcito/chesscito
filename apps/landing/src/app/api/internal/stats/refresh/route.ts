import { NextRequest, NextResponse } from "next/server";

import { getPublicStats, getSurfaceBreakdown } from "@/lib/stats/aggregator";
import { safeEqual } from "@/lib/security/safe-equal";
import { DEFAULT_STATS_FILTERS } from "@/lib/stats/filters";
import { readPlayersCensus } from "@/lib/stats/players-census";
import {
  asPersistedSnapshot,
  STATS_REFRESH_COOLDOWN_SECONDS,
  refreshPersistedStatsSnapshot,
} from "@/lib/stats/persisted-snapshot";
import { getStatsRedis } from "@/lib/stats/redis";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.STATS_REFRESH_SECRET;
  if (!secret || secret.trim() === "") return false;
  const presented = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return Boolean(presented) && safeEqual(presented, secret);
}

/**
 * The only production path allowed to invoke the stats RPCs during
 * containment. Public `/stats` only reads Redis.
 */
export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redis = getStatsRedis();
  if (!redis) {
    console.error("[stats/refresh] Redis is not configured");
    return NextResponse.json({ error: "Snapshot storage unavailable" }, { status: 503 });
  }

  try {
    const result = await refreshPersistedStatsSnapshot({
      redis,
      build: async () => {
        const stats = await getPublicStats(DEFAULT_STATS_FILTERS);
        const breakdown = await getSurfaceBreakdown("all", {
          surface: "all",
          installs: stats.installs,
        });
        const census = await readPlayersCensus();
        return asPersistedSnapshot({ stats, breakdown, census });
      },
    });

    if (result.status === "locked") {
      return NextResponse.json({ refreshed: false, reason: "refresh_in_progress" }, { status: 409 });
    }
    if (result.status === "cooldown") {
      return NextResponse.json(
        { refreshed: false, reason: "refresh_cooldown" },
        { status: 429, headers: { "Retry-After": String(STATS_REFRESH_COOLDOWN_SECONDS) } },
      );
    }
    if (result.status === "incomplete") {
      console.error("[stats/refresh] incomplete snapshot; previous snapshot preserved");
      return NextResponse.json({ refreshed: false, reason: "incomplete_snapshot" }, { status: 503 });
    }

    return NextResponse.json({ refreshed: true, refreshedAt: result.snapshot.refreshedAt });
  } catch (error) {
    console.error("[stats/refresh] failed; previous snapshot preserved", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ refreshed: false, reason: "refresh_failed" }, { status: 503 });
  }
}
