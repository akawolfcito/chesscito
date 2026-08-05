import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { STATS_CACHE_TAG } from "@/lib/stats/snapshot";

/**
 * Refresh the `/stats` snapshot without a deploy.
 *
 * ⚠️ **This exists because a deploy does NOT purge Next's Data Cache.** A
 * broken census once survived 18 h 34 min *and a full deploy*; "just redeploy"
 * is not an invalidation strategy. This handler is the only one there is.
 *
 * Auth is a single server-only shared secret. It is compared in constant time,
 * never logged, never echoed, and never returned in an error body — the
 * responses carry no detail an attacker could use to tell "no token" apart from
 * "wrong token", which is why both are the same bare 401.
 *
 * ⛔ `STATS_REVALIDATE_TOKEN` has NO `NEXT_PUBLIC_` prefix and never will. A
 * prefixed name is inlined into the browser bundle at build time, which would
 * publish the key that lets anyone flush the cache at will.
 *
 * **Fails CLOSED.** With the variable unset the endpoint answers 401 to
 * everything, including a request that carries the right value by luck. An
 * unconfigured secret must not become an open door.
 */
export const dynamic = "force-dynamic";

/** Constant-time compare over equal-length byte strings. Returns false on a
 *  length mismatch WITHOUT comparing, which leaks only the length — the same
 *  thing the HTTP framing leaks anyway. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Bare 401. No `WWW-Authenticate`, no reason, no hint about configuration. */
function unauthorized(): NextResponse {
  return new NextResponse(null, { status: 401 });
}

export async function POST(request: Request): Promise<NextResponse> {
  const expected = process.env.STATS_REVALIDATE_TOKEN;

  // Fail closed: unset, empty, or whitespace-only is NOT a valid configuration.
  if (!expected || expected.trim() === "") return unauthorized();

  const presented =
    request.headers.get("x-stats-revalidate-token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  if (!presented || !safeEqual(presented, expected)) return unauthorized();

  revalidateTag(STATS_CACHE_TAG);

  // The tag, not the token. Naming what was invalidated is useful to whoever
  // called it and useless to anyone who could not call it.
  return NextResponse.json({ revalidated: true, tag: STATS_CACHE_TAG });
}

/** GET is not an invalidation verb — a prefetch or a crawler must never be able
 *  to flush the cache by following a link. */
export async function GET(): Promise<NextResponse> {
  return new NextResponse(null, { status: 405 });
}
