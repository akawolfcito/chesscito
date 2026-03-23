import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";

const redis = Redis.fromEnv();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet")?.toLowerCase();
  if (!wallet) return NextResponse.json({ error: "Missing wallet" }, { status: 400 });

  const credits = (await redis.get<number>(REDIS_KEYS.credits(wallet))) ?? 0;
  return NextResponse.json({ credits });
}
