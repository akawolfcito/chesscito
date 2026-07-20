import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { createPublicClient, erc20Abi, http, isAddress } from "viem";
import { celo } from "viem/chains";

import { chesscitoTreasuryAbi } from "@/lib/contracts/treasury";
import {
  GET_PEONES_CANARY_AUTH_BINDING,
  GET_PEONES_CANARY_SKU,
  GET_PEONES_PROVIDER_RESULT_KINDS,
  getCanaryExpectedAmount,
  getCanaryTokenByAddress,
  type GetPeonesCanaryIntent,
  type GetPeonesIntentLifecycle,
  type GetPeonesProviderResultKind,
  type GetPeonesSubmissionReport,
} from "@/lib/payments/get-peones-canary";
import {
  isGetPeonesCanaryServerEnabled,
  isTokenAllowedByCanaryConfig,
  resolveGetPeonesCanaryServerConfig,
} from "@/lib/payments/get-peones-canary-server";
import { enforceOrigin, enforceReadRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import { createLogger, hashWallet } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

const log = createLogger({ route: "/api/payment-intents/get-peones" });
const client = createPublicClient({ chain: celo, transport: http(process.env.CELO_RPC_URL) });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const SAFE_ERROR_CODE_RE = /^[A-Za-z0-9_.:-]{1,64}$/;

function error(reason: string, status: number) {
  return NextResponse.json({ ok: false, error: reason }, { status });
}

function submissionError(args: {
  error: "INVALID_SUBMISSION_STATE" | "UNKNOWN_SUBMISSION_STATE";
  status: number;
  intentId?: string;
  lifecycle?: GetPeonesIntentLifecycle;
  recoverable: boolean;
  retrySafe?: boolean;
}) {
  return NextResponse.json({
    ok: false,
    error: args.error,
    intentId: args.intentId,
    lifecycle: args.lifecycle,
    recoverable: args.recoverable,
    retrySafe: args.retrySafe,
  }, { status: args.status });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(req: Request) {
  try {
    enforceOrigin(req);
    await enforceReadRateLimit(getRequestIp(req));
  } catch {
    return error("rate_limited", 429);
  }

  if (!isGetPeonesCanaryServerEnabled()) return error("canary_disabled", 404);
  const resolved = resolveGetPeonesCanaryServerConfig();
  if (!resolved.ok) {
    log.warn(resolved.reason);
    return error(resolved.reason, 503);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("invalid_input", 400);
  }
  if (!isObject(body)) return error("invalid_input", 400);

  const wallet = typeof body.wallet === "string" ? body.wallet.toLowerCase() : "";
  const tokenAddress = typeof body.token === "string" ? body.token.toLowerCase() : "";
  const sku = body.sku;
  if (body.chainId !== resolved.config.chainId) {
    log.warn("wrong_chain", { requested_chain: body.chainId as number });
    return error("wrong_chain", 400);
  }
  if (!isAddress(wallet) || !isAddress(tokenAddress) || sku !== GET_PEONES_CANARY_SKU) {
    return error("invalid_input", 400);
  }

  const token = getCanaryTokenByAddress(tokenAddress);
  if (!token || !isTokenAllowedByCanaryConfig(resolved.config, token.address)) {
    log.warn("wrong_token", { wallet_hash: hashWallet(wallet) });
    return error("wrong_token", 400);
  }

  try {
    const [bytecode, accepted, onchainDecimals] = await Promise.all([
      client.getBytecode({ address: resolved.config.treasury }),
      client.readContract({
        address: resolved.config.treasury,
        abi: chesscitoTreasuryAbi,
        functionName: "acceptedToken",
        args: [token.address],
      }),
      client.readContract({
        address: token.address,
        abi: erc20Abi,
        functionName: "decimals",
      }),
    ]);
    if (!bytecode || bytecode === "0x") return error("canary_treasury_not_contract", 503);
    if (accepted !== true) return error("wrong_token", 400);
    if (Number(onchainDecimals) !== token.decimals) return error("token_decimals_mismatch", 503);
  } catch {
    log.error("canary_config_chain_read_failed", { error_code: "CHAIN_READ_FAILED" });
    return error("canary_config_unverifiable", 503);
  }

  const supabase = getSupabaseServer();
  if (!supabase) return error("intent_store_unavailable", 503);

  // A browser reload must not erase an ambiguous/submitted payment lock. Reuse
  // the persisted recovery record instead of issuing a fresh intent that could
  // prompt a second transfer for the same wallet/SKU/token.
  const { data: unresolvedIntent, error: unresolvedLookupError } = await supabase
    .from("treasury_payment_intents")
    .select("id,lifecycle_status,tx_hash")
    .eq("wallet", wallet)
    .eq("sku", GET_PEONES_CANARY_SKU)
    .in("lifecycle_status", ["SUBMITTING", "SUBMITTED"])
    .eq("retry_safe", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (unresolvedLookupError) return error("intent_store_unavailable", 503);
  if (unresolvedIntent) {
    return NextResponse.json({
      ok: false,
      error: "unresolved_submission_state",
      intentId: unresolvedIntent.id,
      lifecycle: unresolvedIntent.lifecycle_status,
      txHash: unresolvedIntent.tx_hash,
      recoverable: true,
      retrySafe: false,
    }, { status: 409 });
  }

  const id = randomUUID();
  const expiresAt = new Date(Date.now() + resolved.config.intentTtlSeconds * 1000).toISOString();
  const expectedAmount = getCanaryExpectedAmount(token.decimals);
  const intent: GetPeonesCanaryIntent = {
    id,
    wallet: wallet as `0x${string}`,
    sku: GET_PEONES_CANARY_SKU,
    token: token.address,
    tokenSymbol: token.symbol,
    tokenDecimals: token.decimals,
    expectedAmount: expectedAmount.toString(),
    chainId: resolved.config.chainId,
    treasury: resolved.config.treasury,
    configVersion: resolved.config.configVersion,
    priceVersion: resolved.config.priceVersion,
    requiredConfirmations: resolved.config.requiredConfirmations,
    expiresAt,
    authBinding: GET_PEONES_CANARY_AUTH_BINDING,
    lifecycle: "CREATED",
    txHash: null,
    providerResultKind: null,
    lastErrorCode: null,
    recoverable: true,
    retrySafe: true,
  };

  const { error: insertError } = await supabase.from("treasury_payment_intents").insert({
    id: intent.id,
    wallet: intent.wallet,
    sku: intent.sku,
    token_address: intent.token.toLowerCase(),
    token_symbol: intent.tokenSymbol,
    token_decimals: intent.tokenDecimals,
    expected_amount: intent.expectedAmount,
    chain_id: intent.chainId,
    treasury_address: intent.treasury.toLowerCase(),
    config_version: intent.configVersion,
    price_version: intent.priceVersion,
    required_confirmations: intent.requiredConfirmations,
    auth_binding: intent.authBinding,
    expires_at: intent.expiresAt,
    lifecycle_status: intent.lifecycle,
    tx_hash: intent.txHash,
    provider_result_kind: intent.providerResultKind,
    last_error_code: intent.lastErrorCode,
    recoverable: intent.recoverable,
    retry_safe: intent.retrySafe,
  });
  if (insertError) {
    log.error("intent_store_failed", { code: insertError.code });
    return error("intent_store_unavailable", 503);
  }

  log.info("intent_created", {
    intent_id: intent.id,
    wallet_hash: hashWallet(wallet),
    sku: intent.sku,
    chain_id: intent.chainId,
    config_version: intent.configVersion,
  });
  return NextResponse.json({ ok: true, intent });
}

type SubmissionIntentRow = {
  id: string;
  lifecycle_status: GetPeonesIntentLifecycle | null;
  tx_hash: string | null;
};

function parseSubmissionReport(body: unknown): GetPeonesSubmissionReport | null {
  if (!isObject(body) || typeof body.intentId !== "string" ||
    !UUID_RE.test(body.intentId)) return null;
  if (body.event === "unknown_submission_state" && body.submissionState === undefined) {
    return {
      intentId: body.intentId,
      submissionState: "SUBMITTING",
      providerResultKind: "AMBIGUOUS_ERROR",
      errorCode: "LEGACY_UNKNOWN_SUBMISSION_STATE",
    };
  }
  if (typeof body.submissionState !== "string" ||
    typeof body.providerResultKind !== "string" ||
    !GET_PEONES_PROVIDER_RESULT_KINDS.includes(
      body.providerResultKind as GetPeonesProviderResultKind,
    )) return null;

  const txHash = typeof body.txHash === "string" ? body.txHash.toLowerCase() : undefined;
  const errorCode = typeof body.errorCode === "string" ? body.errorCode : undefined;
  if (txHash !== undefined && !TX_HASH_RE.test(txHash)) return null;
  if (errorCode !== undefined && !SAFE_ERROR_CODE_RE.test(errorCode)) return null;

  const common = {
    intentId: body.intentId,
    txHash: txHash as `0x${string}` | undefined,
    errorCode,
  };
  if (body.submissionState === "SUBMITTING" &&
    ["WALLET_REQUESTED", "AMBIGUOUS_ERROR", "UNEXPECTED_RESULT"].includes(
      body.providerResultKind,
    ) && txHash === undefined &&
    (body.providerResultKind === "WALLET_REQUESTED" || errorCode !== undefined)) {
    return { ...common, submissionState: "SUBMITTING", providerResultKind: body.providerResultKind as "WALLET_REQUESTED" | "AMBIGUOUS_ERROR" | "UNEXPECTED_RESULT" };
  }
  if (body.submissionState === "SUBMITTED" &&
    body.providerResultKind === "TRANSACTION_HASH" && txHash !== undefined &&
    errorCode === undefined) {
    return {
      ...common,
      submissionState: "SUBMITTED",
      providerResultKind: "TRANSACTION_HASH",
      txHash: txHash as `0x${string}`,
    };
  }
  if (body.submissionState === "CANCELLED" &&
    body.providerResultKind === "USER_CANCELLED" && txHash === undefined &&
    errorCode !== undefined) {
    return { ...common, submissionState: "CANCELLED", providerResultKind: "USER_CANCELLED" };
  }
  if (body.submissionState === "FAILED" &&
    body.providerResultKind === "PRE_BROADCAST_FAILURE" && txHash === undefined &&
    errorCode !== undefined) {
    return { ...common, submissionState: "FAILED", providerResultKind: "PRE_BROADCAST_FAILURE" };
  }
  return null;
}

const CLIENT_TRANSITIONS: Record<
  GetPeonesIntentLifecycle,
  ReadonlySet<GetPeonesSubmissionReport["submissionState"]>
> = {
  CREATED: new Set(["SUBMITTING", "CANCELLED", "FAILED"]),
  SUBMITTING: new Set(["SUBMITTING", "SUBMITTED", "CANCELLED", "FAILED"]),
  SUBMITTED: new Set(["SUBMITTED"]),
  CONFIRMED: new Set(),
  CANCELLED: new Set(["CANCELLED"]),
  FAILED: new Set(["FAILED"]),
  EXPIRED: new Set(),
  REVERTED: new Set(),
};

/** Persist client submission evidence without treating it as payment proof. */
export async function PATCH(req: Request) {
  try {
    enforceOrigin(req);
    await enforceReadRateLimit(getRequestIp(req));
    const body = await req.json();
    const report = parseSubmissionReport(body);
    if (!report) {
      const intentId = isObject(body) && typeof body.intentId === "string"
        ? body.intentId
        : undefined;
      return submissionError({
        error: "INVALID_SUBMISSION_STATE",
        status: 400,
        intentId,
        recoverable: true,
      });
    }
    const supabase = getSupabaseServer();
    if (!supabase) return error("intent_store_unavailable", 503);
    const { data: intent, error: lookupError } = await supabase
      .from("treasury_payment_intents")
      .select("id,lifecycle_status,tx_hash")
      .eq("id", report.intentId)
      .maybeSingle();
    if (lookupError) return error("intent_store_unavailable", 503);
    if (!intent) return error("intent_not_found", 404);

    const row = intent as SubmissionIntentRow;
    const current = row.lifecycle_status ?? "CREATED";
    const sameConfirmedHash = current === "CONFIRMED" &&
      report.submissionState === "SUBMITTED" &&
      row.tx_hash === report.txHash;
    if (!CLIENT_TRANSITIONS[current].has(report.submissionState) && !sameConfirmedHash) {
      return submissionError({
        error: "INVALID_SUBMISSION_STATE",
        status: 409,
        intentId: report.intentId,
        lifecycle: current,
        recoverable: current === "SUBMITTING" || current === "SUBMITTED",
        retrySafe: false,
      });
    }
    if (row.tx_hash && report.txHash && row.tx_hash !== report.txHash) {
      return submissionError({
        error: "INVALID_SUBMISSION_STATE",
        status: 409,
        intentId: report.intentId,
        lifecycle: current,
        recoverable: false,
        retrySafe: false,
      });
    }
    if (sameConfirmedHash) {
      return NextResponse.json({
        ok: true,
        intentId: report.intentId,
        lifecycle: current,
        recoverable: false,
        retrySafe: false,
      });
    }

    const ambiguous = report.submissionState === "SUBMITTING" &&
      report.providerResultKind !== "WALLET_REQUESTED";
    const recoverable = true;
    const retrySafe = report.submissionState === "CANCELLED" ||
      report.submissionState === "FAILED";
    const { error: updateError } = await supabase
      .from("treasury_payment_intents")
      .update({
        lifecycle_status: report.submissionState,
        tx_hash: report.txHash ?? row.tx_hash,
        provider_result_kind: report.providerResultKind,
        last_error_code: report.errorCode ?? null,
        recoverable,
        retry_safe: retrySafe,
        lifecycle_updated_at: new Date().toISOString(),
      })
      .eq("id", report.intentId);
    if (updateError) return error("intent_store_unavailable", 503);

    const fields = {
      intent_id: report.intentId,
      current_intent_status: report.submissionState,
      received_submission_state: report.submissionState,
      has_tx_hash: Boolean(report.txHash ?? row.tx_hash),
      provider_result_kind: report.providerResultKind,
      error_code: report.errorCode ?? null,
      recoverable,
      retry_safe: retrySafe,
    };
    if (ambiguous) {
      log.warn("unknown_submission_state", fields);
      return submissionError({
        error: "UNKNOWN_SUBMISSION_STATE",
        status: 409,
        intentId: report.intentId,
        lifecycle: "SUBMITTING",
        recoverable: true,
        retrySafe: false,
      });
    }
    log.info("submission_state_recorded", fields);
    return NextResponse.json({
      ok: true,
      intentId: report.intentId,
      lifecycle: report.submissionState,
      recoverable,
      retrySafe,
    });
  } catch (cause) {
    if (cause instanceof SyntaxError) {
      return submissionError({
        error: "INVALID_SUBMISSION_STATE",
        status: 400,
        recoverable: true,
      });
    }
    return error("rate_limited", 429);
  }
}
