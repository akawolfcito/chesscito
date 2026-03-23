import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import type { JobStatus } from "@/lib/coach/types";

const redis = Redis.fromEnv();

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const jobId = params.id;
  if (!jobId) return NextResponse.json({ error: "Missing job ID" }, { status: 400 });

  const job = await redis.get<JobStatus>(REDIS_KEYS.job(jobId));
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json(job);
}
