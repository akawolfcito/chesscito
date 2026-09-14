import { NextResponse } from "next/server";
import { getRedis } from "@/lib/server/redis";
import { isAddress } from "viem";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import { enforceOrigin } from "@/lib/server/demo-signing";
import type { JobStatus } from "@/lib/coach/types";
import { createLogger } from "@/lib/server/logger";
import { recordRedisUsage } from "@/lib/server/redis-observability";

const redis = getRedis();
const log = createLogger({ route: "/api/coach/job/[id]" });

function pollAttempt(request: Request): number | undefined {
  const value = Number.parseInt(request.headers.get("x-chesscito-poll-attempt") ?? "", 10);
  return Number.isSafeInteger(value) && value > 0 && value <= 100 ? value : undefined;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    enforceOrigin(req);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const jobId = params.id;
  if (!jobId) return NextResponse.json({ error: "Missing job ID" }, { status: 400 });

  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: "Missing or invalid wallet" }, { status: 400 });
  }

  const job = await redis.get<JobStatus & { wallet?: string }>(REDIS_KEYS.job(jobId));
  if (!job) {
    recordRedisUsage(log, {
      redis_feature: "coach_analyze",
      redis_logical_operation: "job_poll",
      endpoint: "/api/coach/job/[id]",
      redis_estimated_commands: 1,
      cache_result: "miss",
      poll_reason: "job_status",
      poll_attempt: pollAttempt(req),
      poll_terminal: "not_ready",
    });
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.wallet && job.wallet !== wallet) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  recordRedisUsage(log, {
    redis_feature: "coach_analyze",
    redis_logical_operation: "job_poll",
    endpoint: "/api/coach/job/[id]",
    redis_estimated_commands: 1,
    cache_result: "hit",
    poll_reason: "job_status",
    poll_attempt: pollAttempt(req),
    poll_terminal: job.status === "ready" ? "ready" : job.status === "failed" ? "failed" : "not_ready",
  });
  return NextResponse.json(job);
}
