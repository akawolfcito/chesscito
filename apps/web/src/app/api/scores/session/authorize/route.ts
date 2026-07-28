/**
 * POST /api/scores/session/authorize
 *
 * Step 2 of the score write session (Slice 0.1).
 * Audit: docs/product/2026-07-27-score-and-leaders-audit.md §10.
 *
 * Verifies the EIP-191 signature over a challenge and, exactly once, turns
 * that pending row into an active session. Returns the raw bearer token — the
 * ONLY time it ever exists outside the client. The table stores its SHA-256,
 * so a dump of the DB yields nothing usable.
 *
 * Two independent checks, both required:
 *   - the SIGNATURE proves the wallet agreed (this route);
 *   - the STORED ROW proves the terms are the ones we issued (the RPC). A
 *     client can sign a message it invented with a generous maxSaves; it will
 *     match no row.
 *
 * Contract:
 *   200 → { token, sessionId, expiresAt, maxSaves }
 *   400 → { error }                              malformed / policy
 *   401 → { error }                              signature / freshness
 *   403 → { error: "forbidden" }                 origin mismatch
 *   409 → { error: "already_used" }              challenge already spent
 *   429 → { error: "rate_limited" }
 *   503 → { error: "unavailable" }
 */

import { NextResponse } from "next/server";

import { getConfiguredChainId } from "@/lib/contracts/chains";
import { resolveDeploymentSurface } from "@/lib/scores/deployment-surface";
import { enforceScoreSaveRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import { createLogger, hashWallet } from "@/lib/server/logger";
import { authorizeScoreWriteSession } from "@/lib/server/score-session-store";
import { classifyScoreSaveOrigin } from "@/lib/server/score-save-origin";
import { verifyScoreSessionRequest } from "@/lib/server/score-session-verification";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const log = createLogger({ route: "/api/scores/session/authorize" });

/** Failures that mean "you are not who you claim" or "you took too long",
 *  rather than "your payload is malformed". */
const UNAUTHORIZED_REASONS = new Set(["missing_signature", "signature_mismatch", "expired"]);

export async function POST(req: Request) {
  const origin = classifyScoreSaveOrigin(
    req.headers.get("origin"),
    req.headers.get("referer"),
  );
  if (origin.verdict === "rejected") {
    log.warn("authorize_origin_rejected", { source: origin.source });
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (origin.reason === "absent") {
    // MiniPay's WebView omits both headers on same-site fetches. Counted, not
    // silent — and it buys nothing, since the signature below is mandatory.
    log.warn("authorize_origin_absent", {
      user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
    });
  }

  try {
    await enforceScoreSaveRateLimit(getRequestIp(req));
  } catch {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_message" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_message" }, { status: 400 });
  }
  const { message, signature } = body as Record<string, unknown>;

  const verified = await verifyScoreSessionRequest(
    { message, signature },
    {
      expectedSurface: resolveDeploymentSurface(),
      expectedChainId: getConfiguredChainId(),
      now: Date.now(),
    },
  );
  if (!verified.ok) {
    const status = UNAUTHORIZED_REASONS.has(verified.error) ? 401 : 400;
    log.warn("authorize_rejected", { reason: verified.error, status });
    return NextResponse.json({ error: verified.error }, { status });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    log.error("supabase_unavailable", { wallet: hashWallet(verified.wallet) });
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const result = await authorizeScoreWriteSession(
    supabase,
    verified.challenge.sessionId,
    verified.wallet,
    verified.challenge.surface,
  );

  switch (result.status) {
    case "authorized":
      log.info("session_authorized", {
        wallet: hashWallet(verified.wallet),
        surface: verified.challenge.surface,
      });
      return NextResponse.json(
        {
          token: result.token,
          sessionId: verified.challenge.sessionId,
          expiresAt: result.expiresAt,
          maxSaves: result.maxSaves,
        },
        { status: 200 },
      );

    case "already_used":
      // Single-use is the point: a captured challenge is worthless once spent.
      return NextResponse.json({ error: "already_used" }, { status: 409 });

    case "challenge_expired":
      return NextResponse.json({ error: "challenge_expired" }, { status: 401 });

    case "revoked":
      return NextResponse.json({ error: "revoked" }, { status: 403 });

    case "not_found":
    case "mismatch":
      // A signature over terms we never issued, or for a different wallet /
      // surface than the challenge was written for.
      log.warn("authorize_no_matching_challenge", {
        wallet: hashWallet(verified.wallet),
        status: result.status,
      });
      return NextResponse.json({ error: "invalid_challenge" }, { status: 400 });

    default:
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
