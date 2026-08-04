import { NextResponse } from "next/server";
import { getRedis } from "@/lib/server/redis";
import { isAddress } from "viem";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import { enforceOrigin } from "@/lib/server/demo-signing";
import type { JobStatus } from "@/lib/coach/types";

const redis = getRedis();

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
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (job.wallet && job.wallet !== wallet) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(job);
}
