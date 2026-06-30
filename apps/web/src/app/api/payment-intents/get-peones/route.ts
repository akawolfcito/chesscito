import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { createPublicClient, erc20Abi, http, isAddress } from "viem";
import { celo } from "viem/chains";

import { chesscitoTreasuryAbi } from "@/lib/contracts/treasury";
import {
  GET_PEONES_CANARY_AUTH_BINDING,
  GET_PEONES_CANARY_SKU,
  getCanaryExpectedAmount,
  getCanaryTokenByAddress,
  type GetPeonesCanaryIntent,
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

function error(reason: string, status: number) {
  return NextResponse.json({ ok: false, error: reason }, { status });
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
  } catch (cause) {
    log.error("canary_config_chain_read_failed", { reason: String(cause) });
    return error("canary_config_unverifiable", 503);
  }

  const supabase = getSupabaseServer();
  if (!supabase) return error("intent_store_unavailable", 503);

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

/** Minimal server-side observability seam for a provider response whose
 * broadcast state is unknown. It never mutates the immutable intent. */
export async function PATCH(req: Request) {
  try {
    enforceOrigin(req);
    await enforceReadRateLimit(getRequestIp(req));
    const body = await req.json();
    if (!isObject(body) || typeof body.intentId !== "string" ||
      body.event !== "unknown_submission_state") {
      return error("invalid_input", 400);
    }
    if (!/^[0-9a-f-]{36}$/i.test(body.intentId)) return error("invalid_input", 400);
    const supabase = getSupabaseServer();
    if (!supabase) return error("intent_store_unavailable", 503);
    const { data: intent, error: lookupError } = await supabase
      .from("treasury_payment_intents")
      .select("id")
      .eq("id", body.intentId)
      .maybeSingle();
    if (lookupError) return error("intent_store_unavailable", 503);
    if (!intent) return error("intent_not_found", 404);
    log.warn("unknown_submission_state", { intent_id: body.intentId });
    return NextResponse.json({ ok: true });
  } catch {
    return error("rate_limited", 429);
  }
}
