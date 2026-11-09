import { ACCEPTED_TOKENS, normalizePrice } from "@/lib/contracts/tokens";
import { getPeonesPack } from "@/lib/payments/rail-config";

export const GET_PEONES_CANARY_CHAIN_ID = 42220 as const;
export const GET_PEONES_CANARY_SKU = "peones_pack_50" as const;
export const GET_PEONES_CANARY_REWARD = 50 as const;
export const GET_PEONES_CANARY_INTENT_TTL_SECONDS = 10 * 60;

/**
 * The ONLY gate onto the treasury canary. Production pins this SKU three times
 * over — a CHECK constraint on `treasury_payment_intents`, a `wrong_sku` raise
 * inside `consume_get_peones_treasury_payment`, and a HARDCODED `50` in that
 * function's ledger insert. That third one is the dangerous one: a widened
 * canary would happily take $1.00 and credit 50 Peones. So flexible top-up
 * rides the legacy rail, and every flexible SKU must fail here — at intent
 * creation, before any transfer is requested, so the failure mode is "no
 * intent" and never "paid, not credited".
 */
export function isCanaryEligibleSku(sku: unknown): sku is typeof GET_PEONES_CANARY_SKU {
  return sku === GET_PEONES_CANARY_SKU;
}

/**
 * Current auth limitation: Get Peones has no SIWE/SIWC session. The intent
 * wallet is client-asserted, then cryptographically constrained by both the
 * canonical transaction sender and Transfer.from. This prevents redirecting
 * another payer's entitlement, but it is not strong account authentication.
 * The canary remains disabled unless the server explicitly acknowledges this.
 */
export const GET_PEONES_CANARY_AUTH_BINDING = "client_asserted_wallet" as const;

export const GET_PEONES_INTENT_LIFECYCLES = [
  "CREATED",
  "SUBMITTING",
  "SUBMITTED",
  "CONFIRMED",
  "CANCELLED",
  "FAILED",
  "EXPIRED",
  "REVERTED",
] as const;

export type GetPeonesIntentLifecycle = (typeof GET_PEONES_INTENT_LIFECYCLES)[number];

export const GET_PEONES_PROVIDER_RESULT_KINDS = [
  "WALLET_REQUESTED",
  "TRANSACTION_HASH",
  "USER_CANCELLED",
  "PRE_BROADCAST_FAILURE",
  "AMBIGUOUS_ERROR",
  "UNEXPECTED_RESULT",
] as const;

export type GetPeonesProviderResultKind =
  (typeof GET_PEONES_PROVIDER_RESULT_KINDS)[number];

export const GET_PEONES_SUBMISSION_STAGES = [
  "PREPARE",
  "SIMULATE",
  "WALLET_REQUEST",
  "BROADCAST",
  "HASH_RETURN",
] as const;

export type GetPeonesSubmissionStage =
  (typeof GET_PEONES_SUBMISSION_STAGES)[number];

export type GetPeonesProviderErrorDiagnostics = {
  name?: string;
  code?: string;
  shortMessage?: string;
  details?: string;
  causeName?: string;
  causeCode?: string;
  causeShortMessage?: string;
};

export type GetPeonesSubmissionDiagnostics = {
  stage: GetPeonesSubmissionStage;
  error?: GetPeonesProviderErrorDiagnostics;
  connectorId: string;
  walletClientKind: string;
  chainId: number;
  isMiniPay: boolean;
};

export type GetPeonesSubmissionReport = {
  intentId: string;
  submissionState: "SUBMITTING" | "SUBMITTED" | "CANCELLED" | "FAILED";
  txHash?: `0x${string}`;
  providerResultKind: GetPeonesProviderResultKind;
  errorCode?: string;
  diagnostics?: GetPeonesSubmissionDiagnostics;
};

export type GetPeonesSubmissionReportResponse =
  | {
      ok: true;
      intentId: string;
      lifecycle: GetPeonesIntentLifecycle;
      recoverable: boolean;
      retrySafe: boolean;
    }
  | {
      ok: false;
      error: "INVALID_SUBMISSION_STATE" | "UNKNOWN_SUBMISSION_STATE" | string;
      intentId?: string;
      lifecycle?: GetPeonesIntentLifecycle;
      recoverable: boolean;
      retrySafe?: boolean;
    };

export type GetPeonesProviderSubmissionOutcome =
  | {
      submissionState: "CANCELLED";
      providerResultKind: "USER_CANCELLED";
      errorCode: string;
      recoverable: true;
      retrySafe: true;
    }
  | {
      submissionState: "FAILED";
      providerResultKind: "PRE_BROADCAST_FAILURE";
      errorCode: string;
      recoverable: true;
      retrySafe: true;
    }
  | {
      submissionState: "SUBMITTING";
      providerResultKind: "AMBIGUOUS_ERROR" | "UNEXPECTED_RESULT";
      errorCode: string;
      recoverable: true;
      retrySafe: false;
    };

export type GetPeonesCanaryIntent = {
  id: string;
  wallet: `0x${string}`;
  sku: typeof GET_PEONES_CANARY_SKU;
  token: `0x${string}`;
  tokenSymbol: string;
  tokenDecimals: number;
  expectedAmount: string;
  chainId: typeof GET_PEONES_CANARY_CHAIN_ID;
  treasury: `0x${string}`;
  configVersion: string;
  priceVersion: string;
  requiredConfirmations: number;
  expiresAt: string;
  authBinding: typeof GET_PEONES_CANARY_AUTH_BINDING;
  lifecycle?: GetPeonesIntentLifecycle;
  txHash?: `0x${string}` | null;
  providerResultKind?: GetPeonesProviderResultKind | null;
  lastErrorCode?: string | null;
  recoverable?: boolean;
  retrySafe?: boolean;
};

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const SAFE_ERROR_CODE_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const LONG_HEX_RE = /0x[0-9a-fA-F]{10,}/g;
const DIAGNOSTIC_TEXT_LIMIT = 240;

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

function walkProviderError(error: unknown): Record<string, unknown>[] {
  const seen = new Set<object>();
  const queue: unknown[] = [error];
  const records: Record<string, unknown>[] = [];
  while (queue.length > 0 && records.length < 8) {
    const value = queue.shift();
    const record = asObject(value);
    if (!record || seen.has(record)) continue;
    seen.add(record);
    records.push(record);
    queue.push(record.cause, record.error, record.data, record.receipt);
  }
  return records;
}

function readProviderErrorCode(error: unknown): unknown {
  for (const record of walkProviderError(error)) {
    if (record.code !== undefined) return record.code;
  }
  return undefined;
}

function sanitizeProviderDiagnosticText(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  return value
    .replace(/\{\s*["']?jsonrpc[\s\S]*/i, "[redacted_provider_payload]")
    .replace(LONG_HEX_RE, "[redacted_hex]")
    .slice(0, DIAGNOSTIC_TEXT_LIMIT);
}

/** Keep only the explicitly allowlisted provider fields. Never serializes the
 * full error, calldata, wallet, signature, stack or raw provider payload. */
export function getProviderErrorDiagnostics(
  error: unknown,
): GetPeonesProviderErrorDiagnostics {
  const record = asObject(error);
  const cause = asObject(record?.cause);
  const code = readProviderErrorCode(error);
  return {
    name: sanitizeProviderDiagnosticText(record?.name),
    code: sanitizeProviderDiagnosticText(
      typeof code === "number" || typeof code === "string" ? String(code) : undefined,
    ),
    shortMessage: sanitizeProviderDiagnosticText(record?.shortMessage),
    details: sanitizeProviderDiagnosticText(record?.details),
    causeName: sanitizeProviderDiagnosticText(cause?.name),
    causeCode: sanitizeProviderDiagnosticText(
      typeof cause?.code === "number" || typeof cause?.code === "string"
        ? String(cause.code)
        : undefined,
    ),
    causeShortMessage: sanitizeProviderDiagnosticText(cause?.shortMessage),
  };
}

function providerErrorText(error: unknown): string {
  return walkProviderError(error)
    .flatMap((record) => [record.message, record.shortMessage, record.details])
    .filter((value): value is string => typeof value === "string")
    .join("\n");
}

export function normalizeProviderErrorCode(error: unknown, fallback: string): string {
  const raw = readProviderErrorCode(error);
  const candidate = typeof raw === "number" || typeof raw === "string"
    ? String(raw)
    : fallback;
  return SAFE_ERROR_CODE_RE.test(candidate) ? candidate : fallback;
}

export function isEip1193UserRejection(error: unknown): boolean {
  if (String(readProviderErrorCode(error)) === "4001") return true;
  if (walkProviderError(error).some((record) =>
    record.name === "UserRejectedRequestError" ||
    record.name === "UserRejectedTransactionError"
  )) return true;
  const message = error instanceof Error ? error.message : String(error);
  // Exact provider phrases observed from EIP-1193/viem and MiniPay. Avoid the
  // broad word "cancelled", which can describe a post-broadcast operation.
  return /User rejected (?:transaction|the (?:request|transaction))/i.test(message);
}

export function classifyProviderSubmissionError(
  error: unknown,
  stage: GetPeonesSubmissionStage = "WALLET_REQUEST",
): GetPeonesProviderSubmissionOutcome {
  if (stage === "PREPARE" || stage === "SIMULATE") {
    return {
      submissionState: "FAILED",
      providerResultKind: "PRE_BROADCAST_FAILURE",
      errorCode: stage === "PREPARE" ? "PREPARE_FAILED" : "SIMULATE_FAILED",
      recoverable: true,
      retrySafe: true,
    };
  }

  if (isEip1193UserRejection(error)) {
    return {
      submissionState: "CANCELLED",
      providerResultKind: "USER_CANCELLED",
      errorCode: normalizeProviderErrorCode(error, "USER_CANCELLED"),
      recoverable: true,
      retrySafe: true,
    };
  }

  const message = providerErrorText(error);
  if (/(?:Remote method ['"]eth_estimateGas['"]|Request eth_estimateGas) failed/i.test(message)) {
    return {
      submissionState: "FAILED",
      providerResultKind: "PRE_BROADCAST_FAILURE",
      errorCode: "ESTIMATE_GAS_FAILED",
      recoverable: true,
      retrySafe: true,
    };
  }

  return {
    submissionState: "SUBMITTING",
    providerResultKind: "AMBIGUOUS_ERROR",
    errorCode: normalizeProviderErrorCode(error, "PROVIDER_ERROR"),
    recoverable: true,
    retrySafe: false,
  };
}

/** A rejected provider call may still carry the transaction hash. Only accept
 * transaction-specific fields here: a generic `hash` on an error can identify
 * a request or payload rather than an on-chain transaction. */
export function recoverProviderTransactionHashFromError(error: unknown):
  | `0x${string}`
  | null {
  for (const record of walkProviderError(error)) {
    const candidate = record.transactionHash;
    if (typeof candidate === "string" && TX_HASH_RE.test(candidate)) {
      return candidate.toLowerCase() as `0x${string}`;
    }
  }
  return null;
}

export function normalizeProviderTransactionHash(result: unknown):
  | { ok: true; txHash: `0x${string}`; providerResultKind: "TRANSACTION_HASH" }
  | { ok: false; outcome: GetPeonesProviderSubmissionOutcome } {
  const record = asObject(result);
  const candidate = typeof result === "string"
    ? result
    : typeof record?.transactionHash === "string"
      ? record.transactionHash
      : typeof record?.hash === "string"
        ? record.hash
        : "";
  if (TX_HASH_RE.test(candidate)) {
    return {
      ok: true,
      txHash: candidate.toLowerCase() as `0x${string}`,
      providerResultKind: "TRANSACTION_HASH",
    };
  }
  return {
    ok: false,
    outcome: {
      submissionState: "SUBMITTING",
      providerResultKind: "UNEXPECTED_RESULT",
      errorCode: "UNEXPECTED_PROVIDER_RESULT",
      recoverable: true,
      retrySafe: false,
    },
  };
}

export function isGetPeonesCanaryClientRequested(): boolean {
  return process.env.NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED === "true";
}

export function getCanaryTokenByAddress(address: string) {
  const lower = address.toLowerCase();
  return ACCEPTED_TOKENS.find((token) => token.address.toLowerCase() === lower) ?? null;
}

export function getCanaryExpectedAmount(tokenDecimals: number): bigint {
  return normalizePrice(getPeonesPack(GET_PEONES_CANARY_SKU).priceUsd6, tokenDecimals);
}
