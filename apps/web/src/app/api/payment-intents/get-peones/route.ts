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

  const { data: createdRows, error: createError } = await supabase.rpc(
    "create_get_peones_intent",
    {
      p_id: intent.id,
      p_wallet: intent.wallet,
      p_sku: intent.sku,
      p_token_address: intent.token.toLowerCase(),
      p_token_symbol: intent.tokenSymbol,
      p_token_decimals: intent.tokenDecimals,
      p_expected_amount: intent.expectedAmount,
      p_chain_id: intent.chainId,
      p_treasury_address: intent.treasury.toLowerCase(),
      p_config_version: intent.configVersion,
      p_price_version: intent.priceVersion,
      p_required_confirmations: intent.requiredConfirmations,
      p_auth_binding: intent.authBinding,
      p_expires_at: intent.expiresAt,
    },
  );
  if (createError || !Array.isArray(createdRows) || createdRows.length !== 1) {
    log.error("intent_store_failed", { code: createError?.code ?? "INVALID_RPC_RESULT" });
    return error("intent_store_unavailable", 503);
  }

  const createdRow = createdRows[0] as {
    intent?: Record<string, unknown>;
    created?: boolean;
  };
  const stored = createdRow.intent;
  if (!stored || typeof stored.id !== "string") {
    log.error("intent_store_failed", { code: "INVALID_RPC_INTENT" });
    return error("intent_store_unavailable", 503);
  }
  const storedLifecycle = stored.lifecycle_status as GetPeonesIntentLifecycle;
  if (storedLifecycle === "SUBMITTING" || storedLifecycle === "SUBMITTED") {
    return NextResponse.json({
      ok: false,
      error: "unresolved_submission_state",
      intentId: stored.id,
      lifecycle: storedLifecycle,
      txHash: stored.tx_hash ?? null,
      recoverable: true,
      retrySafe: false,
    }, { status: 409 });
  }
  if (storedLifecycle !== "CREATED") {
    return error("intent_store_unavailable", 503);
  }
  const returnedIntent: GetPeonesCanaryIntent = {
    id: stored.id,
    wallet: stored.wallet as `0x${string}`,
    sku: stored.sku as typeof GET_PEONES_CANARY_SKU,
    token: stored.token_address as `0x${string}`,
    tokenSymbol: String(stored.token_symbol),
    tokenDecimals: Number(stored.token_decimals),
    expectedAmount: String(stored.expected_amount),
    chainId: Number(stored.chain_id) as 42220,
    treasury: stored.treasury_address as `0x${string}`,
    configVersion: String(stored.config_version),
    priceVersion: String(stored.price_version),
    requiredConfirmations: Number(stored.required_confirmations),
    expiresAt: String(stored.expires_at),
    authBinding: String(stored.auth_binding) as "client_asserted_wallet",
    lifecycle: storedLifecycle,
    txHash: (stored.tx_hash as `0x${string}` | null) ?? null,
    providerResultKind: (stored.provider_result_kind as GetPeonesProviderResultKind | null) ?? null,
    lastErrorCode: (stored.last_error_code as string | null) ?? null,
    recoverable: Boolean(stored.recoverable),
    retrySafe: Boolean(stored.retry_safe),
  };

  log.info("intent_created", {
    intent_id: returnedIntent.id,
    wallet_hash: hashWallet(wallet),
    sku: returnedIntent.sku,
    chain_id: returnedIntent.chainId,
    config_version: returnedIntent.configVersion,
    reused: createdRow.created === false,
  });
  return NextResponse.json({ ok: true, intent: returnedIntent });
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
