/**
 * POST /api/scores/save
 *
 * The off-chain basic save. NEVER signs a tx, NEVER touches /api/sign-score,
 * submitScoreSigned, the Scoreboard contract or a wallet write.
 *
 * ── SLICE 0 (2026-07-29) + SLICE 0.1 (2026-07-30) ───────────────────────
 * Audit: docs/product/2026-07-27-score-and-leaders-audit.md §R1, §10.
 *
 * Originally this endpoint took `player` from the request body and validated
 * `score` only as "finite and > 0". A single `curl` could write any score for
 * ANY wallet — including someone else's — and land at #1.
 *
 * Slice 0 fixed authorship with a signature per save. Slice 0.1 kept the
 * property and changed its granularity: one signature buys a bounded,
 * revocable SESSION, and each save presents its bearer token. A prompt after
 * every exercise is a control players learn to dismiss reflexively, which is
 * worse than useless — it trains the habit the on-chain lane depends on.
 *
 *   Authorization: Bearer <score-session-token>
 *
 * WHAT THE TOKEN DOES AND DOES NOT AUTHORIZE
 * ------------------------------------------
 * It authorizes WRITING, not any value. The wallet and surface come out of the
 * session row, so a token can only ever write to its own wallet — that is
 * structural, not a check someone could forget. Everything else is still
 * validated per request:
 *
 *   1. ATTRIBUTABLE — wallet from the session, never from the body.
 *   2. BOUNDED      — level 1..6, score <= MAX_SCORE_PER_LEVEL, time <= 1h.
 *   3. SURFACED     — session surface must equal THIS deployment's mode.
 *   4. BUDGETED     — used_saves < max_saves, enforced atomically in one
 *                     UPDATE, so concurrent saves cannot both cross it.
 *   5. IDEMPOTENT   — save_id UNIQUE gives best-score-per-level dedup.
 *   6. NON-BREAKING — the score ceiling keeps the aggregate inside bigint.
 *
 * Origin is NOT authentication here — see `score-save-origin.ts`. A mismatched
 * origin is a hard 403; an absent one is allowed, logged, and harmless because
 * the token gate is mandatory.
 *
 * Contract:
 *   200 → saved/free | duplicate                     (BasicScoreSaveResult)
 *   400 → { status: "invalid", reason }               malformed / out of bounds
 *   401 → { status: "invalid", reason }               token missing/expired/revoked
 *   403 → { status: "error", reason: "forbidden" }    origin mismatch
 *   409 → { status: "invalid", reason: "session_exhausted" }
 *   429 → { status: "rate_limited", retryAfterMs }
 *   500 → { status: "error", reason: "save_failed" }
 *   503 → { status: "error", reason: "unavailable" }
 */

import { NextResponse } from "next/server";

import { resolveDeploymentSurface } from "@/lib/scores/deployment-surface";
import { validateScoreSaveBounds } from "@/lib/scores/save-authorization";
import {
  computeScoreSaveQuota,
  deriveScoreSaveId,
  type BasicScoreSaveResult,
} from "@/lib/scores/save-service";
import { enforceScoreSaveRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import { createLogger, hashWallet } from "@/lib/server/logger";
import { classifyScoreSaveOrigin } from "@/lib/server/score-save-origin";
import {
  consumeScoreWriteSession,
  isSessionTokenShape,
} from "@/lib/server/score-session-store";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const log = createLogger({ route: "/api/scores/save" });

/** Window of the soft limiter; surfaced to the client as a retry hint. */
const RATE_LIMIT_WINDOW_MS = 60_000;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function json(result: BasicScoreSaveResult, status: number) {
  return NextResponse.json(result, { status });
}

/** `Authorization: Bearer <token>`, shape-checked before it reaches the DB. */
function readBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer ([0-9a-f]{64})$/.exec(header.trim());
  if (!match) return null;
  return isSessionTokenShape(match[1]) ? match[1] : null;
}

export async function POST(req: Request) {
  // 1. Origin — defence in depth, not authentication.
  const origin = classifyScoreSaveOrigin(
    req.headers.get("origin"),
    req.headers.get("referer"),
  );
  if (origin.verdict === "rejected") {
    log.warn("score_save_origin_rejected", { source: origin.source });
    return json({ status: "error", reason: "forbidden" }, 403);
  }
  if (origin.reason === "absent") {
    log.warn("score_save_origin_absent", {
      user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
    });
  }

  // 2. Soft IP limiter, before any DB work.
  try {
    await enforceScoreSaveRateLimit(getRequestIp(req));
  } catch {
    return json({ status: "rate_limited", retryAfterMs: RATE_LIMIT_WINDOW_MS }, 429);
  }

  // 3. Token.
  const token = readBearerToken(req);
  if (!token) {
    return json({ status: "invalid", reason: "missing_session" }, 401);
  }

  // 4. Body — three numbers and nothing else that matters. Note there is no
  //    `player` read anywhere in this handler, by construction.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ status: "invalid", reason: "invalid_input" }, 400);
  }
  if (!isPlainObject(body)) {
    return json({ status: "invalid", reason: "invalid_input" }, 400);
  }

  const bounds = validateScoreSaveBounds({
    levelId: body.levelId,
    score: body.score,
    timeMs: body.timeMs,
  });
  if (!bounds.ok) {
    return json({ status: "invalid", reason: bounds.error }, 400);
  }
  const { levelId, score, timeMs } = bounds.value;

  const supabase = getSupabaseServer();
  if (!supabase) {
    log.error("supabase_unavailable");
    return json({ status: "error", reason: "unavailable" }, 503);
  }

  // 5. Spend one save from the session. This is also where the wallet comes
  //    from. Fails CLOSED on anything but `consumed`: an unreachable session
  //    store means no budget accounting, and no save is urgent enough for that.
  const spend = await consumeScoreWriteSession(supabase, token);
  switch (spend.status) {
    case "consumed":
      break;
    case "exhausted":
      log.warn("score_save_session_exhausted");
      return json({ status: "invalid", reason: "session_exhausted" }, 409);
    case "expired":
      return json({ status: "invalid", reason: "session_expired" }, 401);
    case "revoked":
      return json({ status: "invalid", reason: "session_revoked" }, 401);
    case "not_found":
      return json({ status: "invalid", reason: "invalid_session" }, 401);
    default:
      return json({ status: "error", reason: "unavailable" }, 503);
  }

  const wallet = spend.wallet;
  const walletHash = hashWallet(wallet);

  // 6. A session minted on the other product must not write here. The token is
  //    already surface-bound at issue time; this catches a deployment whose
  //    mode changed under a live session (audit R12).
  const deploymentSurface = resolveDeploymentSurface();
  if (spend.surface !== deploymentSurface) {
    log.warn("score_save_surface_mismatch", {
      wallet: walletHash,
      session: spend.surface,
      deployment: deploymentSurface,
    });
    return json({ status: "invalid", reason: "surface_mismatch" }, 400);
  }

  // 7. Atomic RPC. `save_id` keeps its ORIGINAL semantics — best-score-per-
  //    level identity — and nothing more. It was never authenticity (it is a
  //    predictable concatenation); the session token is. Deriving it here
  //    rather than accepting it means the client cannot aim at another key.
  const gameId = String(score);
  const saveId = deriveScoreSaveId(wallet, levelId, gameId);

  const { data, error } = await supabase.rpc("save_basic_score", {
    p_save_id: saveId,
    p_wallet: wallet,
    p_level_id: levelId,
    p_score: score,
    p_time_ms: timeMs,
    p_game_id: gameId,
    p_attestation_hash: null,
    p_metadata: null,
    p_surface: spend.surface,
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
