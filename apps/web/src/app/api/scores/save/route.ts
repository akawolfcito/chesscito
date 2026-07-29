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

import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { getMergedCatalog } from "@/lib/content/merged-catalog";
import { gradeAttempt } from "@/lib/scores/attempt-grading";
import {
  parseAttemptMeasurement,
  type AttemptMeasurement,
} from "@/lib/scores/attempt-measurement";
import { resolveDeploymentSurface } from "@/lib/scores/deployment-surface";
import { validateScoreSaveBounds } from "@/lib/scores/save-authorization";
import {
  computeScoreSaveQuota,
  type AttemptOutcome,
  type BasicScoreSaveResult,
} from "@/lib/scores/save-service";
import { enforceScoreSaveRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import { createLogger, hashWallet } from "@/lib/server/logger";
import { classifyScoreSaveOrigin } from "@/lib/server/score-save-origin";
import {
  hashSessionToken,
  isSessionTokenShape,
} from "@/lib/server/score-session-store";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const log = createLogger({ route: "/api/scores/save" });

/** Window of the soft limiter; surfaced to the client as a retry hint. */
const RATE_LIMIT_WINDOW_MS = 60_000;

/** The wire shape of an attempt id: 32 lowercase hex. */
const ATTEMPT_ID_RE = /^[0-9a-f]{32}$/;

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

/**
 * The attempt's identity, and where it came from.
 *
 * An ABSENT id is tolerated and the server mints one (B14). That is what makes
 * the deploy order safe: this endpoint and the migration can ship before the
 * bundle that mints ids, and every request in between still records its play —
 * marked `server` so nobody later mistakes it for client-minted provenance.
 *
 * A PRESENT but malformed id is a 400, not a silent re-mint: it means the
 * client believes it has an identity we would be quietly discarding, and a
 * discarded id turns a retry into a second attempt.
 */
type AttemptIdentity =
  | { ok: true; attemptId: string; source: "client" | "server" }
  | { ok: false };

function resolveAttemptIdentity(raw: unknown): AttemptIdentity {
  if (raw === undefined || raw === null) {
    return { ok: true, attemptId: randomBytes(16).toString("hex"), source: "server" };
  }
  if (typeof raw !== "string" || !ATTEMPT_ID_RE.test(raw)) return { ok: false };
  return { ok: true, attemptId: raw, source: "client" };
}

/**
 * Did the RPC fail because the store was unreachable, or because the call
 * broke once it got there?
 *
 * Postgres classes 08 (connection), 53 (insufficient resources) and 57
 * (operator intervention) are the "come back later" ones. A transport failure
 * carries no `code` at all — Supabase never reached PostgREST — and that is
 * the plainest unreachable of the lot.
 */
function isUnreachable(error: { code?: string } | null): boolean {
  if (!error) return false;
  if (!error.code) return true;
  return /^(08|53|57)/.test(error.code);
}

/** The three measurement columns, flattened for the RPC. */
function measureColumns(measurement: AttemptMeasurement | null) {
  if (!measurement) {
    return { kind: null, value: null, ceiling: null };
  }
  switch (measurement.kind) {
    case "moves":
      return { kind: "moves", value: measurement.movesUsed, ceiling: null };
    case "failures":
      return { kind: "failures", value: measurement.failures, ceiling: null };
    case "coverage":
      return {
        kind: "coverage",
        value: measurement.reached,
        ceiling: measurement.ceiling,
      };
  }
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

  // 5. Attempt identity. Resolved BEFORE any DB work: a malformed id is a
  //    client bug, and answering it costs nothing.
  const identity = resolveAttemptIdentity(body.attemptId);
  if (!identity.ok) {
    return json({ status: "invalid", reason: "invalid_attempt_id" }, 400);
  }
  if (identity.source === "server") {
    log.warn("score_attempt_id_absent");
  }

  // 6. Grading (D12). THE CLIENT NEVER SENDS STARS — `body.starsEarned` is not
  //    read anywhere in this handler, by construction, exactly as `player` is
  //    not. What it sends is a raw measurement and the id of the level it
  //    played; the grader the catalogue bucket selects turns that into a star
  //    count, on this side of the wire.
  //
  //    Absent exerciseId or measurement → `ungraded` with NULL columns (B15).
  //    That is genuinely unknown, not a sentinel, and it is what a bundle
  //    older than this deploy sends.
  const exerciseId =
    typeof body.exerciseId === "string" && body.exerciseId.length > 0
      ? body.exerciseId
      : null;
  const hasMeasurement = body.measurement !== undefined && body.measurement !== null;
  const measurement = hasMeasurement ? parseAttemptMeasurement(body.measurement) : null;
  if (hasMeasurement && !measurement) {
    return json({ status: "invalid", reason: "invalid_measurement" }, 400);
  }

  let gradeStatus: AttemptOutcome["gradeStatus"] = "ungraded";
  let starsEarned: number | null = null;
  if (exerciseId && measurement) {
    // The catalogue read can fail — it is cached through `unstable_cache`, and
    // an overlay fetch sits behind it. Failing here must not 500 the save
    // path with a stack: without a catalogue there is no honest grade, and
    // guessing one would write a permanent row from a value nobody computed.
    let catalog;
    try {
      catalog = await getMergedCatalog();
    } catch (e) {
      log.error("catalog_unavailable", { message: (e as Error)?.message });
      return json({ status: "error", reason: "unavailable" }, 503);
    }
    const graded = gradeAttempt({ exerciseId, levelId, measurement }, catalog);
    if (!graded.ok) {
      // Four distinct 400s, never a fallback grade: an unknown exercise, a
      // level that is not the catalogue's, a measurement of the wrong kind for
      // the bucket, and one out of range are four different client bugs.
      return json({ status: "invalid", reason: graded.reason }, 400);
    }
    gradeStatus = graded.grade;
    starsEarned = graded.starsEarned;
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    log.error("supabase_unavailable");
    return json({ status: "error", reason: "unavailable" }, 503);
  }

  // 7. ONE RPC, ONE TRANSACTION. The session consume used to live here, as a
  //    separate round trip before the save — which meant a failure in between
  //    spent a unit for a row that was never written, and "rejected consumes
  //    nothing" depended on nothing going wrong. It is now step 5 INSIDE
  //    `save_score_attempt`, so a later failure rolls it back with everything
  //    else. The wallet still comes out of the session row, never the body.
  const measure = measureColumns(measurement);
  const deploymentSurface = resolveDeploymentSurface();

  const { data, error } = await supabase.rpc("save_score_attempt", {
    p_token_hash: hashSessionToken(token),
    p_attempt_id: identity.attemptId,
    p_attempt_id_source: identity.source,
    p_level_id: levelId,
    p_score: score,
    p_time_ms: timeMs,
    p_exercise_id: exerciseId,
    p_measure_kind: measure.kind,
    p_measure_value: measure.value,
    p_measure_ceiling: measure.ceiling,
    p_grade_status: gradeStatus,
    p_stars_earned: starsEarned,
    p_deployment_surface: deploymentSurface,
  });

  if (error || !data || typeof data !== "object") {
    log.error("rpc_failed", { code: error?.code, message: error?.message });
    // Merging the consume into this call merged their failure modes too, so
    // the class has to be read rather than assumed. A store we could not
    // REACH is a 503 the client may retry; a call that reached it and broke
    // is a 500. Both fail closed — nothing was written and nothing spent,
    // because the whole thing is one transaction.
    return isUnreachable(error)
      ? json({ status: "error", reason: "unavailable" }, 503)
      : json({ status: "error", reason: "save_failed" }, 500);
  }

  // 8. Map jsonb → BasicScoreSaveResult. The wallet comes back from the RPC so
  //    the endpoint keeps its logging identity; it is hashed here because
  //    `hashWallet` is salted with LOG_SALT, which lives in this environment
  //    and not in the database.
  const row = data as Record<string, unknown>;
  const wallet = typeof row.wallet === "string" ? row.wallet : null;
  const walletHash = wallet ? hashWallet(wallet) : null;

  if (row.status === "session_error") {
    switch (row.sessionStatus) {
      case "exhausted":
        log.warn("score_save_session_exhausted", { wallet: walletHash });
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
  }

  if (row.status === "invalid") {
    if (row.reason === "surface_mismatch") {
      log.warn("score_save_surface_mismatch", {
        wallet: walletHash,
        deployment: deploymentSurface,
      });
    }
    return json({ status: "invalid", reason: String(row.reason ?? "invalid_input") }, 400);
  }

  const attemptRow = isPlainObject(row.attempt) ? row.attempt : null;
  const attempt: AttemptOutcome | undefined = attemptRow
    ? {
        attemptId: String(attemptRow.attemptId ?? identity.attemptId),
        attemptIndex: Number(attemptRow.attemptIndex ?? 0),
        replayed: attemptRow.replayed === true,
        starsEarned:
          attemptRow.starsEarned === null || attemptRow.starsEarned === undefined
            ? null
            : Number(attemptRow.starsEarned),
        gradeStatus: (attemptRow.gradeStatus ?? gradeStatus) as AttemptOutcome["gradeStatus"],
      }
    : undefined;

  if (attempt?.replayed) {
    log.warn("score_attempt_replayed", { wallet: walletHash });
  }

  const freeUsed = Number(row.freeUsed ?? 0);
  const quota = computeScoreSaveQuota(wallet ?? "", freeUsed);

  switch (row.status) {
    case "saved":
      return json({ status: "saved", mode: "free", quota, attempt }, 200);
    case "duplicate":
      return json({ status: "duplicate", quota, attempt }, 200);
    default:
      log.error("rpc_unexpected_status", {
        wallet: walletHash,
        status: String(row.status),
      });
      return json({ status: "error", reason: "save_failed" }, 500);
  }
}
