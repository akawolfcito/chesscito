import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/server/sync-blockchain";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Defense-in-depth: missing CRON_SECRET must fail closed, otherwise any
  // unauthenticated caller can trigger runSync() and burn Celo RPC + Redis
  // budget. Matches /api/cron/coach-purge guard.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSync();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/sync] failed:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
