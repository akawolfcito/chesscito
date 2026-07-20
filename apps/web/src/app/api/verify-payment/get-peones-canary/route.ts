import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";

import {
  GET_PEONES_CANARY_AUTH_BINDING,
  GET_PEONES_CANARY_CHAIN_ID,
  GET_PEONES_CANARY_REWARD,
  GET_PEONES_CANARY_SKU,
  type GetPeonesCanaryIntent,
  type GetPeonesIntentLifecycle,
  type GetPeonesProviderResultKind,
} from "@/lib/payments/get-peones-canary";
import {
  verifyCanaryTransaction,
  verifyCanaryTransferEvent,
} from "@/lib/payments/get-peones-canary-verifier";
import { normalizeWallet } from "@/lib/peones/ledger-service";
import { buildAttestationHash } from "@/lib/peones/ledger-service-server";
import { enforceOrigin, enforceReadRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import { createLogger, hashWallet } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

const log = createLogger({ route: "/api/verify-payment/get-peones-canary" });
const client = createPublicClient({ chain: celo, transport: http(process.env.CELO_RPC_URL) });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

function error(reason: string, status: number) {
  log.warn(reason);
  return NextResponse.json({ ok: false, error: reason }, { status });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type IntentRow = {
  id: string;
  wallet: string;
  sku: string;
  token_address: string;
  token_symbol: string;
  token_decimals: number;
  expected_amount: string | number;
  chain_id: number;
  treasury_address: string;
  config_version: string;
  price_version: string;
  required_confirmations: number;
  auth_binding: string;
  expires_at: string;
  lifecycle_status: GetPeonesIntentLifecycle | null;
  tx_hash: string | null;
  provider_result_kind: GetPeonesProviderResultKind | null;
  last_error_code: string | null;
  recoverable: boolean | null;
  retry_safe: boolean | null;
};

function toIntent(row: IntentRow): GetPeonesCanaryIntent | null {
  if (
    row.sku !== GET_PEONES_CANARY_SKU ||
    row.chain_id !== GET_PEONES_CANARY_CHAIN_ID ||
    row.auth_binding !== GET_PEONES_CANARY_AUTH_BINDING
  ) return null;
  return {
    id: row.id,
    wallet: row.wallet as `0x${string}`,
    sku: GET_PEONES_CANARY_SKU,
    token: row.token_address as `0x${string}`,
    tokenSymbol: row.token_symbol,
    tokenDecimals: row.token_decimals,
    expectedAmount: String(row.expected_amount),
    chainId: GET_PEONES_CANARY_CHAIN_ID,
    treasury: row.treasury_address as `0x${string}`,
    configVersion: row.config_version,
    priceVersion: row.price_version,
    requiredConfirmations: row.required_confirmations,
    expiresAt: row.expires_at,
    authBinding: GET_PEONES_CANARY_AUTH_BINDING,
    lifecycle: row.lifecycle_status ?? "CREATED",
    txHash: row.tx_hash as `0x${string}` | null,
    providerResultKind: row.provider_result_kind,
    lastErrorCode: row.last_error_code,
    recoverable: row.recoverable ?? true,
    retrySafe: row.retry_safe ?? true,
  };
}

type SupabaseClient = NonNullable<ReturnType<typeof getSupabaseServer>>;

async function persistLifecycle(
  supabase: SupabaseClient,
  intentId: string,
  lifecycle: GetPeonesIntentLifecycle,
  values: {
    txHash?: string;
    providerResultKind?: GetPeonesProviderResultKind;
    errorCode?: string | null;
    recoverable: boolean;
    retrySafe: boolean;
  },
): Promise<boolean> {
  const { error: updateError } = await supabase
    .from("treasury_payment_intents")
    .update({
      lifecycle_status: lifecycle,
      ...(values.txHash ? { tx_hash: values.txHash.toLowerCase() } : {}),
      ...(values.providerResultKind
        ? { provider_result_kind: values.providerResultKind }
        : {}),
      last_error_code: values.errorCode ?? null,
      recoverable: values.recoverable,
      retry_safe: values.retrySafe,
      lifecycle_updated_at: new Date().toISOString(),
    })
    .eq("id", intentId);
  if (updateError) {
    log.warn("intent_lifecycle_store_failed", {
      intent_id: intentId,
      current_intent_status: lifecycle,
      has_tx_hash: Boolean(values.txHash),
      error_code: updateError.code,
      recoverable: true,
    });
    return false;
  }
  return true;
}

export async function POST(req: Request) {
  try {
    enforceOrigin(req);
    await enforceReadRateLimit(getRequestIp(req));
  } catch {
    return error("rate_limited", 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("invalid_input", 400);
  }
  if (!isObject(body)) return error("invalid_input", 400);
  const intentId = typeof body.intentId === "string" ? body.intentId : "";
  const txHash = typeof body.txHash === "string" ? body.txHash.toLowerCase() : "";
  const requestedLogIndex = body.logIndex;
  if (
    !UUID_RE.test(intentId) ||
    !TX_HASH_RE.test(txHash) ||
    (requestedLogIndex !== undefined &&
      (!Number.isInteger(requestedLogIndex) || Number(requestedLogIndex) < 0))
  ) return error("invalid_input", 400);

  const supabase = getSupabaseServer();
  if (!supabase) return error("intent_store_unavailable", 503);
  const { data, error: lookupError } = await supabase
    .from("treasury_payment_intents")
    .select("id,wallet,sku,token_address,token_symbol,token_decimals,expected_amount,chain_id,treasury_address,config_version,price_version,required_confirmations,auth_binding,expires_at,lifecycle_status,tx_hash,provider_result_kind,last_error_code,recoverable,retry_safe")
    .eq("id", intentId)
    .maybeSingle();
  if (lookupError) return error("intent_store_unavailable", 503);
  const intent = data ? toIntent(data as IntentRow) : null;
  if (!intent) return error("intent_not_found", 404);
  const lifecycle = intent.lifecycle ?? "CREATED";
  if (lifecycle === "CONFIRMED" && intent.txHash && intent.txHash !== txHash) {
    return error("intent_tx_hash_mismatch", 409);
  }
  if (["REVERTED", "EXPIRED"].includes(lifecycle)) {
    return error(lifecycle === "REVERTED" ? "receipt_reverted" : "expired_intent", 409);
  }
  log.info("verification_started", {
    intent_id: intent.id,
    current_intent_status: lifecycle,
    has_tx_hash: true,
    recoverable: true,
  });

  let transaction: Awaited<ReturnType<typeof client.getTransaction>>;
  let receipt: Awaited<ReturnType<typeof client.getTransactionReceipt>>;
  try {
    [transaction, receipt] = await Promise.all([
      client.getTransaction({ hash: txHash as `0x${string}` }),
      client.getTransactionReceipt({ hash: txHash as `0x${string}` }),
    ]);
  } catch {
    return error("receipt_not_found", 400);
  }

  const txVerdict = verifyCanaryTransaction(
    { to: transaction.to, from: transaction.from, input: transaction.input },
    intent,
  );
  if (!txVerdict.ok) return error(txVerdict.reason, 400);

  // Only canonical transaction evidence may make a hash authoritative. A
  // client-reported candidate can be replaced here while the intent remains
  // unresolved, preventing a typo or stale provider hash from poisoning it.
  if (lifecycle !== "CONFIRMED") {
    const captured = await persistLifecycle(supabase, intent.id, "SUBMITTED", {
      txHash,
      providerResultKind: "TRANSACTION_HASH",
      recoverable: true,
      retrySafe: false,
    });
    if (!captured) return error("intent_store_unavailable", 503);
  }
  if (receipt.status !== "success") {
    const revertedStored = await persistLifecycle(supabase, intent.id, "REVERTED", {
      txHash,
      providerResultKind: "TRANSACTION_HASH",
      errorCode: "RECEIPT_REVERTED",
      recoverable: false,
      retrySafe: false,
    });
    if (!revertedStored) return error("intent_store_unavailable", 503);
    return error("receipt_reverted", 400);
  }

  let latestBlock: bigint;
  let minedBlock: Awaited<ReturnType<typeof client.getBlock>>;
  try {
    [latestBlock, minedBlock] = await Promise.all([
      client.getBlockNumber(),
      client.getBlock({ blockNumber: receipt.blockNumber }),
    ]);
  } catch {
    await persistLifecycle(supabase, intent.id, "SUBMITTED", {
      txHash,
      providerResultKind: "TRANSACTION_HASH",
      errorCode: "FINALITY_PENDING",
      recoverable: true,
      retrySafe: false,
    });
    return error("finality_pending", 409);
  }
  const confirmations = latestBlock >= receipt.blockNumber
    ? Number(latestBlock - receipt.blockNumber + 1n)
    : 0;
  if (confirmations < intent.requiredConfirmations) {
    await persistLifecycle(supabase, intent.id, "SUBMITTED", {
      txHash,
      providerResultKind: "TRANSACTION_HASH",
      errorCode: "FINALITY_PENDING",
      recoverable: true,
      retrySafe: false,
    });
    return error("finality_pending", 409);
  }

  const minedAt = new Date(Number(minedBlock.timestamp) * 1000);
  if (minedAt.getTime() > new Date(intent.expiresAt).getTime()) {
    const expirationStored = await persistLifecycle(supabase, intent.id, "EXPIRED", {
      txHash,
      providerResultKind: "TRANSACTION_HASH",
      errorCode: "EXPIRED_INTENT",
      recoverable: false,
      retrySafe: false,
    });
    if (!expirationStored) return error("intent_store_unavailable", 503);
    return error("expired_intent", 400);
  }

  const eventVerdict = verifyCanaryTransferEvent({
    logs: receipt.logs.map((entry) => ({
      address: entry.address,
      topics: entry.topics,
      data: entry.data,
      logIndex: entry.logIndex,
    })),
    intent,
    requestedLogIndex: requestedLogIndex as number | undefined,
  });
  if (!eventVerdict.ok) return error(eventVerdict.reason, 400);

  log.info("payment_verified", {
    intent_id: intent.id,
    chain_id: intent.chainId,
    has_tx_hash: true,
    log_index: eventVerdict.logIndex,
    wallet_hash: hashWallet(intent.wallet),
  });

  const dayUtc = minedAt.toISOString().slice(0, 10);
  const globalLedgerKey = `treasury:${intent.chainId}:${txHash}:${eventVerdict.logIndex}`;
  const attestationHash = buildAttestationHash({
    wallet: intent.wallet,
    event_type: "earn",
    amount: GET_PEONES_CANARY_REWARD,
    source: "pack_purchase",
    source_id: intent.sku,
    day_utc: dayUtc,
    idempotency_key: globalLedgerKey,
  });

  const { data: settlement, error: settlementError } = await supabase.rpc(
    "consume_get_peones_treasury_payment",
    {
      p_intent_id: intent.id,
      p_chain_id: intent.chainId,
      p_tx_hash: txHash,
      p_log_index: eventVerdict.logIndex,
      p_wallet: normalizeWallet(intent.wallet),
      p_token_address: intent.token.toLowerCase(),
      p_treasury_address: intent.treasury.toLowerCase(),
      p_amount_paid: eventVerdict.amount.toString(),
      p_tx_mined_at: minedAt.toISOString(),
      p_attestation_hash: attestationHash,
      p_day_utc: dayUtc,
      p_metadata: {
        rail: "chesscito_treasury_canary",
        intentId: intent.id,
        configVersion: intent.configVersion,
        priceVersion: intent.priceVersion,
        chainId: intent.chainId,
        txHash,
        logIndex: eventVerdict.logIndex,
        token: intent.token,
        treasury: intent.treasury,
        amountPaid: eventVerdict.amount.toString(),
        expectedAmount: intent.expectedAmount,
        overpaid: eventVerdict.overpaid,
      },
    },
  );

  if (settlementError) {
    const replay = String(settlementError.message).includes("payment_replay");
    await persistLifecycle(supabase, intent.id, "SUBMITTED", {
      txHash,
      providerResultKind: "TRANSACTION_HASH",
      errorCode: replay ? "PAYMENT_REPLAY" : "ENTITLEMENT_FAILED",
      recoverable: !replay,
      retrySafe: false,
    });
    log.warn(replay ? "replay_rejected" : "entitlement_failed_recoverable", {
      intent_id: intent.id,
      code: settlementError.code,
    });
    return error(replay ? "replay_rejected" : "entitlement_failed_recoverable", replay ? 409 : 503);
  }

  const row = Array.isArray(settlement) ? settlement[0] : settlement;
  const duplicate = row?.outcome === "duplicate";
  const confirmationStored = await persistLifecycle(supabase, intent.id, "CONFIRMED", {
    txHash,
    providerResultKind: "TRANSACTION_HASH",
    recoverable: false,
    retrySafe: false,
  });
  if (!confirmationStored) return error("entitlement_failed_recoverable", 503);
  log.info("payment_consumed", { intent_id: intent.id, duplicate });
  log.info("peones_credited", { intent_id: intent.id, amount: GET_PEONES_CANARY_REWARD, duplicate });

  return NextResponse.json({
    ok: true,
    intentId: intent.id,
    txHash,
    logIndex: eventVerdict.logIndex,
    duplicate,
    peonesCredited: GET_PEONES_CANARY_REWARD,
    token: intent.token,
    amountPaid: eventVerdict.amount.toString(),
    overpaid: eventVerdict.overpaid,
    ledgerId: row?.ledger_id ?? null,
  });
}
