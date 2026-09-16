import { NextRequest, NextResponse } from "next/server";

import { getPublicStats, getSurfaceBreakdown } from "@/lib/stats/aggregator";
import { safeEqual } from "@/lib/security/safe-equal";
import { DEFAULT_STATS_FILTERS } from "@/lib/stats/filters";
import { EMPTY_PLAYERS_CENSUS } from "@/lib/stats/players-census";
import {
  asPersistedSnapshot,
  RefreshPhaseTimeoutError,
  STATS_BREAKDOWN_PHASE_BUDGET_MS,
  STATS_REFRESH_COOLDOWN_SECONDS,
  STATS_RPC_PHASE_BUDGET_MS,
  refreshPersistedStatsSnapshot,
  withinRefreshPhase,
} from "@/lib/stats/persisted-snapshot";
import { getStatsRedis } from "@/lib/stats/redis";

export const runtime = "nodejs";
export const maxDuration = 60;

function logMetric(metric: { phase: string; durationMs: number; outcome: string }) {
  console.info("[stats/refresh] phase", metric);
}

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
  const totalStartedAt = Date.now();
  const authStartedAt = Date.now();
  const isAuthorized = authorized(request);
  console.info("[stats/refresh] phase", {
    phase: "auth",
    durationMs: Date.now() - authStartedAt,
    outcome: isAuthorized ? "ok" : "error",
  });
  if (!isAuthorized) {
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
        const stats = await withinRefreshPhase({
          phase: "stats_rpcs",
          budgetMs: STATS_RPC_PHASE_BUDGET_MS,
          onMetric: logMetric,
          run: (signal) => getPublicStats(DEFAULT_STATS_FILTERS, { includeOnchain: false, signal }),
        });
        const breakdown = await withinRefreshPhase({
          phase: "breakdown",
          budgetMs: STATS_BREAKDOWN_PHASE_BUDGET_MS,
          onMetric: logMetric,
          run: (signal) => getSurfaceBreakdown("all", {
            surface: "all",
            installs: stats.installs,
          }, signal),
        });
        return asPersistedSnapshot({
          stats,
          breakdown,
          census: EMPTY_PLAYERS_CENSUS,
          availability: { onchain: "temporarily_unavailable", census: "temporarily_unavailable" },
        });
      },
      onMetric: logMetric,
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
    if (error instanceof RefreshPhaseTimeoutError) {
      console.error("[stats/refresh] phase timeout; previous snapshot preserved", { phase: error.phase });
      return NextResponse.json({ refreshed: false, reason: "phase_timeout", phase: error.phase }, { status: 503 });
    }
    console.error("[stats/refresh] failed; previous snapshot preserved", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ refreshed: false, reason: "refresh_failed" }, { status: 503 });
  } finally {
    console.info("[stats/refresh] phase", {
      phase: "total",
      durationMs: Date.now() - totalStartedAt,
      outcome: "complete",
    });
  }
}
