/**
 * POST /api/scores/save
 *
 * The off-chain basic save. NEVER signs a tx, NEVER touches /api/sign-score,
 * submitScoreSigned, the Scoreboard contract or a wallet write.
 *
 * ── SLICE 0 (2026-07-29): the write path is closed ───────────────────────
 * Audit: docs/product/2026-07-27-score-and-leaders-audit.md §R1 (critical).
 *
 * Before this revision the endpoint took `player` from the request body and
 * validated `score` only as "finite and > 0". Combined with `enforceOrigin`'s
 * documented header-less bypass, that meant a single `curl` could write any
 * score for ANY wallet — including someone else's — and land at #1. Nothing
 * in the request proved authorship.
 *
 * The body no longer carries a player at all. It carries `{ message,
 * signature }`; the author is RECOVERED from an EIP-191 signature over the
 * canonical message in `lib/scores/save-authorization.ts`, and every other
 * value (surface, levelId, score, timeMs, validity window, nonce) is read back
 * out of that signed text. A field outside the signature is a field an
 * attacker can rewrite in flight, so there are none.
 *
 * Six properties this establishes, in order of enforcement:
 *   1. ATTRIBUTABLE — address comes from ECDSA recovery, never from the body.
 *   2. BOUNDED      — level 1..6, score <= MAX_SCORE_PER_LEVEL, time <= 1h,
 *                     window <= 5 min, all checked server-side.
 *   3. SURFACED     — the signed `surface` must equal THIS deployment's mode;
 *                     a learn build refuses a play payload and vice versa.
 *   4. REPLAY-PROOF — the nonce is burned in Postgres before the write.
 *   5. IDEMPOTENT   — unchanged: save_id UNIQUE gives best-score-per-level
 *                     dedup, and the RPC returns `duplicate`.
 *   6. NON-BREAKING — score ceiling keeps the leaderboard aggregate inside
 *                     bigint (the view was widened in the same migration).
 *
 * Origin is NOT authentication here anymore — see `score-save-origin.ts`. A
 * mismatched origin is still a hard 403; an absent one is allowed, logged, and
 * harmless because the signature gate is mandatory.
 *
 * Contract:
 *   200 → saved/free | duplicate                     (BasicScoreSaveResult)
 *   400 → { status: "invalid", reason }               malformed / out of bounds
 *   401 → { status: "invalid", reason }               signature / replay
 *   403 → { status: "error", reason: "forbidden" }    origin mismatch
 *   429 → { status: "rate_limited", retryAfterMs }
 *   500 → { status: "error", reason: "save_failed" }
 *   503 → { status: "error", reason: "unavailable" }  supabase/nonce store down
 */

import { NextResponse } from "next/server";

import { getConfiguredChainId } from "@/lib/contracts/chains";
import { resolveDeploymentSurface } from "@/lib/scores/deployment-surface";
import {
  computeScoreSaveQuota,
  deriveScoreSaveId,
  type BasicScoreSaveResult,
} from "@/lib/scores/save-service";
import {
  enforceScoreSaveRateLimit,
  getRequestIp,
} from "@/lib/server/demo-signing";
import { createLogger, hashWallet } from "@/lib/server/logger";
import { consumeScoreSaveNonce } from "@/lib/server/score-save-nonce";
import { classifyScoreSaveOrigin } from "@/lib/server/score-save-origin";
import { verifyScoreSaveRequest } from "@/lib/server/score-save-verification";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const log = createLogger({ route: "/api/scores/save" });

/** Window of the soft limiter; surfaced to the client as a retry hint. */
const RATE_LIMIT_WINDOW_MS = 60_000;

/** Verification failures that mean "you are not who you claim" rather than
 *  "your payload is malformed". These get 401 so the client can tell a bug
 *  from a rejected identity. */
const UNAUTHORIZED_REASONS = new Set([
  "missing_signature",
  "signature_mismatch",
  "expired",
  "not_yet_valid",
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function json(result: BasicScoreSaveResult, status: number) {
  return NextResponse.json(result, { status });
}

export async function POST(req: Request) {
  // 1. Origin — defence in depth, not authentication. A mismatch is hostile
  //    and rejected; an absent header is allowed but never silent (the whole
  //    reason R1 stayed invisible was that the bypass logged nothing).
  const origin = classifyScoreSaveOrigin(
    req.headers.get("origin"),
    req.headers.get("referer"),
  );
  if (origin.verdict === "rejected") {
    log.warn("score_save_origin_rejected", { source: origin.source });
    return json({ status: "error", reason: "forbidden" }, 403);
  }
  if (origin.reason === "absent") {
    // MiniPay's WebView omits both headers on same-site fetches. Kept as a
    // counted signal, not a hole: the signature below is what authenticates.
    log.warn("score_save_origin_absent", {
      user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
    });
  }

  // 2. Soft IP limiter (429). Cheap, before any crypto or DB work.
  try {
    await enforceScoreSaveRateLimit(getRequestIp(req));
  } catch {
    return json({ status: "rate_limited", retryAfterMs: RATE_LIMIT_WINDOW_MS }, 429);
  }

  // 3. Parse transport.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ status: "invalid", reason: "invalid_input" }, 400);
  }
  if (!isPlainObject(body)) {
    return json({ status: "invalid", reason: "invalid_input" }, 400);
  }

  // 4. THE gate. Recovers the author and validates every bound. Note there is
  //    no `body.player` read anywhere in this handler — by construction.
  const verified = await verifyScoreSaveRequest(
    { message: body.message, signature: body.signature },
    {
      expectedSurface: resolveDeploymentSurface(),
      expectedChainId: getConfiguredChainId(),
      now: Date.now(),
    },
  );
  if (!verified.ok) {
    const status = UNAUTHORIZED_REASONS.has(verified.error) ? 401 : 400;
    log.warn("score_save_rejected", { reason: verified.error, status });
    return json({ status: "invalid", reason: verified.error }, status);
  }

  const { claim } = verified;
  const wallet = claim.player;
  const walletHash = hashWallet(wallet);

  // 5. Supabase service-role client. Null → 503 (NOT optimistic): the server
  //    must not claim "saved" without persisting.
  const supabase = getSupabaseServer();
  if (!supabase) {
    log.error("supabase_unavailable", { wallet: walletHash });
    return json({ status: "error", reason: "unavailable" }, 503);
  }

  // 6. Burn the nonce BEFORE the write. A valid signature is a bearer token;
  //    this is what makes it single-use. Fails CLOSED — an unreachable nonce
  //    store means no replay protection, and no save is urgent enough for that.
  const burn = await consumeScoreSaveNonce(
    supabase,
    wallet,
    claim.nonce,
    claim.expiresAt,
  );
  if (burn.status === "replayed") {
    log.warn("score_save_replay", { wallet: walletHash });
    return json({ status: "invalid", reason: "nonce_replayed" }, 401);
  }
  if (burn.status === "unavailable") {
    return json({ status: "error", reason: "unavailable" }, 503);
  }

  // 7. Atomic RPC. `save_id` keeps its ORIGINAL semantics — best-score-per-
  //    level identity — and nothing more. It was never authenticity (it is a
  //    predictable concatenation); the signature above is. Deriving it here
  //    rather than accepting it means the client cannot aim at another key.
  const gameId = String(claim.score);
  const saveId = deriveScoreSaveId(wallet, claim.levelId, gameId);

  const { data, error } = await supabase.rpc("save_basic_score", {
    p_save_id: saveId,
    p_wallet: wallet,
    p_level_id: claim.levelId,
    p_score: claim.score,
    p_time_ms: claim.timeMs,
    p_game_id: gameId,
    p_attestation_hash: null,
    p_metadata: null,
    p_surface: claim.surface,
  });

  if (error || !data || typeof data !== "object") {
    log.error("rpc_failed", {
      wallet: walletHash,
      code: error?.code,
      message: error?.message,
    });
    return json({ status: "error", reason: "save_failed" }, 500);
  }

  // 8. Map jsonb → BasicScoreSaveResult. Off-chain save is always free, so the
  //    RPC only ever returns `saved` (mode free) or `duplicate`.
  const row = data as Record<string, unknown>;
  const freeUsed = Number(row.freeUsed ?? 0);
  const quota = computeScoreSaveQuota(wallet, freeUsed);

  switch (row.status) {
    case "saved":
      return json({ status: "saved", mode: "free", quota }, 200);
    case "duplicate":
      return json({ status: "duplicate", quota }, 200);
    default:
      log.error("rpc_unexpected_status", {
        wallet: walletHash,
        status: String(row.status),
      });
      return json({ status: "error", reason: "save_failed" }, 500);
  }
}
