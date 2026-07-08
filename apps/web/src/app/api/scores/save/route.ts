/**
 * POST /api/scores/save
 *
 * Slice 3 of the SaveScore off-chain/Peones cluster (spec:
 * docs/specs/savescore-offchain-peones.md). The off-chain basic save
 * that REPLACES the on-chain `submitScoreSigned` flow in the base game
 * loop — killing the /api/sign-score 429.
 *
 * This endpoint NEVER signs, NEVER sends a tx, NEVER touches
 * /api/sign-score, submitScoreSigned, the Scoreboard contract, or a
 * wallet write. It validates transport, re-derives the saveId
 * server-side, builds the save_game attestation, and calls the atomic
 * `save_basic_score` RPC (Slice 1) which decides free (<5) vs paid (>=5,
 * reusing peones_spend) inside one Postgres transaction.
 *
 * Contract:
 *   200 → saved/free | saved/peones | duplicate     (BasicScoreSaveResult)
 *   400 → { status: "invalid", reason }
 *   403 → { status: "error", reason: "forbidden" }
 *   409 → { status: "insufficient_peones", required, balance, quota }
 *   429 → { status: "rate_limited", retryAfterMs }
 *   500 → { status: "error", reason: "save_failed" }
 *   503 → { status: "error", reason: "unavailable" }   (supabase null —
 *          the optimistic quick-save-local degrade lives in the CLIENT)
 */

import { NextResponse } from "next/server";

import { normalizeWallet } from "@/lib/peones/ledger-service";
import {
  computeScoreSaveQuota,
  deriveScoreSaveId,
  type BasicScoreSaveResult,
} from "@/lib/scores/save-service";
import {
  enforceOrigin,
  enforceScoreSaveRateLimit,
  getRequestIp,
} from "@/lib/server/demo-signing";
import { createLogger } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const log = createLogger({ route: "/api/scores/save" });

/** Window of the soft limiter; surfaced to the client as a retry hint. */
const RATE_LIMIT_WINDOW_MS = 60_000;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

type ParsedInput = {
  wallet: string;
  levelId: number;
  score: number;
  timeMs: number;
  gameId: string;
  saveId: string;
};

type ParseResult =
  | { ok: true; value: ParsedInput }
  | { ok: false; reason: string };

function parseAndValidate(body: unknown): ParseResult {
  if (!isPlainObject(body)) return { ok: false, reason: "invalid_input" };

  // Wallet → normalize (throws on malformed) + lowercase.
  let wallet: string;
  try {
    if (typeof body.player !== "string") throw new Error("invalid_wallet");
    wallet = normalizeWallet(body.player);
  } catch {
    return { ok: false, reason: "invalid_wallet" };
  }

  const { levelId, score, timeMs, gameId, saveId } = body;

  if (typeof levelId !== "number" || !Number.isInteger(levelId) || levelId < 1 || levelId > 6) {
    return { ok: false, reason: "invalid_level" };
  }
  if (typeof score !== "number" || !Number.isFinite(score) || score <= 0) {
    return { ok: false, reason: "invalid_score" };
  }
  if (typeof timeMs !== "number" || !Number.isFinite(timeMs) || timeMs <= 0) {
    return { ok: false, reason: "invalid_time" };
  }
  if (typeof gameId !== "string" || gameId.length === 0 || gameId.length > 200) {
    return { ok: false, reason: "invalid_game_id" };
  }
  if (typeof saveId !== "string" || saveId.length === 0) {
    return { ok: false, reason: "invalid_save_id" };
  }

  // Re-derive the saveId server-side and reject a forged/mismatched one.
  // The client cannot pick a cheaper key — quota is counted per wallet,
  // and a mismatch is a hard 400.
  const derived = deriveScoreSaveId(wallet, levelId, gameId);
  if (derived !== saveId) {
    return { ok: false, reason: "save_id_mismatch" };
  }

  return { ok: true, value: { wallet, levelId, score, timeMs, gameId, saveId: derived } };
}

function json(result: BasicScoreSaveResult, status: number) {
  return NextResponse.json(result, { status });
}

export async function POST(req: Request) {
  // 1. Origin guard (403) + dedicated soft rate-limit (429).
  try {
    enforceOrigin(req);
  } catch {
    return json({ status: "error", reason: "forbidden" }, 403);
  }
  try {
    await enforceScoreSaveRateLimit(getRequestIp(req));
  } catch {
    return json({ status: "rate_limited", retryAfterMs: RATE_LIMIT_WINDOW_MS }, 429);
  }

  // 2. Parse JSON.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ status: "invalid", reason: "invalid_input" }, 400);
  }

  // 3. Validate + re-derive saveId.
  const parsed = parseAndValidate(body);
  if (!parsed.ok) {
    return json({ status: "invalid", reason: parsed.reason }, 400);
  }
  const { wallet, levelId, score, timeMs, gameId, saveId } = parsed.value;

  // 4. Supabase service-role client. Null → 503 (NOT optimistic): the
  //    server must not claim "saved" without persisting. The client owns
  //    the optimistic quick-save-local degrade (Slice 5).
  const supabase = getSupabaseServer();
  if (!supabase) {
    log.error("supabase_unavailable", { wallet });
    return json({ status: "error", reason: "unavailable" }, 503);
  }

  // 5. Atomic RPC. Returns a single jsonb object (NOT a table). Off-chain
  //    save is ALWAYS FREE (MiniPay Lote 2): the RPC never calls peones_spend,
  //    so the `save_game` sink never fires and no attestation is built. The
  //    `p_attestation_hash` param is kept for call-site compatibility only and
  //    passed null.
  const { data, error } = await supabase.rpc("save_basic_score", {
    p_save_id: saveId,
    p_wallet: wallet,
    p_level_id: levelId,
    p_score: score,
    p_time_ms: timeMs,
    p_game_id: gameId,
    p_attestation_hash: null,
    p_metadata: null,
  });

  if (error || !data || typeof data !== "object") {
    log.error("rpc_failed", { wallet, code: error?.code, message: error?.message });
    return json({ status: "error", reason: "save_failed" }, 500);
  }

  // 6. Map jsonb → BasicScoreSaveResult. Off-chain save is always free, so the
  //    RPC only ever returns `saved` (mode free) or `duplicate` — there is no
  //    paid path, no `insufficient_peones`, and no 409.
  const row = data as Record<string, unknown>;
  const freeUsed = Number(row.freeUsed ?? 0);
  const quota = computeScoreSaveQuota(wallet, freeUsed);

  switch (row.status) {
    case "saved":
      return json({ status: "saved", mode: "free", quota }, 200);
    case "duplicate":
      return json({ status: "duplicate", quota }, 200);
    default:
      log.error("rpc_unexpected_status", { wallet, status: String(row.status) });
      return json({ status: "error", reason: "save_failed" }, 500);
  }
}
