import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { EMERGENCY_STATS_RPCS, getPublicStats, STATS_RPCS, type StatsRpcMetric } from "@/lib/stats/aggregator";
import { safeEqual } from "@/lib/security/safe-equal";
import { DEFAULT_STATS_FILTERS } from "@/lib/stats/filters";
import { EMPTY_PLAYERS_CENSUS } from "@/lib/stats/players-census";
import {
  asPersistedSnapshot,
  RefreshPhaseTimeoutError,
  STATS_RPC_INDIVIDUAL_BUDGET_MS, STATS_REFRESH_COOLDOWN_SECONDS,
  STATS_RPC_PHASE_BUDGET_MS,
  refreshPersistedStatsSnapshot,
  type StatsSnapshotAvailability,
  withinRefreshPhase,
} from "@/lib/stats/persisted-snapshot";
import { getStatsRedis } from "@/lib/stats/redis";

export const runtime = "nodejs";
export const maxDuration = 60;

type PhaseMetric = { phase: string; durationMs: number; outcome: string };
type FailedRpc = { name: (typeof EMERGENCY_STATS_RPCS)[number]; outcome: StatsRpcMetric["outcome"]; durationMs: number; code: string | null; sqlstate: string | null };

function safeIdentifier(value: unknown, pattern: RegExp): string | null {
  return typeof value === "string" && pattern.test(value) ? value : null;
}

function safeError(error: unknown) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const rawCode = safeIdentifier(record.code, /^[A-Za-z0-9_.-]{1,64}$/);
  const code = rawCode && !/(authorization|bearer|secret|token|password|connection|string)/i.test(rawCode) ? rawCode : null;
  const rawSqlstate = record.sqlstate ?? record.sqlState ?? (code && /^[0-9A-Z]{5}$/.test(code) ? code : null);
  return {
    name: safeIdentifier(error instanceof Error ? error.name : record.name, /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/) ?? "unknown",
    code,
    sqlstate: safeIdentifier(rawSqlstate, /^[0-9A-Z]{5}$/),
  };
}

function authorized(request: NextRequest): boolean {
  const secret = process.env.STATS_REFRESH_SECRET;
  if (!secret || secret.trim() === "") return false;
  const presented = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return Boolean(presented) && safeEqual(presented, secret);
}

/** The only production path allowed to invoke stats RPCs during containment. */
export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  const totalStartedAt = Date.now();
  const phaseMetrics: PhaseMetric[] = [];
  const rpcMetrics: StatsRpcMetric[] = [];
  let failedRpcNames: string[] = [];
  const logPhase = (metric: PhaseMetric) => { phaseMetrics.push(metric); };
  const logRpc = (metric: StatsRpcMetric) => { rpcMetrics.push(metric); };
  const logFailure = (event: string, details: Record<string, unknown> = {}) => {
    console.error(`[stats/refresh] ${event}`, { requestId, ...details });
  };

  const authStartedAt = Date.now();
  const isAuthorized = authorized(request);
  logPhase({ phase: "auth", durationMs: Date.now() - authStartedAt, outcome: isAuthorized ? "ok" : "error" });
  if (!isAuthorized) {
    console.warn("[stats/refresh] unauthorized", { requestId });
    return NextResponse.json({ error: "Unauthorized", requestId }, { status: 401 });
  }

  let redis: ReturnType<typeof getStatsRedis>;
  try {
    redis = getStatsRedis();
  } catch (error) {
    logFailure("storage_unavailable", { reason: "storage_unavailable", error: safeError(error) });
    return NextResponse.json({ error: "Snapshot storage unavailable", refreshed: false, reason: "storage_unavailable", requestId }, { status: 503 });
  }
  if (!redis) {
    logFailure("storage_unavailable", { reason: "storage_unavailable" });
    return NextResponse.json({ error: "Snapshot storage unavailable", refreshed: false, reason: "storage_unavailable", requestId }, { status: 503 });
  }

  try {
    const result = await refreshPersistedStatsSnapshot({
      redis,
      requiredRpcs: EMERGENCY_STATS_RPCS,
      build: async () => {
        const stats = await withinRefreshPhase({
          phase: "stats_rpcs",
          budgetMs: STATS_RPC_PHASE_BUDGET_MS,
          onMetric: logPhase,
          run: (signal) => getPublicStats(DEFAULT_STATS_FILTERS, {
            includeOnchain: false,
            signal,
            rpcNames: EMERGENCY_STATS_RPCS,
            rpcTimeoutMs: STATS_RPC_INDIVIDUAL_BUDGET_MS,
            onRpcMetric: logRpc,
          }),
        });
        failedRpcNames = stats.dataIntegrity.failedRpcs;
        return asPersistedSnapshot({
          stats,
          breakdown: { learn: null, play: null, total: null },
          census: EMPTY_PLAYERS_CENSUS,
          availability: {
            onchain: "temporarily_unavailable",
            census: "temporarily_unavailable",
            breakdown: "temporarily_unavailable",
            rpcs: Object.fromEntries(STATS_RPCS.map((rpc) => [
              rpc,
              stats.dataIntegrity.failedRpcs.includes(rpc) ? "temporarily_unavailable" : "available",
            ])) as StatsSnapshotAvailability["rpcs"],
          },
        });
      },
      onMetric: logPhase,
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
      const measuredFailures = rpcMetrics.filter((metric) => metric.outcome !== "success").map((metric) => metric.rpc);
      const knownFailed = new Set([...failedRpcNames, ...measuredFailures].filter((rpc): rpc is (typeof EMERGENCY_STATS_RPCS)[number] =>
        EMERGENCY_STATS_RPCS.includes(rpc as (typeof EMERGENCY_STATS_RPCS)[number]),
      ));
      const failedRpcs: FailedRpc[] = EMERGENCY_STATS_RPCS
        .filter((name) => knownFailed.has(name))
        .map((name) => {
          const metric = rpcMetrics.find((item) => item.rpc === name);
          return {
            name,
            outcome: metric?.outcome === "success" || metric?.outcome === "timeout" || metric?.outcome === "invalid_result" || metric?.outcome === "error"
              ? metric.outcome
              : "invalid_result",
            durationMs: metric?.durationMs ?? 0,
            code: metric?.errorCode ?? (metric ? "INVALID_RESULT" : "RPC_RESULT_MISSING"),
            sqlstate: metric?.sqlstate ?? null,
          };
        });
      logFailure("incomplete_snapshot", { reason: "incomplete_snapshot", failedRpcs });
      return NextResponse.json({
        refreshed: false,
        reason: "incomplete_snapshot",
        requestId,
        failedRpcs: failedRpcs.map(({ name, outcome, durationMs }) => ({ name, outcome, durationMs })),
      }, { status: 503 });
    }

    console.info("[stats/refresh] refreshed", {
      requestId,
      refreshedAt: result.snapshot.refreshedAt,
      totalDurationMs: Date.now() - totalStartedAt,
    });
    return NextResponse.json({ refreshed: true, refreshedAt: result.snapshot.refreshedAt, requestId });
  } catch (error) {
    const safe = safeError(error);
    if (error instanceof RefreshPhaseTimeoutError) {
      logFailure("phase_timeout", { reason: "phase_timeout", phase: error.phase, error: safe, phaseMetrics });
      return NextResponse.json({ refreshed: false, reason: "phase_timeout", phase: error.phase, requestId }, { status: 503 });
    }
    logFailure("refresh_failed", { reason: "refresh_failed", error: safe, phaseMetrics });
    return NextResponse.json({ refreshed: false, reason: "refresh_failed", requestId }, { status: 503 });
  }
}
