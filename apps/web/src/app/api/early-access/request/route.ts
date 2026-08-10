/**
 * POST /api/early-access/request
 *
 * Records that somebody asked for a Chesscito Web key. Design:
 * docs/specs/2026-08-10-web-early-access-design.md §B2/B6.
 *
 * ⚠️ THIS ROUTE GRANTS NOTHING, AND THAT IS WHY IT CAN BE UNAUTHENTICATED.
 *
 * Access to Chesscito Web is granted by Privy's own allowlist, enforced by
 * Privy's login server. This route only appends to an operational queue the
 * founder reads. The strongest thing an attacker gets from a successful call
 * is a row in a list somebody looks at with their eyes — so the route is
 * deliberately open, because requiring auth would cost a Privy MAU, which is
 * the exact resource Early Access exists to protect.
 *
 * It can therefore never write `allowlisted`: the column defaults to `waiting`
 * and `recordEarlyAccessRequest` passes no status at all.
 *
 * Contract:
 *   200 → { ok: true, outcome: "created" | "already-requested" }
 *   400 → { error: "invalid_email" }
 *   403 → { error: "forbidden" }          origin absent or mismatched
 *   429 → { error: "rate_limited" }
 *   503 → { error: "unavailable" }        no database configured / write failed
 */

import { NextResponse } from "next/server";

import { normalizeSource } from "@/lib/analytics/dimensions";
import { normalizeEarlyAccessEmail } from "@/lib/early-access/request";
import { resolveDeploymentSurface } from "@/lib/scores/deployment-surface";
import { enforceEarlyAccessRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import { classifyEarlyAccessOrigin } from "@/lib/server/early-access-origin";
import { recordEarlyAccessRequest } from "@/lib/server/early-access-store";
import { createLogger } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const log = createLogger({ route: "/api/early-access/request" });

export async function POST(req: Request) {
  const origin = classifyEarlyAccessOrigin(
    req.headers.get("origin"),
    req.headers.get("referer"),
  );
  if (origin.verdict === "rejected") {
    log.warn("early_access_origin_rejected", { reason: origin.reason });
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await enforceEarlyAccessRateLimit(getRequestIp(req));
  } catch {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const { email: rawEmail, source: rawSource } = body as Record<string, unknown>;

  // The ONLY normalizer for this value, and it runs here. Whatever the form did
  // client-side is a convenience for the player, never the value we key on.
  const email = normalizeEarlyAccessEmail(rawEmail);
  if (!email) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  // Re-sanitized through the SAME allow-list the telemetry pipeline uses, so a
  // free-form string in the body can never become a new dimension value. Null
  // stays null — an unattributable request is recorded as such rather than
  // padded with a default that would look like real attribution.
  const source = normalizeSource(rawSource);

  // Never read from the body: a Learn deployment must not be able to file a
  // request tagged `play`, even politely (same rule as the score challenge).
  const surface = resolveDeploymentSurface();

  const supabase = getSupabaseServer();
  if (!supabase) {
    log.error("supabase_unavailable");
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const result = await recordEarlyAccessRequest(supabase, {
    email,
    surface,
    source,
  });

  if (result.status === "unavailable") {
    // The email is deliberately absent from the log line. It is the one piece
    // of PII this route touches, and a failed write is not a reason to start
    // writing it somewhere with a different retention story.
    log.error("early_access_write_failed", { surface });
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  // `outcome` is returned so the client can emit the research event that
  // separates "25 people asked" from "9 people asked, some twice". It does
  // reveal whether THIS address is already in the queue — accepted knowingly:
  // the fact is low-sensitivity, the route is rate-limited, and both outcomes
  // render the identical confirmation, so nothing about it reaches the player.
  return NextResponse.json({ ok: true, outcome: result.outcome }, { status: 200 });
}
