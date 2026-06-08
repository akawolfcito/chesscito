/**
 * POST /api/peones/spend
 *
 * Sprint 4 commit C of Training Economy Alpha 2026-06-08. The first
 * real debit against the Peones ledger. Backed by the SQL function
 * `peones_spend` (Sprint 4 commit B) which guarantees:
 *   1. Idempotent retries succeed even if balance is now insufficient.
 *   2. PRO bypass is evaluated atomically (when enabled).
 *   3. Balance check + insert run under a FOR UPDATE lock per wallet.
 *
 * NO UI consumer yet. NO Hint button. NO Coach integration. NO PRO
 * resolver — `p_apply_pro_bypass` is HARD-CODED to `false` in this
 * commit and lights up in Sprint 4 commit G. NO top-up. NO packs.
 *
 * Contract (calibration §4):
 *   200 → { wallet, target, targetId, requested, debited, newBalance,
 *           attestationHash, ledgerId, duplicate, proBypassApplied }
 *   400 → { error: "invalid_input" | "invalid_wallet"
 *                  | "unknown_target" | "invalid_amount"
 *                  | "invalid_idempotency_key" }
 *   409 → { error: "insufficient_balance" }
 *   429 → { error: "rate_limited" }
 *   500 → { error: "ledger_unavailable" | "ledger_write_failed" }
 */

import { NextResponse } from "next/server";

import { normalizeWallet } from "@/lib/peones/ledger-service";
import { buildAttestationHash } from "@/lib/peones/ledger-service-server";
import { resolveProBypass } from "@/lib/peones/pro-bypass";
import {
  hasSpendIdempotencyPrefix,
  isPeonesSpendTarget,
  sanitizeSpendMetadata,
  SPEND_COST_BY_TARGET,
  type PeonesSpendTarget,
} from "@/lib/peones/spend-service";
import {
  enforceOrigin,
  enforceReadRateLimit,
  getRequestIp,
} from "@/lib/server/demo-signing";
import { createLogger } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

const log = createLogger({ route: "/api/peones/spend" });

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

type ParsedSpendInput = {
  wallet: string;
  amount: number;
  target: PeonesSpendTarget;
  targetId: string;
  idempotencyKey: string;
  metadata: Record<string, string | number | boolean> | null;
};

type ParseResult =
  | { ok: true; value: ParsedSpendInput }
  | {
      ok: false;
      error:
        | "invalid_input"
        | "invalid_wallet"
        | "unknown_target"
        | "invalid_amount"
        | "invalid_idempotency_key";
    };

function parseAndValidate(body: unknown): ParseResult {
  if (!isPlainObject(body)) return { ok: false, error: "invalid_input" };

  // Wallet
  const rawWallet = body.wallet;
  if (typeof rawWallet !== "string") {
    return { ok: false, error: "invalid_wallet" };
  }
  let wallet: string;
  try {
    wallet = normalizeWallet(rawWallet);
  } catch {
    return { ok: false, error: "invalid_wallet" };
  }

  // Target
  const rawTarget = body.target;
  if (typeof rawTarget !== "string" || !isPeonesSpendTarget(rawTarget)) {
    return { ok: false, error: "unknown_target" };
  }
  const target: PeonesSpendTarget = rawTarget;

  // Amount — must match the server-trusted cost for this target.
  // We accept the client's `amount` only as a sanity echo; mismatch
  // is a 400, not a silent override.
  const amount = body.amount;
  const expectedCost = SPEND_COST_BY_TARGET[target];
  if (
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    amount !== expectedCost
  ) {
    return { ok: false, error: "invalid_amount" };
  }

  // targetId — opaque but bounded.
  const targetId = body.targetId;
  if (
    typeof targetId !== "string" ||
    targetId.length === 0 ||
    targetId.length > 200
  ) {
    return { ok: false, error: "invalid_input" };
  }

  // idempotencyKey — bounded + prefix-locked to this target.
  const idempotencyKey = body.idempotencyKey;
  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.length === 0 ||
    idempotencyKey.length > 200
  ) {
    return { ok: false, error: "invalid_idempotency_key" };
  }
  if (!hasSpendIdempotencyPrefix(target, idempotencyKey)) {
    return { ok: false, error: "invalid_idempotency_key" };
  }

  // Metadata — sanitise via whitelist. Anything outside is dropped
  // silently; non-plain-object input is treated as "no metadata".
  const metadata =
    body.metadata === undefined ? null : sanitizeSpendMetadata(body.metadata);

  return {
    ok: true,
    value: { wallet, amount, target, targetId, idempotencyKey, metadata },
  };
}

export async function POST(req: Request) {
  // 1. Guards: origin + rate limit.
  try {
    enforceOrigin(req);
    await enforceReadRateLimit(getRequestIp(req));
  } catch (e) {
    log.warn("guard_failed", { reason: (e as Error)?.message });
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // 2. Parse JSON.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  // 3-8. Validation + sanitisation pipeline.
  const parsed = parseAndValidate(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { wallet, amount, target, targetId, idempotencyKey, metadata } =
    parsed.value;

  // 9. Supabase service-role client.
  const supabase = getSupabaseServer();
  if (!supabase) {
    log.error("supabase_unavailable", { wallet, target });
    return NextResponse.json({ error: "ledger_unavailable" }, { status: 500 });
  }

  // 10. Attestation hash — deterministic SHA-256 over the canonical
  //     economic payload. event_type="spend", source=target.
  const today = todayUtcDate();
  const attestationHash = buildAttestationHash({
    wallet,
    event_type: "spend",
    amount,
    source: target,
    source_id: targetId,
    day_utc: today,
    idempotency_key: idempotencyKey,
  });

  // 10b. Sprint 4 commit G — PRO bypass resolution. The client NEVER
  //      decides bypass; we evaluate exclusively server-side. Most
  //      users are free → `resolveProBypass` short-circuits on the
  //      isProActive Redis read without touching Supabase.
  const bypassEvaluation = await resolveProBypass(wallet, target, today);
  const applyProBypass = bypassEvaluation.apply;

  // 11. RPC with server-resolved bypass flag.
  const { data: rpcRows, error: rpcError } = await supabase.rpc(
    "peones_spend",
    {
      p_wallet: wallet,
      p_amount: amount,
      p_target: target,
      p_target_id: targetId,
      p_idempotency_key: idempotencyKey,
      p_attestation_hash: attestationHash,
      p_metadata: metadata,
      p_apply_pro_bypass: applyProBypass,
    },
  );

  // 12-13. Error mapping.
  if (rpcError) {
    // P0001 + the literal message 'insufficient_balance' both signal
    // the same condition; PostgREST may surface either depending on
    // how the exception is serialised.
    if (
      rpcError.code === "P0001" ||
      (typeof rpcError.message === "string" &&
        rpcError.message.toLowerCase().includes("insufficient_balance"))
    ) {
      return NextResponse.json(
        { error: "insufficient_balance" },
        { status: 409 },
      );
    }
    log.error("rpc_failed", {
      wallet,
      target,
      code: rpcError.code,
      message: rpcError.message,
    });
    return NextResponse.json(
      { error: "ledger_write_failed" },
      { status: 500 },
    );
  }

  // 14. Map RPC row → response.
  const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
  if (!row) {
    log.error("rpc_empty_row", { wallet, target });
    return NextResponse.json(
      { error: "ledger_write_failed" },
      { status: 500 },
    );
  }

  // Sprint 4 commit M.1 — server-side observability for duplicate
  // idempotent hits. NOT an error: the RPC retry contract guarantees
  // idempotent re-reads succeed even when the current balance no
  // longer reaches. Logged at `info` level so ops can monitor
  // duplicate frequency (e.g. retry storms, surface bugs that
  // re-call spend on every render) without alerting on errors.
  if (row.duplicate) {
    log.info("peones_spend_duplicate_hit", {
      wallet,
      target,
      target_id: targetId,
      ledger_id: row.ledger_id,
    });
  }

  // Sprint 4 commit G — surface quota info for telemetry.
  //   - quotaLimit: hard cap for this target (Infinity for save_game)
  //   - quotaUsed: rows consumed today AFTER this call. When bypass
  //     was applied, this is `quotaUsedBefore + 1`. When bypass did
  //     not apply, it's unchanged from the pre-evaluation count.
  //     `null` when not applicable (free user) or lookup failed.
  let quotaLimit: number | null = null;
  let quotaUsed: number | null = null;
  if (bypassEvaluation.proActive) {
    quotaLimit = Number.isFinite(bypassEvaluation.quotaLimit)
      ? bypassEvaluation.quotaLimit
      : null;
    if (bypassEvaluation.apply) {
      quotaUsed = bypassEvaluation.quotaUsedBefore + 1;
    } else if (bypassEvaluation.reason === "quota_exhausted") {
      quotaUsed = bypassEvaluation.quotaUsedBefore;
    }
  }

  return NextResponse.json({
    wallet,
    target,
    targetId,
    requested: amount,
    debited: Number(row.debited ?? 0),
    newBalance: Number(row.new_balance ?? 0),
    attestationHash,
    ledgerId: row.ledger_id ?? null,
    duplicate: Boolean(row.duplicate),
    proBypassApplied: Boolean(row.pro_bypass_applied),
    quotaUsed,
    quotaLimit,
  });
}
