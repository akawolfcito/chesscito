import { NextResponse } from "next/server";

import { readCounters, STATS_DEBUG } from "@/lib/stats/instrument";

/**
 * TEMPORARY production cache diagnostic. **Deleted once the incident closes.**
 *
 * Doubly shut: it does not exist unless `STATS_DEBUG === "1"` (404, not 403 —
 * an absent route reveals less than a refused one), and even then it needs the
 * same shared secret the invalidation endpoint uses.
 *
 * The body is an allow-list of integers plus two opaque strings. No secret, no
 * URL, no wallet, no `session_id`, no `account_ref`, no metric value, no RPC
 * payload. `lastGeneratedAt` is the snapshot's OWN clock — the whole point is
 * that two requests sharing it are reading one cached photo.
 */
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function GET(request: Request): Promise<NextResponse> {
  // Not enabled → the route simply is not here.
  if (!STATS_DEBUG) return new NextResponse(null, { status: 404 });

  const expected = process.env.STATS_REVALIDATE_TOKEN;
  if (!expected || expected.trim() === "") return new NextResponse(null, { status: 401 });

  const presented =
    request.headers.get("x-stats-revalidate-token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (!presented || !safeEqual(presented, expected)) {
    return new NextResponse(null, { status: 401 });
  }

  const c = readCounters();
  return NextResponse.json(
    {
      commit: process.env.NEXT_PUBLIC_BUILD_SHA ?? "unknown",
      instanceId: c.instanceId,
      renders: c.renders,
      snapshotReads: c.snapshotReads,
      rpcCalls: c.rpcCalls,
      onchainReads: c.onchainReads,
      censusReads: c.censusReads,
      lastGeneratedAt: c.lastGeneratedAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** The diagnostic is a read. Fixing the other verb at 405 keeps it from being
 *  mistaken for a control surface. */
export async function POST(): Promise<NextResponse> {
  return new NextResponse(null, { status: 405 });
}
