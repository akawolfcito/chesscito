/**
 * POST /api/scores/session/challenge
 *
 * Step 1 of the score write session (Slice 0.1).
 * Audit: docs/product/2026-07-27-score-and-leaders-audit.md §10.
 *
 * Hands the client the exact text it must sign. Every term — session id,
 * window, save budget — is decided HERE. The client sends a wallet and a
 * surface; it does not get to propose how long its capability lasts or how
 * many writes it covers.
 *
 * This endpoint issues nothing usable on its own: a challenge is a pending row
 * with no token. It becomes a credential only after `/authorize` verifies a
 * signature over it.
 *
 * Contract:
 *   200 → { message, sessionId, expiresAt, maxSaves }
 *   400 → { error: "invalid_wallet" | "invalid_surface" }
 *   403 → { error: "forbidden" }               origin mismatch
 *   429 → { error: "rate_limited" }
 *   503 → { error: "unavailable" }
 */

import { NextResponse } from "next/server";

import { getConfiguredChainId } from "@/lib/contracts/chains";
import { resolveDeploymentSurface } from "@/lib/scores/deployment-surface";
import { buildScoreSessionMessage } from "@/lib/scores/session-authorization";
import { enforceScoreSaveRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import { createLogger, hashWallet } from "@/lib/server/logger";
import { issueScoreWriteChallenge } from "@/lib/server/score-session-store";
import { classifyScoreSaveOrigin } from "@/lib/server/score-save-origin";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const log = createLogger({ route: "/api/scores/session/challenge" });

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export async function POST(req: Request) {
  const origin = classifyScoreSaveOrigin(
    req.headers.get("origin"),
    req.headers.get("referer"),
  );
  if (origin.verdict === "rejected") {
    log.warn("challenge_origin_rejected", { source: origin.source });
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }

  const { wallet: rawWallet } = body as Record<string, unknown>;
  if (typeof rawWallet !== "string" || !ADDRESS_RE.test(rawWallet)) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }
  const wallet = rawWallet.toLowerCase();

  // The surface is NOT read from the body. A challenge can only ever be issued
  // for the product this deployment is, so a Learn build cannot mint a play
  // capability even if asked politely (audit R12).
  const surface = resolveDeploymentSurface();

  // A deployment with no configured chain cannot issue a usable challenge: the
  // chain is part of the signed terms, and `authorize` rejects a non-positive
  // one. Emitting a placeholder here would hand the client a message that is
  // ALWAYS rejected later — a 200 followed by an inexplicable 400, with the
  // real cause (a missing env var) named nowhere. Fail loudly, at the step
  // that actually knows what is wrong.
  const chainId = getConfiguredChainId();
  if (chainId === null) {
    log.error("chain_not_configured", {
      hint: "NEXT_PUBLIC_CHAIN_ID missing or unsupported",
    });
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    log.error("supabase_unavailable", { wallet: hashWallet(wallet) });
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const issued = await issueScoreWriteChallenge(supabase, wallet, surface);
  if (issued.status !== "issued") {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const { sessionId, issuedAt, expiresAt, maxSaves } = issued.challenge;

  return NextResponse.json(
    {
      message: buildScoreSessionMessage({
        chainId,
        wallet,
        surface,
        sessionId,
        issuedAt,
        expiresAt,
        maxSaves,
      }),
      sessionId,
      expiresAt,
      maxSaves,
    },
    { status: 200 },
  );
}
